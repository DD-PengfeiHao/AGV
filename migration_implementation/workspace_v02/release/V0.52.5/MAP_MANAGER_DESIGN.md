# MAP_MANAGER_DESIGN — V0.52.5

## WHAT

MapManager V1 automates AGV map lifecycle: detect current map identity from AGV state, reconcile with persistent local cache, async download/prepare via Robokit 4011, preload next map when known, atomic switch to active render data. SceneRenderer consumes `activeMap` only — no manual dropdown.

## WHY

Fixed smap boot + manual refresh caused stale maps, 10s boot waits, V2 skipped legacy poll sync, and mismatch risk (showing map A while AGV is on map B).

## WHO depends

| Consumer | Usage |
|----------|-------|
| SceneState / SceneRenderer | `activeRender` geometry |
| Overview canvas | map cloud + curves or point-cloud fallback |
| BEV (stub) | same `activeMap` contract |
| Map Status component | user-visible status |
| Debug Map Inspector | admin timings/cache |
| BlackBox | map_manager events in EventStore |
| StateStore | single `/api/state` poll — MapManager subscribes, no second poll |

## WHEN (triggers)

**Event-driven:** AGV online, map id change, task/route change, download complete, load failure.

**Periodic:** 5s reconcile (backend timer + client mirror).

**Not:** 500ms poll, fixed `sleep(10)` boot protocol.

## WHERE (data)

| Layer | Location |
|-------|----------|
| AGV identity | `agv.current_map` (Robokit 1300 / batch) |
| Download | Robokit 4011 inside `sync_map_from_robot()` |
| Persistent cache | `~/Pengfei.Hao/maps/` (`MAP_CACHE_DIR`) |
| Runtime state | `snapshot().map_manager` |
| Render geometry | `state.map` after `_load_smap` |

## HOW

### MapIdentity

`map_id`, `name`, `version`, `hash`, `source`, `identity_quality` (`name_only` today — no `map_id` field in API).

### Same-map priority

1. hash 2. map_id+version 3. map_id/name — never filename alone.

### AGV online

From `agv.updated_at` age: <2s ONLINE, 2–5s DEGRADED, >5s OFFLINE (tuned after `/api/state` audit).

### State machine

`WAITING_FOR_AGV` → `CHECKING` → `CACHE_HIT` | `DOWNLOADING` → `VERIFY` → `PARSE` → `PREPARE` → `READY` → `ACTIVE`. Preload: `PRELOADING` → `READY`. Failure: `FAILED`, `MAP_MISMATCH`, `LIVE_POINT_CLOUD_ONLY`.

### Fallback

If mismatch or map unavailable: **no static map layers** — lidar + AGV pose only. Banner + corner label.

### READ ONLY

MapManager never sends cmd_vel, switch_map (2022), or navigation commands.

## API

| Method | Path | Role |
|--------|------|------|
| GET | `/api/map/status` | Manager status |
| GET | `/api/map/list` | Cache registry |
| GET | `/api/map/cache` | Cache stats |
| POST | `/api/map/preload` | Accept async preload job |
| POST | `/api/map/refresh` | Force current-map refresh |

Legacy `/api/maps/switch` retained for admin tooling but **removed from UI**.

## BACKEND CAPABILITY NOTE

Map **download exists** via Robokit 4011 embedded in `sync_map_from_robot`. There is **no standalone** `GET /api/maps/download` — MapManager wraps existing sync path. **No map version/hash from AGV API** — identity_quality remains `name_only` until Robokit exposes version.

## UI changes (V0.52.5)

- Removed: `#mapSel` dropdown, `#btnRefreshMap`
- Added: `system.map_status`, `debug.map_inspector`, `#v2MapBanner`
