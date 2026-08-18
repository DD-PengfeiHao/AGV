"""Persistent Map Cache — registry + per-map metadata."""

from __future__ import annotations

import json
import os
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from delivery_web.map_manager.schema import MapIdentity, file_sha256


class MapCache:
    def __init__(self, root: Optional[str] = None) -> None:
        default = os.path.expanduser("~/Pengfei.Hao/maps")
        self._root = Path(root or os.environ.get("MAP_CACHE_DIR", default))
        self._registry_path = self._root / "registry.json"
        self._root.mkdir(parents=True, exist_ok=True)
        self._registry: Dict[str, Any] = {"maps": {}}
        self._load_registry()

    @property
    def root(self) -> Path:
        return self._root

    def _load_registry(self) -> None:
        if not self._registry_path.is_file():
            self._save_registry()
            return
        try:
            self._registry = json.loads(self._registry_path.read_text(encoding="utf-8"))
            if "maps" not in self._registry:
                self._registry["maps"] = {}
        except Exception:  # noqa: BLE001
            self._registry = {"maps": {}}

    def _save_registry(self) -> None:
        self._registry_path.write_text(
            json.dumps(self._registry, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _map_dir(self, identity: MapIdentity) -> Path:
        safe = (identity.map_id or identity.name or "unknown").replace("/", "_").replace("\\", "_")
        return self._root / safe

    def get_entry(self, identity: MapIdentity) -> Optional[Dict[str, Any]]:
        return self._registry.get("maps", {}).get(identity.key())

    def list_entries(self) -> List[Dict[str, Any]]:
        return list(self._registry.get("maps", {}).values())

    def cache_stats(self) -> Dict[str, Any]:
        entries = self.list_entries()
        total_bytes = sum(int(e.get("size") or 0) for e in entries)
        return {
            "root": str(self._root),
            "count": len(entries),
            "total_bytes": total_bytes,
            "total_mb": round(total_bytes / (1024 * 1024), 2),
        }

    def find_hit(self, identity: MapIdentity) -> Optional[Dict[str, Any]]:
        entry = self.get_entry(identity)
        if not entry:
            for e in self.list_entries():
                stored = MapIdentity.from_dict(e.get("identity"))
                if identity.same_as(stored):
                    entry = e
                    break
        if not entry:
            return None
        smap_path = Path(entry.get("smap_path") or "")
        if not smap_path.is_file():
            entry["status"] = "CACHE_CORRUPTED"
            return None
        if entry.get("hash"):
            try:
                if file_sha256(str(smap_path)) != entry["hash"]:
                    entry["status"] = "CACHE_CORRUPTED"
                    return None
            except OSError:
                entry["status"] = "CACHE_CORRUPTED"
                return None
        entry["status"] = "READY"
        entry["last_used"] = time.time()
        self._save_registry()
        return entry

    def register_map(
        self,
        identity: MapIdentity,
        smap_path: Path,
        render_meta: Optional[Dict[str, Any]] = None,
        timings: Optional[Dict[str, int]] = None,
    ) -> Dict[str, Any]:
        mdir = self._map_dir(identity)
        source_dir = mdir / "source"
        render_dir = mdir / "render"
        source_dir.mkdir(parents=True, exist_ok=True)
        render_dir.mkdir(parents=True, exist_ok=True)
        dest = source_dir / (identity.smap_file or f"{identity.map_id}.smap")
        if smap_path.resolve() != dest.resolve():
            shutil.copy2(smap_path, dest)
        digest = file_sha256(str(dest))
        identity.hash = digest
        meta_path = mdir / "metadata.json"
        metadata = {
            "identity": identity.to_dict(),
            "smap_path": str(dest),
            "render_dir": str(render_dir),
            "created_at": time.time(),
            "last_used": time.time(),
            "size": dest.stat().st_size,
            "status": "READY",
            "render": render_meta or {},
            "timings_ms": timings or {},
        }
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        if render_meta:
            (render_dir / "index.json").write_text(
                json.dumps(render_meta, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        reg = {
            "key": identity.key(),
            "identity": identity.to_dict(),
            "smap_path": str(dest),
            "metadata_path": str(meta_path),
            "path": str(mdir),
            "hash": digest,
            "size": metadata["size"],
            "created_at": metadata["created_at"],
            "last_used": metadata["last_used"],
            "status": "READY",
        }
        self._registry.setdefault("maps", {})[identity.key()] = reg
        self._save_registry()
        return reg

    def isolate_corrupted(self, identity: MapIdentity) -> None:
        entry = self.get_entry(identity)
        if not entry:
            return
        key = identity.key()
        corrupt = self._root / "_corrupt" / key.replace("/", "_")
        corrupt.mkdir(parents=True, exist_ok=True)
        src = Path(entry.get("path") or "")
        if src.is_dir():
            try:
                shutil.move(str(src), str(corrupt / src.name))
            except OSError:
                pass
        self._registry.get("maps", {}).pop(key, None)
        self._save_registry()
