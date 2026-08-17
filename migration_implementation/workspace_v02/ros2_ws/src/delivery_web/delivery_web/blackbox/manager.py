"""BlackBox Manager — state machine, collectors, trigger API."""

from __future__ import annotations

import json
import os
import socket
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from delivery_web.blackbox.ring_buffer import CameraRingBuffer, RingBuffer
from delivery_web.blackbox.schema import (
    BLACKBOX_VERSION,
    CAPTURE_POST_SEC,
    CAPTURE_PRE_SEC,
    MAX_CAMERA_FRAMES_PER_CAM,
    MAX_EVENT_ENTRIES,
    MAX_LOG_ENTRIES,
    MAX_STATE_ENTRIES,
    MAX_TELEMETRY_ENTRIES,
    MIN_DISK_FREE_MB,
    PRE_BUFFER_RETENTION_SEC,
    RecordStatus,
    mono_ns,
    stamp,
    wall_iso,
)
from delivery_web.blackbox.writer import DiskWriter


def _default_base_dir() -> Path:
    override = os.environ.get("BLACKBOX_DIR", "").strip()
    if override:
        return Path(override).expanduser()
    return Path.home() / "Pengfei.Hao" / "blackbox"


class BlackBoxManager:
    def __init__(
        self,
        *,
        version: str = "0.0.0",
        logger: Optional[Callable[[str], None]] = None,
        snapshot_fn: Optional[Callable[[], Dict[str, Any]]] = None,
    ) -> None:
        self._version = version
        self._log = logger or (lambda _m: None)
        self._snapshot_fn = snapshot_fn
        self._base_dir = _default_base_dir()
        self._lock = threading.Lock()
        self._status = RecordStatus.ARMED
        self._active_record_id: Optional[str] = None
        self._trigger_mono: float = 0.0
        self._trigger_wall: float = 0.0
        self._record_end_mono: float = 0.0
        self._last_record: Optional[Dict[str, Any]] = None
        self._last_error: Optional[str] = None
        self._duplicate_triggers = 0

        self._state_buf = RingBuffer(PRE_BUFFER_RETENTION_SEC, MAX_STATE_ENTRIES)
        self._telemetry_buf = RingBuffer(PRE_BUFFER_RETENTION_SEC, MAX_TELEMETRY_ENTRIES)
        self._event_buf = RingBuffer(PRE_BUFFER_RETENTION_SEC * 2, MAX_EVENT_ENTRIES)
        self._alert_buf = RingBuffer(PRE_BUFFER_RETENTION_SEC * 2, MAX_EVENT_ENTRIES)
        self._log_buf = RingBuffer(PRE_BUFFER_RETENTION_SEC * 2, MAX_LOG_ENTRIES)
        self._camera_buf = CameraRingBuffer(PRE_BUFFER_RETENTION_SEC, MAX_CAMERA_FRAMES_PER_CAM)
        self._writer = DiskWriter(logger=self._log)

        try:
            self._base_dir.mkdir(parents=True, exist_ok=True)
            self._recover_interrupted()
        except Exception as exc:  # noqa: BLE001
            self._log(f"blackbox init warn: {exc}")

    def feed_state(self, state: Dict[str, Any]) -> None:
        if not state:
            return
        now = time.time()
        entry = stamp("dashboard", {
            "agv": state.get("agv"),
            "arm": state.get("arm"),
            "navigation": {"route": state.get("route"), "route_task": state.get("route_task")},
            "system": {"version": state.get("version"), "uptime_sec": state.get("uptime_sec"), "env": state.get("env")},
        })
        entry["_ts"] = now
        self._state_buf.append(entry)
        agv = state.get("agv") or {}
        vx = float(agv.get("vx") or 0)
        vy = float(agv.get("vy") or 0)
        tel = stamp("dashboard", {"velocity": {"vx": vx, "vy": vy, "speed": (vx * vx + vy * vy) ** 0.5}})
        tel["_ts"] = now
        self._telemetry_buf.append(tel)
        for alert in state.get("alerts") or []:
            a = stamp("dashboard", alert)
            a["_ts"] = now
            self._alert_buf.append(a)

    def feed_event(
        self,
        kind: str,
        message: str,
        *,
        level: str = "INFO",
        event: str = "",
        trace_id: str = "",
        source: str = "dashboard",
    ) -> None:
        now = time.time()
        entry = stamp(source, {
            "level": level,
            "source": source,
            "component": kind,
            "code": event or kind,
            "message": message,
            "trace_id": trace_id,
        })
        entry["_ts"] = now
        self._event_buf.append(entry)
        self._log_buf.append(entry)

    def feed_camera(self, name: str, jpeg: bytes, ts: Optional[float] = None) -> None:
        self._camera_buf.append(name, jpeg, ts)

    def feed_client_bundle(self, bundle: Dict[str, Any]) -> None:
        now = time.time()
        entry = stamp("web", bundle)
        entry["_ts"] = now
        self._event_buf.append(entry)

    def trigger(
        self,
        *,
        source: str = "keyboard",
        user: str = "",
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = payload or {}
        with self._lock:
            if self._status in (RecordStatus.CAPTURING_POST, RecordStatus.FINALIZING, RecordStatus.TRIGGERED):
                self._duplicate_triggers += 1
                self.feed_event("blackbox", "duplicate trigger ignored", level="WARN", event="BLACKBOX_DUPLICATE_TRIGGER", source="blackbox")
                return {
                    "success": True,
                    "duplicate": True,
                    "record_id": self._active_record_id,
                    "status": self._status.value,
                    "message": "已有进行中的 BlackBox 采集",
                }

            disk = self._disk_free_mb()
            if disk is not None and disk < MIN_DISK_FREE_MB:
                self._status = RecordStatus.FAILED
                self._last_error = "DISK_FULL"
                return {
                    "success": False,
                    "status": RecordStatus.FAILED.value,
                    "message": f"磁盘空间不足 ({disk:.0f} MB < {MIN_DISK_FREE_MB} MB)",
                    "code": "DISK_FULL",
                }

            record_id = self._new_record_id()
            self._active_record_id = record_id
            self._trigger_wall = time.time()
            self._trigger_mono = time.monotonic()
            self._record_end_mono = self._trigger_mono + CAPTURE_POST_SEC
            self._status = RecordStatus.CAPTURING_POST
            self._last_error = None
            self.feed_event("blackbox", "BLACKBOX_TRIGGERED", level="INFO", event="BLACKBOX_TRIGGERED", source="blackbox")

        snap: Dict[str, Any] = {}
        if self._snapshot_fn:
            try:
                snap = self._snapshot_fn()
            except Exception as exc:  # noqa: BLE001
                snap = {"error": str(exc)}

        client = payload.get("client") or {}
        if client:
            self.feed_client_bundle(client)

        threading.Thread(
            target=self._capture_post_window,
            args=(record_id, source, user, payload, snap),
            name=f"blackbox-capture-{record_id}",
            daemon=True,
        ).start()

        return {
            "success": True,
            "record_id": record_id,
            "status": RecordStatus.CAPTURING_POST.value,
            "trigger_time": wall_iso(self._trigger_wall),
            "remaining_post_seconds": CAPTURE_POST_SEC,
            "message": "Black Box 已触发，正在采集事件后 20 秒",
        }

    def _capture_post_window(
        self,
        record_id: str,
        source: str,
        user: str,
        payload: Dict[str, Any],
        t0_snapshot: Dict[str, Any],
    ) -> None:
        while time.monotonic() < self._record_end_mono:
            time.sleep(0.25)
        with self._lock:
            self._status = RecordStatus.FINALIZING
        try:
            self._finalize_record(record_id, source, user, payload, t0_snapshot)
            with self._lock:
                self._status = RecordStatus.COMPLETE
            self.feed_event("blackbox", "BLACKBOX_CAPTURE_COMPLETE", level="INFO", event="BLACKBOX_CAPTURE_COMPLETE", source="blackbox")
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self._status = RecordStatus.FAILED
                self._last_error = str(exc)
            self.feed_event("blackbox", f"BLACKBOX_FAILED: {exc}", level="ERROR", event="BLACKBOX_FAILED", source="blackbox")

    def _finalize_record(
        self,
        record_id: str,
        source: str,
        user: str,
        payload: Dict[str, Any],
        t0_snapshot: Dict[str, Any],
    ) -> None:
        t0 = self._trigger_wall
        start = t0 - CAPTURE_PRE_SEC
        end = t0 + CAPTURE_POST_SEC
        root = self._base_dir / record_id[:8] / record_id

        states = self._state_buf.slice_window(start, end)
        telemetry = self._telemetry_buf.slice_window(start, end)
        events = self._event_buf.slice_window(start, end)
        alerts = self._alert_buf.slice_window(start, end)
        logs = self._log_buf.slice_window(start, end)

        cameras = ("cam_front", "cam_left", "cam_right", "wrist_camera")
        frames: Dict[str, Any] = {}
        for cam in cameras:
            fr = self._camera_buf.nearest(cam, t0)
            if fr:
                fr = dict(fr)
                fr["timestamp_wall"] = wall_iso(float(fr.get("_ts", t0)))
            frames[cam] = fr

        sources_status = {
            "state": "complete" if states else "partial",
            "telemetry": "complete" if telemetry else "partial",
            "events": "complete" if events else "partial",
            "alerts": "complete" if alerts else "partial",
            "logs": "complete" if logs else "partial",
        }
        for cam in cameras:
            fr = frames.get(cam)
            sources_status[f"camera.{cam}"] = "complete" if fr and fr.get("jpeg") else "unavailable"

        manifest = {
            "record_id": record_id,
            "version": BLACKBOX_VERSION,
            "created_at": wall_iso(),
            "trigger_time": wall_iso(t0),
            "record_start": wall_iso(start),
            "record_end": wall_iso(end),
            "timezone": str(datetime.now().astimezone().tzinfo),
            "duration_sec": CAPTURE_PRE_SEC + CAPTURE_POST_SEC,
            "robot_id": os.environ.get("ROBOT_ID", socket.gethostname()),
            "software_version": self._version,
            "hostname": socket.gethostname(),
            "ros_domain_id": os.environ.get("ROS_DOMAIN_ID", ""),
            "operator": user or "unknown",
            "trigger_source": source,
            "sources": sources_status,
            "status": RecordStatus.FINALIZING.value,
        }

        done_event = threading.Event()
        result: Dict[str, Any] = {}

        def on_complete(path: str, man: Dict[str, Any]) -> None:
            result["path"] = path
            result["manifest"] = man
            done_event.set()

        def on_error(msg: str) -> None:
            result["error"] = msg
            done_event.set()

        self._writer.enqueue({
            "op": "finalize",
            "root": str(root),
            "trigger_wall": wall_iso(t0),
            "meta": {
                "trigger.json": {
                    "source": source,
                    "user": user,
                    "key": payload.get("key"),
                    "view_mode": (payload.get("client") or {}).get("scene", {}).get("view_mode"),
                    "trigger_mono_ns": mono_ns(),
                },
                "system.json": {"hostname": socket.gethostname(), "version": self._version, "blackbox_version": BLACKBOX_VERSION},
                "environment.json": {"blackbox_dir": str(self._base_dir), "ros_domain_id": os.environ.get("ROS_DOMAIN_ID", "")},
            },
            "snapshot": {
                "state.json": {"captured_at": wall_iso(t0), "schema_version": BLACKBOX_VERSION, "source": "/api/state", "state": t0_snapshot},
                "scene.json": (payload.get("client") or {}).get("scene") or {},
                "metrics.json": (payload.get("client") or {}).get("metrics") or {},
            },
            "jsonl": {
                "state": {"agv.jsonl": states},
                "telemetry": {"velocity.jsonl": telemetry},
                "events": {"events.jsonl": events},
                "alerts": {"alerts.jsonl": alerts},
                "logs": {"dashboard.jsonl": logs},
            },
            "frames": frames,
            "manifest": manifest,
            "on_complete": on_complete,
            "on_error": on_error,
        })

        if not done_event.wait(timeout=120):
            raise TimeoutError("blackbox disk writer timeout")
        if result.get("error"):
            raise RuntimeError(result["error"])

        with self._lock:
            self._last_record = {"record_id": record_id, "path": str(root), "status": RecordStatus.COMPLETE.value, "completed_at": wall_iso()}
            self._active_record_id = None

    def status(self) -> Dict[str, Any]:
        with self._lock:
            remaining = max(0.0, self._record_end_mono - time.monotonic()) if self._status == RecordStatus.CAPTURING_POST else 0.0
            return {
                "armed": self._status in (RecordStatus.ARMED, RecordStatus.COMPLETE),
                "state": self._status.value,
                "active_record": self._active_record_id,
                "trigger_time": wall_iso(self._trigger_wall) if self._trigger_wall else None,
                "remaining_post_seconds": round(remaining, 1),
                "disk_free_mb": self._disk_free_mb(),
                "buffer_health": {
                    "state": self._state_buf.health(),
                    "telemetry": self._telemetry_buf.health(),
                    "events": self._event_buf.health(),
                    "camera": self._camera_buf.health(),
                },
                "last_record": self._last_record,
                "last_error": self._last_error,
                "duplicate_triggers_ignored": self._duplicate_triggers,
                "base_dir": str(self._base_dir),
            }

    def list_records(self, limit: int = 20) -> Dict[str, Any]:
        rows: List[Dict[str, Any]] = []
        if not self._base_dir.is_dir():
            return {"records": rows}
        for day_dir in sorted(self._base_dir.iterdir(), reverse=True):
            if not day_dir.is_dir():
                continue
            for rec in sorted(day_dir.iterdir(), reverse=True):
                if not rec.is_dir():
                    continue
                manifest = rec / "manifest.json"
                if manifest.is_file():
                    try:
                        data = json.loads(manifest.read_text(encoding="utf-8"))
                        rows.append({"record_id": data.get("record_id", rec.name), "path": str(rec), "status": data.get("status", "COMPLETE"), "trigger_time": data.get("trigger_time")})
                    except Exception:  # noqa: BLE001
                        rows.append({"record_id": rec.name, "path": str(rec), "status": "UNKNOWN"})
                if len(rows) >= limit:
                    break
            if len(rows) >= limit:
                break
        return {"records": rows}

    def get_record(self, record_id: str) -> Dict[str, Any]:
        safe = "".join(c for c in record_id if c.isalnum() or c in ("_", "-"))
        if safe != record_id or ".." in record_id:
            return {"success": False, "message": "invalid record_id"}
        for root in (self._base_dir / safe[:8] / safe, self._base_dir / safe):
            manifest = root / "manifest.json"
            if manifest.is_file():
                try:
                    data = json.loads(manifest.read_text(encoding="utf-8"))
                    return {"success": True, "record_id": safe, "path": str(root), "manifest": data}
                except Exception as exc:  # noqa: BLE001
                    return {"success": False, "message": str(exc)}
        return {"success": False, "message": "not found"}

    def _new_record_id(self) -> str:
        base = datetime.now().strftime("%Y%m%d_%H%M%S")
        day = base[:8]
        root = self._base_dir / day
        root.mkdir(parents=True, exist_ok=True)
        rid = base
        n = 1
        while (root / rid).exists():
            rid = f"{base}_{n:02d}"
            n += 1
        return rid

    def _disk_free_mb(self) -> Optional[float]:
        try:
            import shutil
            return shutil.disk_usage(str(self._base_dir)).free / (1024 * 1024)
        except Exception:  # noqa: BLE001
            return None

    def _recover_interrupted(self) -> None:
        for day_dir in self._base_dir.iterdir():
            if not day_dir.is_dir():
                continue
            for rec in day_dir.iterdir():
                if not rec.is_dir() or (rec / "manifest.json").is_file():
                    continue
                meta = {"record_id": rec.name, "status": RecordStatus.INTERRUPTED.value, "note": "recovered on dashboard boot"}
                try:
                    (rec / "meta").mkdir(parents=True, exist_ok=True)
                    (rec / "meta" / "recovery.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
                except Exception:  # noqa: BLE001
                    pass
