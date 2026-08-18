"""MapManager schema — MapIdentity and status constants."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, Optional


class MapManagerStatus(str, Enum):
    OFFLINE = "OFFLINE"
    WAITING_FOR_AGV = "WAITING_FOR_AGV"
    CHECKING = "CHECKING"
    CACHE_HIT = "CACHE_HIT"
    DOWNLOADING = "DOWNLOADING"
    VERIFYING = "VERIFYING"
    PARSING = "PARSING"
    PREPARING = "PREPARING"
    READY = "READY"
    ACTIVE = "ACTIVE"
    PRELOADING = "PRELOADING"
    SWITCHING = "SWITCHING"
    FAILED = "FAILED"
    STALE = "STALE"
    MAP_IDENTITY_UNCERTAIN = "MAP_IDENTITY_UNCERTAIN"
    CACHE_CORRUPTED = "CACHE_CORRUPTED"
    NEXT_MAP_FAILED = "NEXT_MAP_FAILED"
    MAP_MISMATCH = "MAP_MISMATCH"
    LIVE_POINT_CLOUD_ONLY = "LIVE_POINT_CLOUD_ONLY"


class AgvLinkStatus(str, Enum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"
    UNKNOWN = "UNKNOWN"


class MapSource(str, Enum):
    AGV_MAP = "AGV_MAP"
    LOCAL_CACHE = "LOCAL_CACHE"
    LIVE_POINT_CLOUD = "LIVE_POINT_CLOUD"
    UNKNOWN = "UNKNOWN"
    NOT_SUPPORTED = "NOT_SUPPORTED"


@dataclass
class MapIdentity:
    map_id: str = ""
    name: str = ""
    version: str = ""
    revision: str = ""
    hash: str = ""
    source: str = "agv"
    identity_quality: str = "name_only"
    smap_file: str = ""

    def key(self) -> str:
        base = self.map_id or self.name or self.smap_file.replace(".smap", "")
        if self.version:
            return f"{base}@{self.version}"
        if self.hash:
            return f"{base}#{self.hash[:12]}"
        return base

    def same_as(self, other: Optional["MapIdentity"]) -> bool:
        if other is None:
            return False
        if self.hash and other.hash:
            return self.hash == other.hash
        if self.map_id and other.map_id and self.version and other.version:
            return self.map_id == other.map_id and self.version == other.version
        if self.map_id and other.map_id:
            return self.map_id == other.map_id
        if self.name and other.name:
            return self.name == other.name
        return False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]]) -> "MapIdentity":
        if not data:
            return cls()
        return cls(
            map_id=str(data.get("map_id") or data.get("name") or ""),
            name=str(data.get("name") or data.get("map_id") or ""),
            version=str(data.get("version") or ""),
            revision=str(data.get("revision") or ""),
            hash=str(data.get("hash") or ""),
            source=str(data.get("source") or "agv"),
            identity_quality=str(data.get("identity_quality") or "name_only"),
            smap_file=str(data.get("smap_file") or ""),
        )


def file_sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def identity_from_snapshot(snapshot: Dict[str, Any]) -> MapIdentity:
    agv = snapshot.get("agv") or {}
    map_st = snapshot.get("map") or {}
    meta = snapshot.get("meta") or {}
    name = str(
        agv.get("current_map")
        or map_st.get("current_map")
        or meta.get("map_name")
        or ""
    ).strip()
    smap_file = str(map_st.get("smap_file") or meta.get("map_file") or "").strip()
    if not name and smap_file:
        name = smap_file.replace(".smap", "")
    quality = "strong" if name and (map_st.get("current_map") or agv.get("current_map")) else "name_only"
    return MapIdentity(
        map_id=name,
        name=name,
        smap_file=smap_file,
        source="agv",
        identity_quality=quality,
    )


def agv_link_from_snapshot(snapshot: Dict[str, Any], last_agv_ts: float, now: float) -> AgvLinkStatus:
    link = snapshot.get("agv_link") or {}
    if link.get("connected") is False and not link.get("adapter_connected"):
        return AgvLinkStatus.OFFLINE
    agv = snapshot.get("agv") or {}
    updated = float(agv.get("updated_at") or snapshot.get("updated_at") or last_agv_ts or 0)
    age = now - updated if updated else 999.0
    if age < 2.0:
        return AgvLinkStatus.ONLINE
    if age < 5.0:
        return AgvLinkStatus.DEGRADED
    if updated <= 0:
        return AgvLinkStatus.UNKNOWN
    return AgvLinkStatus.OFFLINE


MAP_EVENTS = (
    "MAP_ONLINE",
    "MAP_DETECTED",
    "MAP_CACHE_HIT",
    "MAP_DOWNLOAD_START",
    "MAP_DOWNLOAD_PROGRESS",
    "MAP_DOWNLOAD_COMPLETE",
    "MAP_VERIFY_FAILED",
    "MAP_PREPARE_START",
    "MAP_READY",
    "MAP_PRELOAD_START",
    "MAP_PRELOAD_COMPLETE",
    "MAP_SWITCH_START",
    "MAP_SWITCH_COMPLETE",
    "MAP_SWITCH_FAILED",
    "MAP_MISMATCH",
    "MAP_FALLBACK_POINTCLOUD",
    "MAP_OFFLINE",
)
