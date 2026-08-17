"""BlackBox schema constants and helpers."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

BLACKBOX_VERSION = "1.0.0"
PRE_BUFFER_RETENTION_SEC = 30.0
CAPTURE_PRE_SEC = 20.0
CAPTURE_POST_SEC = 20.0
MIN_DISK_FREE_MB = 5120
MAX_CAMERA_FRAMES_PER_CAM = 90
MAX_LOG_ENTRIES = 5000
MAX_STATE_ENTRIES = 120
MAX_TELEMETRY_ENTRIES = 1200
MAX_EVENT_ENTRIES = 2400


class RecordStatus(str, Enum):
    ARMED = "ARMED"
    TRIGGERED = "TRIGGERED"
    CAPTURING_POST = "CAPTURING_POST"
    FINALIZING = "FINALIZING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"
    INTERRUPTED = "INTERRUPTED"
    CANCELLED = "CANCELLED"


def mono_ns() -> int:
    return time.monotonic_ns()


def wall_iso(ts: Optional[float] = None) -> str:
    t = ts if ts is not None else time.time()
    return datetime.fromtimestamp(t, tz=timezone.utc).astimezone().isoformat()


def stamp(source_clock: str = "dashboard", data: Any = None) -> Dict[str, Any]:
    now = time.time()
    return {
        "timestamp_wall": wall_iso(now),
        "timestamp_mono_ns": mono_ns(),
        "source_clock": source_clock,
        "data": data,
    }
