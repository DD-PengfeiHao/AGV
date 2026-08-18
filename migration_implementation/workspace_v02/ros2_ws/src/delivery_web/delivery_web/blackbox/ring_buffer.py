"""Time-bounded ring buffers for BlackBox."""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional


class RingBuffer:
    """Thread-safe ring buffer with max age and max count."""

    def __init__(self, max_age_sec: float, max_items: int = 10000) -> None:
        self._max_age = max_age_sec
        self._max_items = max_items
        self._items: Deque[Dict[str, Any]] = deque()
        self._lock = threading.Lock()

    def append(self, entry: Dict[str, Any]) -> None:
        with self._lock:
            self._items.append(entry)
            self._evict()

    def _evict(self) -> None:
        cutoff = time.time() - self._max_age
        while self._items and float(self._items[0].get("_ts", 0)) < cutoff:
            self._items.popleft()
        while len(self._items) > self._max_items:
            self._items.popleft()

    def slice_window(self, start_ts: float, end_ts: float) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                e for e in self._items
                if start_ts <= float(e.get("_ts", 0)) <= end_ts
            ]

    def latest(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._items[-1] if self._items else None

    def count(self) -> int:
        with self._lock:
            return len(self._items)

    def health(self) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            oldest = float(self._items[0].get("_ts", 0)) if self._items else None
            newest = float(self._items[-1].get("_ts", 0)) if self._items else None
            return {
                "count": len(self._items),
                "max_age_sec": self._max_age,
                "max_items": self._max_items,
                "oldest_ts": oldest,
                "newest_ts": newest,
                "oldest_age_sec": round(now - oldest, 2) if oldest else None,
                "span_sec": round(newest - oldest, 2) if oldest and newest else 0,
            }


class CameraRingBuffer:
    """Per-camera JPEG ring: **time retention is primary**, count cap is RAM safety."""

    def __init__(self, max_age_sec: float, max_frames: int) -> None:
        self._max_age = float(max_age_sec)
        self._max_frames = int(max_frames)
        self._cams: Dict[str, Deque[Dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def _evict_deque(self, dq: Deque[Dict[str, Any]], now: float) -> None:
        cutoff = now - self._max_age
        while dq and float(dq[0]["_ts"]) < cutoff:
            dq.popleft()
        while len(dq) > self._max_frames:
            dq.popleft()

    def append(self, camera: str, jpeg: bytes, ts: Optional[float] = None) -> None:
        if not jpeg or len(jpeg) < 80:
            return
        now = time.time()
        t = float(ts if ts is not None else now)
        with self._lock:
            dq = self._cams.setdefault(camera, deque())
            dq.append({"_ts": t, "jpeg": jpeg, "size": len(jpeg)})
            self._evict_deque(dq, now)

    def nearest(self, camera: str, target_ts: float) -> Optional[Dict[str, Any]]:
        with self._lock:
            dq = self._cams.get(camera)
            if not dq:
                return None
            best = None
            best_delta = float("inf")
            for item in dq:
                delta = abs(float(item["_ts"]) - target_ts)
                if delta < best_delta:
                    best_delta = delta
                    best = item
            if best is None:
                return None
            return {
                **best,
                "delta_ms": int(best_delta * 1000),
                "camera": camera,
            }

    def window(self, start_ts: float, end_ts: float) -> Dict[str, List[Dict[str, Any]]]:
        out: Dict[str, List[Dict[str, Any]]] = {}
        with self._lock:
            for cam, dq in self._cams.items():
                rows = [
                    {"_ts": i["_ts"], "size": i["size"]}
                    for i in dq
                    if start_ts <= float(i["_ts"]) <= end_ts
                ]
                if rows:
                    out[cam] = rows
        return out

    def health(self, retention_target_sec: float = 20.0) -> Dict[str, Any]:
        """Report per-camera span; retention_ok when oldest frame covers target pre-window."""
        with self._lock:
            now = time.time()
            out: Dict[str, Any] = {}
            for cam, dq in self._cams.items():
                if not dq:
                    out[cam] = {
                        "count": 0,
                        "span_sec": 0,
                        "oldest_age_sec": None,
                        "retention_ok": False,
                        "bytes_total": 0,
                    }
                    continue
                oldest = float(dq[0]["_ts"])
                newest = float(dq[-1]["_ts"])
                oldest_age = now - oldest
                span = newest - oldest
                out[cam] = {
                    "count": len(dq),
                    "max_age_sec": self._max_age,
                    "max_frames_cap": self._max_frames,
                    "span_sec": round(span, 2),
                    "oldest_age_sec": round(oldest_age, 2),
                    "retention_ok": oldest_age >= min(retention_target_sec, self._max_age - 1),
                    "bytes_total": sum(int(i.get("size", 0)) for i in dq),
                }
            return out
