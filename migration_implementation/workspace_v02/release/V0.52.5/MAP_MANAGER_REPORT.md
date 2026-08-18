# MAP_MANAGER_REPORT — V0.52.5 (dev-only, NUC not deployed)

> Date: 2026-08-18 | Version: 0.52.5 | Branch: development (not deployed to NUC per policy)

## 1. Current map source

| Source | Evidence |
|--------|----------|
| AGV identity | `agv.current_map` from Robokit 1300 / ROS `AgvStatus` |
| Map geometry | `.smap` JSON via `load_smap_layers()` |
| Download | Robokit **4011** inside `sync_map_from_robot()` |
| Boot default | `SMAP_FILE` param / `20260723112931750.smap` local load |

## 2. Map Identity source

- **No `map_id` field** in workspace_v02 APIs
- Identity = ASCII map name (`current_map`, `map_name`)
- `identity_quality`: **name_only** (not strong ID+version)

## 3. Map download source

- **Supported:** Robokit 4011 via `RealAdapter.download_map_json()`
- **Not supported as standalone HTTP:** no `GET /api/maps/download`
- **Dev mode:** `sync_map_from_robot` returns local-only — MapManager marks `download_supported=false`

## 4. Cache location

- Default: `~/Pengfei.Hao/maps/` (`MAP_CACHE_DIR` env override)
- Structure: `registry.json`, `{map_id}/source/*.smap`, `metadata.json`, `render/index.json`
- Reuses writable maps dir for download staging (`MAPS_RW_DIR`)

## 5. Active Map

- Backend: `MapManager._active` + `_load_smap()` updates `state.map`
- Frontend: `ClientMapManager.activeRender` → `SceneState.map`
- SceneRenderer draws active layers only when not in fallback mode

## 6. Next Map

- Detected from `route_task.next_map` / `planning.upcoming_maps` **if present**
- Current APIs: **usually null** (route has station IDs only, no map name)
- Preload: `POST /api/map/preload` when next identity known

## 7. Preload mechanism

- Single worker thread, one download at a time
- Priority: CURRENT > NEXT
- States: `PRELOADING` → `READY` (does not disturb active A until atomic swap)

## 8. Trigger mechanism

- Backend: 5s `create_timer` reconcile + event hooks via state changes
- Frontend: StateStore subscribe + 5s client reconcile
- **No second `/api/state` polling**

## 9. 5s reconcile

- Backend `_map_manager_tick` every 5s
- Client `setInterval(5000)` on StateStore snapshot

## 10. Point Cloud fallback

- When `MAP_MISMATCH`, `LIVE_POINT_CLOUD_ONLY`, or no verified map: hide map cloud/curves/stations; show lidar + AGV
- Banner: "当前地图不可用 — 使用实时点云"
- Corner label: `LIVE POINT CLOUD ONLY`

## 11. Overview integration

- `SceneRenderer` consumes `SceneState` from MapManager path
- No direct map API calls from renderer

## 12. BEV integration

- Same `activeMap` contract in `SceneState` — BEV renderer still stubbed (Phase 3)

## 13. BlackBox integration

- Map events emitted via `_push_event("map_manager", ...)`
- `snapshot/state.json` includes `map_manager` in blackbox light state feed

## 14–17. Measured timings

| Scenario | Status |
|----------|--------|
| Cache hit | **Not measured on hardware** — design target <500ms |
| Cache miss | **Not measured** — depends on Robokit 4011 + smap size |
| Download/verify/parse/prepare | Recorded in `timings_ms` when job completes |

## 18. Known issues

1. Map identity is name-only — hash computed locally after download, not from AGV
2. `POST /api/maps/robot` vs `GET` mismatch in legacy code (UI removed)
3. Next map rarely available from current route APIs
4. Dev mode cannot exercise full download path

## 19. Missing capabilities

| Item | Status |
|------|--------|
| AGV map version in API | **MISSING** |
| Standalone download HTTP API | **MISSING** (wrapped sync only) |
| Route→map prediction | **MISSING** (no map on route objects) |
| BEV renderer | **DEFERRED** |

## UI removal (per request)

- Removed header map `<select id="mapSel">`
- Removed `刷新地图` button
- Removed boot `POST /api/maps/robot` from legacy pollState
- Removed `_boot_map_sync` thread (MapManager reconcile replaces)

## Acceptance checklist

| Item | Dev |
|------|-----|
| No fixed 10s boot wait | ✅ |
| AGV offline → no false ACTIVE | ✅ |
| AGV online → detect current map | ✅ |
| Cache hit path | ✅ (code) |
| Async download | ✅ |
| No HTTP block on download | ✅ |
| Active stable during download | ✅ |
| Next preload | ✅ (when identity known) |
| Atomic switch | ✅ |
| Mismatch → no old map | ✅ |
| No map → point cloud only | ✅ |
| No 2nd state poll | ✅ |
| Exception isolation | ✅ try/catch |
| Persistent cache | ✅ |
| No map forgery | ✅ |

**NUC deploy:** intentionally **not performed** (NUC remains V0.52.1 baseline).
