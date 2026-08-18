# MAP_MANAGER_AUDIT — workspace_v02

Audit date: 2026-08-18. Scope: `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02`.  
Method: code search only — no runtime inference.

---

## Executive summary

Map data flows from **Robokit `.smap` JSON** (on disk or downloaded via Robokit **4011**) into `dashboard_node.py` in-memory state, then to the UI via **`GET /api/state`**. There is **no `map_id` field** anywhere in this workspace. Map identity uses **ASCII map name** (`current_map`, `map_name`, `smap_file`). A real robot map download path exists (`sync_map_from_robot` → adapter `download_map_json` → Robokit 4011), but there is **no dedicated `GET /api/maps/download`** endpoint. **`GET /api/maps` is not registered** in `dashboard_node.py` (only referenced in an unapplied patch script).

---

## 1. `/api/state` — `map_id`, `current_map`

### CURRENT SOURCE

| Field | Present? | Source in code |
|-------|----------|----------------|
| `map_id` | **No** | Zero matches for `map_id` in workspace_v02 |
| `agv.current_map` | Yes | Robokit batch/diagnostic via `RealAdapter` → `RobotState.agv_state_dict()` (`models.py:185`); ROS `AgvStatus.current_map` via `_agv()` (`dashboard_node.py:146`) — ROS path skipped in demo/mock (`_on_agv` returns early at `1666-1667`) |
| `map.current_map` | Conditional | Set only after successful `sync_map_from_robot()` (`dashboard_node.py:1305`); **not** in initial `_state["map"]` init (`471-478`) |
| `meta.map_name` | Yes | From `load_smap_layers()` / stations JSON (`dashboard_node.py:1228-1231`, `1174-1177`) |
| `meta.map_file` | Yes | Smap filename (`dashboard_node.py:1231`, `1177`) |
| `map.smap_file` | Yes | Loaded smap basename (`dashboard_node.py:1241`) |

### CURRENT FORMAT

`/api/state` returns `dashboard_node.snapshot()` (`dashboard_node.py:3295-3300`). Map-related top-level keys (from `STATE_SCHEMA.md` and `_state` init):

```json
{
  "map": {
    "cloud": [{"x": number, "y": number}],
    "curves": [{"points": [{"x","y"}], "name", "class", "start", "end"}],
    "cloud_shown": number,
    "cloud_total": number,
    "cloud_internal": number,
    "curve_count": number,
    "smap_file": string,
    "header": object,
    "available": [{"file","name","current"} | {"file","bytes","path"}],
    "current_map": string  // only after robot sync
  },
  "stations": { "LM1": {"x","y","yaw","angle","type"} },
  "meta": { "map_name", "vehicle_model", "map_file" },
  "agv": { "current_map", ... },
  "laser": { "points", "source", "live_lidar", ... },
  "route": { "stations", "active", "index" },
  "route_task": { "running", "completed", "current", "next", "queue" }
}
```

### CURRENT API

- `GET /api/state` — full snapshot (`dashboard_node.py:3295-3300`)
- Poll interval in V2: 500 ms (`state_store.js:27`, `STATE_SCHEMA.md:5`)

### CURRENT LOCATION

State is held in `DashboardNode._state` (`dashboard_node.py:469-487`), updated by `_load_smap`, `sync_map_from_robot`, adapter polls, ROS callbacks (dev only).

### CURRENT CACHE

In-process only: `_map_cloud`, `_smap_raw`, `_smap_path`, `_current_robot_map` (`dashboard_node.py:506-514`).

### CURRENT RENDER PATH

V2: `StateStore` → `V2Bootstrap` subscriber → `SceneRenderer.applyState(full)` (`bootstrap.js:48-55`).  
Legacy: `pollState()` → `render()` → `drawMap()` (`index.html:1566-1546`, `975+`).

### CURRENT MAP IDENTITY

- Primary: **map name string** (no numeric/hash id in web state)
- File identity: `map.smap_file` / `meta.map_file` (e.g. `20260723112931750.smap`)
- Robokit: `current_map` in API 1300 response (`robokit_client.py:605-607`, `real.py:248-262`)

### NEXT MAP SOURCE

Not defined in code. Boot loads `smap_file` ROS param / `SMAP_FILE` env / `DEFAULT_SMAP` (`dashboard_node.py:363`, `515-520`; `smap_sim.py:16`).

### UNKNOWN ITEMS

- Whether deployed NUC has `20260723112931750.smap` on disk (not in git repo; zero `*.smap` files in workspace_v02).

---

## 2. Robokit API map identity responses

### CURRENT SOURCE

| Layer | File | Lines |
|-------|------|-------|
| TCP client | `ros2_ws/src/agv_bridge/agv_bridge/robokit_client.py` | 34, 47-52, 603-629 |
| Real adapter | `ros2_ws/src/agv_bridge/agv_bridge/agv_adapter/real.py` | 248-282, 309-311 |
| Mock server | `ros2_ws/src/agv_bridge/agv_bridge/robokit_mock_server.py` | 156-201, 656-659 |
| Dashboard sync | `ros2_ws/src/delivery_web/delivery_web/dashboard_node.py` | 1275-1306 |

### CURRENT FORMAT

| Robokit API | Port | Method | Response shape (from code) |
|-------------|------|--------|---------------------------|
| 1300 `get_map_info` | 19204 | `get_map_info()` | `{ current_map: string, maps: string[] \| map_files_info[] }` (`real.py:248-262`; mock: `robokit_mock_server.py:156-161`) |
| 1301 `get_station_list` | 19204 | `get_station_list()` | `{ stations: [{id,x,y,r,desc,type}] }` (`real.py:284-298`) |
| 2022 `switch_map` | 19205 | `switch_map(map_name)` | `{ ret_code, err_msg? }` |
| 4011 `download_map` | 19207 | `download_map(map_name)` | **Full smap JSON** (same structure as `.smap` file) (`dashboard_node.py:1292-1297`) |
| 4010 `upload_map` | 19207 | `upload_map(smap_json)` | `{ ret_code, map_name? }` |
| 2025 `upload_and_switch` | 19205 | `upload_and_switch_map(smap_json)` | `{ ret_code, err_msg? }` |
| 1022 map load status | 19204 | `get_map_load_status()` | Used in `diag_snapshot` (`real.py:309-311`, `dashboard_node.py:2413-2416`) |

`MapInfo` model: `{ name: string, is_current: bool }` — no separate id field (`agv_adapter` usage at `dashboard_node.py:1016-1025`).

### CURRENT API (web exposure)

Robot map ops are wrapped in dashboard methods, not raw Robokit:

- `sync_map_from_robot()` — 1300 + 4011 + local write + `_load_smap`
- `switch_robot_map()` — 2022 + `sync_map_from_robot`
- `_commit_smap_edit()` — local save + optional 2025

### BACKEND CAPABILITY MISSING

- **No** public `GET /api/maps` list endpoint in live `dashboard_node.py` (patch-only in `apply_phase3_patch.py:265-267`).
- **No** standalone download-by-name HTTP API; download is embedded in `sync_map_from_robot`.
- `AgvApiAdapter` base class still raises `NotImplementedError` for map methods (`base.py:104-125`) — only `RealAdapter` / `MockAdapter` (extends Real) implement them.

---

## 3. `.smap` file usage

### CURRENT SOURCE

| Component | File | Role |
|-----------|------|------|
| Load layers | `delivery_web/smap_sim.py` | `load_smap_layers()` — parses JSON |
| Load raw | `delivery_web/smap_editor.py` | `load_smap_file()` — `json.loads` |
| Dashboard | `dashboard_node.py` | `_load_smap()`, `_commit_smap_edit()` |
| Sim node | `agv_bridge/agv_sim_node.py` | Optional direct `.smap` parse (`63+`) |

### CURRENT FORMAT

Roboshop/Robokit JSON (UTF-8, optional BOM). Key fields used:

| Smap key | Usage | Code |
|----------|-------|------|
| `header` | `mapName`, `minPos`, `maxPos`, `resolution`, `mapType` | `smap_sim.py:62-67, 102-107` |
| `normalPosList` | Point cloud `{x,y}` | `smap_sim.py:78-84` |
| `advancedPointList` | Stations (`instanceName`, `pos`, `dir`, `className`) | `smap_sim.py:64-76`, `smap_editor.py:190-205` |
| `advancedCurveList` | Path curves (Bezier sampling) | `smap_sim.py:86-96` |

Default filename constant: `20260723112931750.smap` (`smap_sim.py:16`).

### CURRENT LOCATION

Read order in `_load_smap`: `_writable_maps_dir()` then `_maps_dir` (`dashboard_node.py:1202-1206`).

- `_maps_dir` default: `/data/agv_downloaded/maps` (`smap_sim.py:15`, param `maps_dir` `dashboard_node.py:362`)
- Writable: `MAPS_RW_DIR` → default `/opt/delivery_ws/maps_rw`, fallback `/tmp/agv_maps_rw` (`dashboard_node.py:1184-1197`)
- **No `.smap` files in git** under workspace_v02; only `stations_from_smap.json` ships in repo.

### CURRENT CACHE

Downloaded smap written to writable dir: `path.write_text(json.dumps(raw,...))` (`dashboard_node.py:1295-1297`).

---

## 4. `stations_from_smap.json` generation

### CURRENT SOURCE

| Trigger | Function | File:lines |
|---------|----------|------------|
| After `_load_smap` | `stations_json_from_layers(layers)` written to `stations_file` param | `dashboard_node.py:1213-1218` |
| Smap edit | `stations_from_smap(updated)` | `dashboard_node.py:1339`, `smap_editor.py:190-205` |
| Manual station API | Writes stations JSON directly | `dashboard_node.py:1610-1635` |
| agv_sim_node boot | `load_stations(path)` reads JSON | `agv_sim_node.py:34-59` |

### CURRENT FORMAT

```json
{
  "map_file": "20260723112931750.smap",
  "map_name": "20260723112931750",
  "vehicle_model": "AMB-150",
  "stations": { "LM1": { "x", "y", "yaw" } }
}
```

Repo copy: `ros2_ws/src/agv_bridge/config/stations_from_smap.json` (LM1–LM10).  
Docker: copied to `/data/agv_downloaded/maps/stations_from_smap.json` (`docker/Dockerfile.lite:70`).

### CURRENT LOCATION

Default param: `/data/agv_downloaded/maps/stations_from_smap.json` (`dashboard_node.py:359-360`).  
Production deploys often use `/opt/delivery_ws/maps_rw/stations_from_smap.json` (release scripts).

### UNKNOWN ITEMS

Generation is skipped if `stations_path.parent` is not writable (`dashboard_node.py:1215` — silent `except`).

---

## 5. Map file locations (summary)

| Path | Purpose | Code reference |
|------|---------|----------------|
| `/data/agv_downloaded/maps` | Default read-only maps dir | `smap_sim.py:15` |
| `/opt/delivery_ws/maps_rw` | Writable overlay (`MAPS_RW_DIR`) | `dashboard_node.py:1186` |
| `/tmp/agv_maps_rw` | Writable fallback | `dashboard_node.py:1187, 1197` |
| `stations_from_smap.json` | Stations sidecar | param `stations_file` |
| `SMAP_FILE` env | Boot smap override | `dashboard_node.py:363` |
| `ros2_ws/src/agv_bridge/config/stations_from_smap.json` | Repo template | Dockerfile COPY |

---

## 6. Point cloud sources

### CURRENT SOURCE

| Mode | Source | `laser.source` | Code |
|------|--------|----------------|------|
| demo/mock + adapter connected | Robokit live lidar API 1009 | `robokit_1009` | `dashboard_node.py:2244-2271` |
| dev (or demo lidar fail) | Raycast against `_map_cloud` + obstacles | `smap_cloud+obstacles` or `sim_stub` | `dashboard_node.py:2195-2304`, `smap_sim.py:180-207` |
| Map cloud for UI | `normalPosList` downsampled | — | `smap_sim.py:78-84`, `dashboard_node.py:1222-1236` |

### CURRENT FORMAT

- Full cloud: `List[Dict[str,float]]` with `x`, `y` in `_map_cloud`
- UI cloud: downsampled to ~1800 points (`dashboard_node.py:1224-1225`)
- Snapshot laser: further downsampled ≤900 live / ≤360 static (`dashboard_node.py:1870-1875`)

### CURRENT CACHE

`_map_cloud` holds full in-memory cloud separate from `state.map.cloud` UI sample (`dashboard_node.py:1227, 2198`).

---

## 7. SceneRenderer map loading (`www/v2/`)

### CURRENT SOURCE

`ros2_ws/src/delivery_web/www/v2/scene/scene_renderer.js`

### CURRENT FORMAT

Canvas 2D Overview — **no HTTP calls** (`scene_renderer.js:2`). Layers: map cloud, curves, lidar, stations, AGV (`scene_renderer.js:12, 51-114`).

### CURRENT RENDER PATH

1. `StateStore` polls `/api/state` (`state_store.js:26, 123`)
2. `V2Bootstrap.start()` subscribes `*` → `SceneRenderer.applyState(full)` (`bootstrap.js:48-55`)
3. `SceneState.apply()` extracts `map.cloud`, `map.curves` (`scene_state.js:27-31`)
4. RAF loop calls `render()` (`bootstrap.js:59-63`)

### CURRENT MAP IDENTITY

Renderer does not read `smap_file` or `current_map` — only cloud/curves geometry.

### Scripts loaded

`index.html:732-741` — `APP_MODE = 'V2'`, scene stack scripts.

---

## 8. Overview component map usage

### V2 Overview (active)

- Canvas: `#v2SceneCanvas` (`index.html:457`)
- Renderer: `SceneRenderer` (see §7)
- HUD shows camera mode, not map name (`bootstrap.js:155-165`)

### Legacy Overview (hidden in V2)

- Canvas: `#map` inside `#legacyMain` (`index.html:470-471`)
- `drawMap()` reads `state.map.cloud/curves` (`index.html:975-1000`)
- Hidden via `legacy-hidden` when V2 boots (`bootstrap.js:33-34`)

### CURRENT LOCATION

Both paths consume the same `/api/state` map object; V2 does not call `drawMap()` or `renderMapSelect()` on poll.

---

## 9. BEV interfaces

### CURRENT SOURCE

| File | What exists |
|------|-------------|
| `camera_controller.js:7` | `MODES = { OVERVIEW, THIRD_PERSON, BEV, CAMERA }` |
| `view_controller.js` | `setMode()` delegates to `CameraController.setMode()` — no BEV-specific logic |
| `scene_renderer.js` | Single Overview renderer only |
| `REAL_WEB_V2_ARCHITECTURE.md` | BEV deferred to Phase 3 |
| `PHASE2_POC_REPORT.md:55,80` | "BEV / Third Person — stubbed" |

### CURRENT RENDER PATH

`worldToScreen()` orthographic projection only (`camera_controller.js:83-88`) — same for all modes; **no mode branch in renderer**.

### UNKNOWN ITEMS

No WebGL BEV implementation in workspace_v02.

---

## 10. Route / task map info

### CURRENT SOURCE

`dashboard_node.py` — `route`, `_route_task`, navigation via adapter/ROS.

### CURRENT FORMAT

- `state.route`: `{ stations: string[], active: bool, index: number }` (`481`, `1536-1544`)
- `state.route_task`: `{ running, completed, current, next, queue, task_id?, success? }` (`490`, `1642-1663`)
- `SceneState.targetId` from `route_task.current` or `agv.target_id` (`scene_state.js:38-40`)

### CURRENT API

| Endpoint | Purpose | Lines |
|----------|---------|-------|
| `GET /api/route`, `GET /api/sim/route` | Read route | 3361-3362 |
| `GET /api/route/status` | route + route_task | 3281-3282 |
| `POST /api/sim/route` | set/run route | 3759+ |

### Map coupling

**None in code** — routes reference station IDs only; no `map_name` / `smap_file` on route objects. Stations come from current loaded map state.

---

## 11. Existing map download / list / switch APIs

### Registered in `dashboard_node.py`

| Method | Path | Handler | Lines |
|--------|------|---------|-------|
| GET | `/api/maps/robot` | `sync_map_from_robot()` | 3265-3267 |
| POST | `/api/maps/switch` | `switch_robot_map(map_name)` | 3645-3650 |
| POST | `/api/maps/refresh` | `sync_map_from_robot()` | 3652-3653 |
| GET | `/api/sim/maps` | `list_maps()` | 3355-3356 |

### `list_maps()` return shape (`1262-1270`)

```json
{
  "success": true,
  "maps_dir": "/data/agv_downloaded/maps",
  "available": [...],
  "current": "<smap_file basename from state.map.smap_file>"
}
```

### `sync_map_from_robot()` logic (`1275-1308`)

| `env.mode` | Behavior |
|------------|----------|
| `dev` | Returns `{ success, message: "dev uses local smap", source: "local" }` — **no download** |
| demo/mock | 1300 → 4011 → write `.smap` to writable dir → `_load_smap` |

### NOT registered (but referenced elsewhere)

- `GET /api/maps` — only in `apply_phase3_patch.py:265-267`, **not** in `dashboard_node.py`
- Frontend `POST /api/maps/robot` (`index.html:1577`) — **mismatch**: server only handles **GET** for this path

### BACKEND CAPABILITY ASSESSMENT

| Capability | Status |
|------------|--------|
| List maps (local dir) | Yes — `/api/sim/maps`, `list_smaps()` |
| List maps (robot 1300) | Yes — via `_robot_map_options()` when adapter connected |
| Switch map (robot 2022) | Yes — `POST /api/maps/switch` |
| Download map (robot 4011) | Yes — inside `sync_map_from_robot`, not standalone GET |
| Dedicated download API | **Missing** as separate HTTP endpoint |

---

## 12. Existing map cache

### In-memory (`dashboard_node.py`)

| Field | Content |
|-------|---------|
| `_map_cloud` | Full point cloud from smap |
| `_smap_raw` | Parsed smap dict |
| `_smap_path` | Path to loaded/edited smap |
| `_current_robot_map` | Last synced robot map name string |
| `_state["map"]` | UI-facing map slice including downsampled cloud |

### On disk

| Artifact | When written |
|----------|--------------|
| `{map_name}.smap` in `MAPS_RW_DIR` | After successful 4011 download (`1295-1297`) |
| `stations_from_smap.json` | After `_load_smap` if parent writable (`1216-1218`) |
| Edited smap | `_commit_smap_edit` → `save_smap_file(write_path)` (`1334-1335`) |

### No explicit cache layer

No TTL, no map versioning hash, no client-side map file cache beyond `fetch(..., cache: 'no-store')` on state poll.

---

## 13. `dashboard_node.py` map handling (control flow)

```
Boot
  ├─ param maps_dir, smap_file, stations_file (359-363, 511-520)
  ├─ Thread: _load_smap(smap_arg) (516-520)
  └─ demo/mock: Thread _boot_map_sync → sync_map_from_robot (530-536, 999-1008)

_load_smap(name)
  ├─ Resolve path: writable dir → maps_dir (1202-1206)
  ├─ load_smap_file + load_smap_layers (1210-1212)
  ├─ Write stations_from_smap.json (1213-1218)
  ├─ _map_cloud = full cloud; state.map.cloud = UI sample (1222-1246)
  └─ state.meta, state.stations updated

sync_map_from_robot()
  ├─ dev → local only (1278-1279)
  ├─ get_maps + get_current_map (1285-1287)
  ├─ download_map_json → write .smap (1292-1297)
  └─ _load_smap + map.current_map (1299-1305)

switch_robot_map()
  ├─ dev → set_map local file (1313-1314)
  └─ demo → switch_map 2022 → sync_map_from_robot (1319-1323)

HTTP snapshot
  └─ GET /api/state → snapshot() (3295-3300) — map from _state unchanged except laser downsampling
```

Env is **forced to demo** at boot and in `_public_env()` (`384`, `1576`, `2144-2147`).

---

## 14. `index.html` map dropdown / refresh UI

### UI elements

| Element | Location | Purpose |
|---------|----------|---------|
| `#mapSel` | `index.html:433` | Map dropdown |
| `#btnRefreshMap` | `index.html:434` | "刷新地图" button |
| `#hdrMeta` | `index.html:439` | Shows `meta.map_name · vehicle_model` (`1204`) |
| `#mapOverlay` | `index.html:472` | Legacy map overlay (`1220`) |

### `renderMapSelect()` (`1524-1535`)

- Options from `state.map.available`
- Selected value from `state.map.smap_file`
- Label from `x.name` or filename without `.smap`

### `btnRefreshMap` (`1734-1743`)

- If dropdown has value → `POST /api/maps/switch` with `map_name` (stripped `.smap`)
- Else → `POST /api/maps/refresh`
- Then `pollState()`

### First-load robot sync (`1575-1580`)

- On first `pollState()` success, `POST /api/maps/robot` then re-poll
- **Only runs when `pollState()` runs** (legacy path)

### V2 interaction gap

- `APP_MODE = 'V2'` (`index.html:732`)
- `bootApp()` calls `V2Bootstrap.start()` and **does not** call `pollState()` (`1914-1917`)
- `setInterval` skips `pollState` when V2 (`1904`)
- StateStore drives scene; **header `renderMapSelect()` is not invoked from V2 bootstrap** (only `renderHeader()` at `bootstrap.js:56`)
- Map dropdown may stay empty until manual refresh unless `state.map.available` was populated at boot `_load_smap`

### UNKNOWN ITEMS

Whether `mapSel` `change` handler exists — **no** `mapSel.onchange` in grep; only button-driven refresh.

---

## Cross-reference matrix

| Topic | CURRENT SOURCE | CURRENT FORMAT | CURRENT LOCATION | CURRENT API | CURRENT CACHE | CURRENT RENDER PATH | CURRENT MAP IDENTITY |
|-------|----------------|----------------|------------------|-------------|---------------|---------------------|----------------------|
| State map geometry | `smap_sim.load_smap_layers` | `{x,y}` arrays | `_state.map`, `_map_cloud` | `/api/state` | `_map_cloud` | SceneRenderer / drawMap | `smap_file`, `meta.map_name` |
| Robot map name | Robokit 1300 / batch 1100 | string `current_map` | `agv.current_map`, `map.current_map`* | diag `/api/diag/snapshot` | `_current_robot_map` | hdrMeta (name only) | ASCII map name |
| Stations | smap `advancedPointList` | id → {x,y,yaw} | `_state.stations`, JSON file | `/api/stations` | in `_state` | SceneRenderer stations layer | station id (LM*) |
| Map list | `list_smaps` or 1300 | file/name/current | `map.available` | `/api/sim/maps` | — | `#mapSel` options | file basename |
| Download | Robokit 4011 | smap JSON | `MAPS_RW_DIR/*.smap` | embedded in sync | disk + `_smap_raw` | — | map name |
| Live lidar | Robokit 1009 | `{x,y}[]` | `_state.laser` | `/api/state` | — | lidar layer | — |

\*`map.current_map` only after sync.

---

## Files index (map-related)

| Absolute path |
|---------------|
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\delivery_web\dashboard_node.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\delivery_web\smap_sim.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\delivery_web\smap_editor.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\robokit_client.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\robokit_mock_server.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\agv_adapter\real.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\agv_adapter\base.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\agv_adapter\models.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\agv_sim_node.py` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\config\stations_from_smap.json` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\index.html` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\v2\scene\scene_renderer.js` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\v2\scene\scene_state.js` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\v2\scene\camera_controller.js` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\v2\app\bootstrap.js` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\v2\store\state_store.js` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\release\STATE_SCHEMA.md` |
| `C:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\docker\Dockerfile.lite` |

---

## Gaps / risks (code-evidenced)

1. **`map_id` does not exist** — any Map Manager expecting numeric id needs new schema.
2. **`GET /api/maps` missing** — list only via `/api/sim/maps` or `state.map.available`.
3. **No standalone download endpoint** — must use sync/refresh/switch flows.
4. **`POST /api/maps/robot` vs `GET /api/maps/robot`** — frontend POST likely 404 on first-load sync in legacy mode.
5. **V2 skips `pollState()`** — boot robot sync and `renderMapSelect()` may not run; scene still gets map from StateStore if boot `_load_smap` succeeded.
6. **No `.smap` in repo** — dev depends on container mount or manual placement under `/data/agv_downloaded/maps`.
7. **BEV / Third Person** — mode constants only; no alternate render path.
