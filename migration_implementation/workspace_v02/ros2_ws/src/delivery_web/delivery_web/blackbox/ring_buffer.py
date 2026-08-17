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
      return {
        "count": len(self._items),
        "max_age_sec": self._max_age,
        "max_items": self._max_items,
        "oldest_ts": float(self._items[0].get("_ts", 0)) if self._items else None,
        "newest_ts": float(self._items[-1].get("_ts", 0)) if self._items else None,
      }


class CameraRingBuffer:
  """Per-camera JPEG ring with memory cap."""

  def __init__(self, max_age_sec: float, max_frames: int) -> None:
    self._max_age = max_age_sec
    self._max_frames = max_frames
    self._cams: Dict[str, Deque[Dict[str, Any]]] = {}
    self._lock = threading.Lock()

  def append(self, camera: str, jpeg: bytes, ts: Optional[float] = None) -> None:
    if not jpeg or len(jpeg) < 80:
      return
    t = ts if ts is not None else time.time()
    with self._lock:
      dq = self._cams.setdefault(camera, deque())
      dq.append({"_ts": t, "jpeg": jpeg, "size": len(jpeg)})
      cutoff = t - self._max_age
      while dq and float(dq[0]["_ts"]) < cutoff:
        dq.popleft()
      while len(dq) > self._max_frames:
        dq.popleft()

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

  def health(self) -> Dict[str, Any]:
    with self._lock:
      return {cam: len(dq) for cam, dq in self._cams.items()}
