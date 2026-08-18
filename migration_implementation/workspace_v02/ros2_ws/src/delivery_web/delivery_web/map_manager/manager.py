"""MapManager — event-driven reconcile, async download, READ ONLY w.r.t. AGV control."""

from __future__ import annotations

import json
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from delivery_web.map_manager.cache import MapCache
from delivery_web.map_manager.schema import (
    AgvLinkStatus,
    MapIdentity,
    MapManagerStatus,
    MapSource,
    agv_link_from_snapshot,
    identity_from_snapshot,
)
from delivery_web.smap_sim import load_smap_layers


EventFn = Callable[[str, str, Dict[str, Any]], None]


class MapManager:
    """Server-side map cache + async prepare. Does not control AGV."""

    def __init__(
        self,
        *,
        sync_from_robot: Callable[[], Dict[str, Any]],
        load_smap: Callable[[str], Dict[str, Any]],
        writable_maps_dir: Callable[[], Path],
        on_event: Optional[EventFn] = None,
        cache_root: Optional[str] = None,
    ) -> None:
        self._sync_from_robot = sync_from_robot
        self._load_smap = load_smap
        self._writable_maps_dir = writable_maps_dir
        self._on_event = on_event or (lambda *a, **k: None)
        self._cache = MapCache(cache_root)
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="map-mgr")
        self._jobs: Dict[str, str] = {}  # key -> status
        self._timings: Dict[str, int] = {}
        self._status = MapManagerStatus.WAITING_FOR_AGV
        self._source = MapSource.UNKNOWN
        self._agv_link = AgvLinkStatus.UNKNOWN
        self._current: Optional[MapIdentity] = None
        self._active: Optional[MapIdentity] = None
        self._next: Optional[MapIdentity] = None
        self._active_render: Optional[Dict[str, Any]] = None
        self._next_render: Optional[Dict[str, Any]] = None
        self._progress = 0.0
        self._error: str = ""
        self._last_check = 0.0
        self._last_agv_ts = 0.0
        self._download_supported = True
        self._previous_active: Optional[MapIdentity] = None
        self._mismatch = False

    def close(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)

    def _emit(self, code: str, level: str = "INFO", **data: Any) -> None:
        try:
            self._on_event(code, level, data)
        except Exception:  # noqa: BLE001
            pass

    def status_dict(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "status": self._status.value,
                "agv_link": self._agv_link.value,
                "source": self._source.value,
                "online": self._agv_link in (AgvLinkStatus.ONLINE, AgvLinkStatus.DEGRADED),
                "current": self._current.to_dict() if self._current else None,
                "active": self._active.to_dict() if self._active else None,
                "next": self._next.to_dict() if self._next else None,
                "previous": self._previous_active.to_dict() if self._previous_active else None,
                "progress": round(self._progress, 1),
                "last_check": self._last_check,
                "error": self._error or None,
                "mismatch": self._mismatch,
                "download_supported": self._download_supported,
                "timings_ms": dict(self._timings),
                "cache": self._cache.cache_stats(),
                "active_render_ready": bool(self._active_render),
                "next_render_ready": bool(self._next_render),
            }

    def list_maps(self) -> Dict[str, Any]:
        return {
            "success": True,
            "cache": self._cache.list_entries(),
            "cache_stats": self._cache.cache_stats(),
        }

    def cache_info(self) -> Dict[str, Any]:
        return {"success": True, **self._cache.cache_stats(), "entries": self._cache.list_entries()}

    def preload(self, identity: Optional[MapIdentity] = None) -> Dict[str, Any]:
        ident = identity or self._next or self._current
        if not ident or not ident.map_id:
            return {"success": False, "accepted": False, "message": "no map identity"}
        key = ident.key()
        with self._lock:
            if self._jobs.get(key) == "DOWNLOADING":
                return {"success": True, "accepted": False, "message": "already downloading", "key": key}
        self._schedule_job(ident, priority="NEXT_MAP" if self._next else "CURRENT_MAP")
        return {"success": True, "accepted": True, "key": key}

    def refresh(self) -> Dict[str, Any]:
        ident = self._current
        if not ident:
            return {"success": False, "message": "no current map"}
        self._schedule_job(ident, priority="CURRENT_MAP", force=True)
        return {"success": True, "accepted": True}

    def reconcile(self, snapshot: Dict[str, Any], *, reason: str = "periodic") -> None:
        now = time.time()
        self._last_check = now
        try:
            self._agv_link = agv_link_from_snapshot(snapshot, self._last_agv_ts, now)
            agv = snapshot.get("agv") or {}
            if agv.get("updated_at"):
                self._last_agv_ts = float(agv["updated_at"])
            elif snapshot.get("updated_at"):
                self._last_agv_ts = float(snapshot["updated_at"])

            if self._agv_link == AgvLinkStatus.OFFLINE:
                self._status = MapManagerStatus.OFFLINE if not self._active else MapManagerStatus.STALE
                self._source = MapSource.UNKNOWN if not self._active else MapSource.LOCAL_CACHE
                self._emit("MAP_OFFLINE", agv_link=self._agv_link.value, reason=reason)
                return

            if self._agv_link == AgvLinkStatus.UNKNOWN:
                self._status = MapManagerStatus.WAITING_FOR_AGV
                return

            current = identity_from_snapshot(snapshot)
            if not current.map_id:
                self._status = MapManagerStatus.WAITING_FOR_AGV
                return

            prev_current = self._current
            self._current = current
            if not prev_current or not prev_current.same_as(current):
                self._emit("MAP_DETECTED", identity=current.to_dict(), reason=reason)

            self._next = self._detect_next_map(snapshot)
            self._status = MapManagerStatus.CHECKING

            hit = self._cache.find_hit(current)
            if hit:
                self._emit("MAP_CACHE_HIT", identity=current.to_dict())
                self._activate_from_cache(current, hit, snapshot)
                if self._next and not self._next.same_as(self._active):
                    self.preload(self._next)
                return

            if self._active and self._active.same_as(current) and self._active_render:
                self._status = MapManagerStatus.ACTIVE
                self._source = MapSource.AGV_MAP
                if self._next and not self._next.same_as(self._active):
                    self.preload(self._next)
                return

            if self._active and not self._active.same_as(current):
                self._mismatch = True
                self._emit("MAP_MISMATCH", active=self._active.to_dict(), current=current.to_dict())
                self._status = MapManagerStatus.MAP_MISMATCH

            self._schedule_job(current, priority="CURRENT_MAP")
            if self._next:
                self.preload(self._next)
        except Exception as exc:  # noqa: BLE001
            self._error = str(exc)
            self._status = MapManagerStatus.FAILED
            self._emit("MAP_SWITCH_FAILED", level="ERROR", error=str(exc), trace=traceback.format_exc()[:500])

    def _detect_next_map(self, snapshot: Dict[str, Any]) -> Optional[MapIdentity]:
        rt = snapshot.get("route_task") or {}
        for key in ("next_map", "upcoming_map", "map_name"):
            val = rt.get(key)
            if val and isinstance(val, str):
                return MapIdentity(map_id=val, name=val, source="route_task", identity_quality="name_only")
        planning = snapshot.get("planning") or {}
        upcoming = planning.get("upcoming_maps") or []
        if upcoming and isinstance(upcoming[0], str):
            return MapIdentity(map_id=upcoming[0], name=upcoming[0], source="planning", identity_quality="name_only")
        return None

    def _schedule_job(self, identity: MapIdentity, *, priority: str = "CURRENT_MAP", force: bool = False) -> None:
        key = identity.key()
        with self._lock:
            if not force and self._jobs.get(key) in ("DOWNLOADING", "VERIFYING", "PARSING", "PREPARING"):
                return
            self._jobs[key] = "DOWNLOADING"
            if priority == "NEXT_MAP":
                self._status = MapManagerStatus.PRELOADING
            else:
                self._status = MapManagerStatus.DOWNLOADING
        self._executor.submit(self._run_job, identity, priority)

    def _run_job(self, identity: MapIdentity, priority: str) -> None:
        key = identity.key()
        t0 = time.time()
        timings: Dict[str, int] = {}
        try:
            self._emit("MAP_DOWNLOAD_START", identity=identity.to_dict(), priority=priority)
            with self._lock:
                self._progress = 5.0
            t_dl = time.time()
            result = self._sync_from_robot()
            timings["download_ms"] = int((time.time() - t_dl) * 1000)
            if not result.get("success"):
                msg = str(result.get("message") or "download failed")
                if "dev uses local smap" in msg:
                    with self._lock:
                        self._download_supported = False
                        self._error = "BACKEND: dev mode uses local smap only"
                        self._jobs.pop(key, None)
                    return
                raise RuntimeError(msg)
            with self._lock:
                self._status = MapManagerStatus.VERIFYING
                self._progress = 40.0
            smap_name = str(result.get("smap_file") or result.get("map_name") or identity.smap_file or "")
            if not smap_name.endswith(".smap"):
                smap_name = f"{identity.map_id}.smap"
            path = self._writable_maps_dir() / Path(smap_name).name
            if not path.is_file():
                alt = self._writable_maps_dir() / f"{identity.map_id}.smap"
                path = alt if alt.is_file() else path
            if not path.is_file():
                raise FileNotFoundError(f"smap missing after download: {path}")
            t_v = time.time()
            layers = load_smap_layers(path, max_cloud=8000)
            timings["verify_ms"] = int((time.time() - t_v) * 1000)
            with self._lock:
                self._status = MapManagerStatus.PARSING
                self._progress = 60.0
            t_p = time.time()
            render_meta = {
                "cloud_count": len(layers.get("cloud") or []),
                "curve_count": len(layers.get("curves") or []),
                "map_name": layers.get("map_name") or identity.name,
                "bounds": layers.get("header"),
            }
            timings["parse_ms"] = int((time.time() - t_p) * 1000)
            with self._lock:
                self._status = MapManagerStatus.PREPARING
                self._progress = 80.0
            t_pr = time.time()
            identity.smap_file = path.name
            reg = self._cache.register_map(identity, path, render_meta, timings)
            render = {
                "cloud": layers.get("cloud") or [],
                "curves": layers.get("curves") or [],
                "stations": layers.get("stations") or {},
                "meta": {
                    "map_name": render_meta.get("map_name"),
                    "map_file": path.name,
                },
                "smap_file": path.name,
            }
            timings["prepare_ms"] = int((time.time() - t_pr) * 1000)
            timings["total_ms"] = int((time.time() - t0) * 1000)
            self._emit("MAP_DOWNLOAD_COMPLETE", identity=identity.to_dict(), timings=timings)
            with self._lock:
                self._progress = 100.0
                self._timings = timings
                self._jobs.pop(key, None)
                if priority == "NEXT_MAP":
                    self._next_render = render
                    self._emit("MAP_PRELOAD_COMPLETE", identity=identity.to_dict())
                else:
                    self._apply_active(identity, render)
                    self._emit("MAP_READY", identity=identity.to_dict())
                    self._load_smap(path.name)
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self._jobs.pop(key, None)
                self._error = str(exc)
                if priority == "NEXT_MAP":
                    self._status = MapManagerStatus.NEXT_MAP_FAILED
                    self._emit("MAP_SWITCH_FAILED", level="WARN", identity=identity.to_dict(), error=str(exc))
                else:
                    self._status = MapManagerStatus.FAILED
                    if self._mismatch:
                        self._status = MapManagerStatus.LIVE_POINT_CLOUD_ONLY
                        self._source = MapSource.LIVE_POINT_CLOUD
                        self._emit("MAP_FALLBACK_POINTCLOUD", error=str(exc))
                    self._emit("MAP_VERIFY_FAILED", level="ERROR", error=str(exc))

    def _activate_from_cache(self, identity: MapIdentity, hit: Dict[str, Any], snapshot: Dict[str, Any]) -> None:
        smap_path = Path(hit["smap_path"])
        try:
            layers = load_smap_layers(smap_path, max_cloud=8000)
            render = {
                "cloud": layers.get("cloud") or [],
                "curves": layers.get("curves") or [],
                "stations": layers.get("stations") or {},
                "meta": {"map_name": layers.get("map_name"), "map_file": smap_path.name},
                "smap_file": smap_path.name,
            }
            with self._lock:
                self._apply_active(identity, render)
                self._source = MapSource.LOCAL_CACHE
            self._load_smap(smap_path.name)
            self._emit("MAP_READY", identity=identity.to_dict(), source="cache")
        except Exception as exc:  # noqa: BLE001
            self._cache.isolate_corrupted(identity)
            self._schedule_job(identity, priority="CURRENT_MAP", force=True)

    def _apply_active(self, identity: MapIdentity, render: Dict[str, Any]) -> None:
        if self._active and not self._active.same_as(identity):
            self._previous_active = self._active
            self._emit("MAP_SWITCH_START", from_map=self._active.to_dict(), to_map=identity.to_dict())
        self._active = identity
        self._active_render = render
        self._status = MapManagerStatus.ACTIVE
        self._source = MapSource.AGV_MAP
        self._mismatch = False
        self._error = ""
        self._emit("MAP_SWITCH_COMPLETE", identity=identity.to_dict())

    def get_active_render(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._mismatch and not self._active_render:
                return None
            return self._active_render

    def blackbox_map_state(self) -> Dict[str, Any]:
        st = self.status_dict()
        return {
            "current": st.get("current"),
            "active": st.get("active"),
            "next": st.get("next"),
            "status": st.get("status"),
            "source": st.get("source"),
            "last_check": st.get("last_check"),
            "mismatch": st.get("mismatch"),
        }

    def feed_blackbox_events(self, push_event: Callable[..., None]) -> None:
        orig = self._on_event

        def wrapper(code: str, level: str, data: Dict[str, Any]) -> None:
            orig(code, level, data)
            try:
                push_event("map_manager", code, level=level, data=data)
            except Exception:  # noqa: BLE001
                pass

        self._on_event = wrapper
