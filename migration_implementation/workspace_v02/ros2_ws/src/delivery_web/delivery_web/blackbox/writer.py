"""Async disk writer for BlackBox bundles."""

from __future__ import annotations

import hashlib
import json
import queue
import threading
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


class DiskWriter:
    def __init__(self, logger: Optional[Callable[[str], None]] = None) -> None:
        self._q: queue.Queue = queue.Queue(maxsize=64)
        self._log = logger or (lambda _m: None)
        self._thread = threading.Thread(target=self._run, name="blackbox-writer", daemon=True)
        self._thread.start()

    def enqueue(self, job: Dict[str, Any]) -> None:
        try:
            self._q.put_nowait(job)
        except queue.Full:
            self._log("blackbox writer queue full — dropping finalize job")

    def _run(self) -> None:
        while True:
            job = self._q.get()
            try:
                if job.get("op") == "finalize":
                    self._finalize(job)
            except Exception as exc:  # noqa: BLE001
                cb = job.get("on_error")
                if cb:
                    cb(str(exc))
                self._log(f"blackbox writer error: {exc}")
            finally:
                self._q.task_done()

    def _write_json(self, path: Path, obj: Any) -> int:
        path.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(obj, ensure_ascii=False, indent=2)
        path.write_text(text, encoding="utf-8")
        return len(text.encode("utf-8"))

    def _write_jsonl(self, path: Path, rows: List[Dict[str, Any]]) -> int:
        path.parent.mkdir(parents=True, exist_ok=True)
        total = 0
        with path.open("w", encoding="utf-8") as f:
            for row in rows:
                line = json.dumps(row, ensure_ascii=False) + "\n"
                f.write(line)
                total += len(line.encode("utf-8"))
        return total

    def _sha256_file(self, path: Path) -> str:
        h = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def _finalize(self, job: Dict[str, Any]) -> None:
        root = Path(job["root"])
        root.mkdir(parents=True, exist_ok=True)
        files_meta: List[Dict[str, Any]] = []

        def track(rel: str, size: int, sha: Optional[str] = None) -> None:
            files_meta.append({"path": rel, "size": size, "sha256": sha})

        for name, obj in (job.get("meta") or {}).items():
            p = root / "meta" / name
            track(f"meta/{name}", self._write_json(p, obj))

        for name, obj in (job.get("snapshot") or {}).items():
            p = root / "snapshot" / name
            track(f"snapshot/{name}", self._write_json(p, obj))

        for section, files in (job.get("jsonl") or {}).items():
            for fname, rows in files.items():
                p = root / section / fname
                track(f"{section}/{fname}", self._write_jsonl(p, rows))

        frames_index: List[Dict[str, Any]] = []
        for cam, frame in (job.get("frames") or {}).items():
            if not frame or not frame.get("jpeg"):
                frames_index.append({
                    "camera": cam,
                    "status": "unavailable",
                    "reason": frame.get("reason", "no frame in buffer") if frame else "no frame",
                })
                continue
            rel = f"frame/{cam}.jpg"
            p = root / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(frame["jpeg"])
            sha = self._sha256_file(p)
            track(rel, p.stat().st_size, sha)
            frames_index.append({
                "camera": cam,
                "status": "complete",
                "frame_timestamp": frame.get("timestamp_wall"),
                "trigger_timestamp": job.get("trigger_wall"),
                "delta_ms": frame.get("delta_ms"),
                "file": rel,
                "format": "jpeg",
                "size": len(frame["jpeg"]),
            })

        fi_path = root / "frame" / "frames.json"
        track("frame/frames.json", self._write_json(fi_path, frames_index))

        manifest = job.get("manifest") or {}
        manifest["files"] = files_meta
        manifest["status"] = "COMPLETE"
        track("manifest.json", self._write_json(root / "manifest.json", manifest))

        cb = job.get("on_complete")
        if cb:
            cb(str(root), manifest)
