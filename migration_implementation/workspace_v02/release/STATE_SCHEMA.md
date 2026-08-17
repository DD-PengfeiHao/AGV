# /api/state Schema Audit (V0.52.2)

> Source: `dashboard_node.py` → `snapshot()` + `_state` init  
> Endpoint: `GET /api/state` (auth required)  
> Poll interval (V2): 500ms

## Top-Level Fields

| Field | Type | Source | Update | Nullable | Notes |
|-------|------|--------|--------|----------|-------|
| `version` | string | dashboard | boot | no | e.g. `0.52.2` |
| `updated_at` | number | dashboard | each tick | no | Unix timestamp |
| `uptime_sec` | number | dashboard | snapshot | no | seconds since boot |
| `agv` | object\|null | ROS2/adapter | ~2Hz | **yes** | null when offline |
| `arms` | object | ROS2 | varies | no | `{left, right}` |
| `arm` | object | cache | snapshot | yes | alias cache, may be `{}` |
| `cameras` | object | ROS2 | varies | no | cam_front/left/right |
| `cameras_meta` | object | static+cfg | rare | no | device metadata |
| `camera_info` | object | ROS2 | snapshot | no | |
| `camera_streams` | object | internal | snapshot | no | jpeg keys |
| `face` | object | face bridge | ~1Hz | no | recognition state |
| `laser` | object | adapter/smap | 2Hz | no | points downsampled in snapshot |
| `map` | object | smap load | on map change | no | cloud, curves |
| `stations` | object | smap | on map change | no | `{id: {x,y,...}}` |
| `route` | object | internal | varies | no | `{stations, active, index}` |
| `route_task` | object | nav | varies | no | running/completed/current |
| `obstacles` | array | sim only | — | yes | Real mode usually `[]` |
| `alerts` | array | `_collect_system_alerts` | snapshot | no | system alerts |
| `events` | array | ring buffer | snapshot | no | last 40 events |
| `pose_history` | array | deque | snapshot | no | last 40 poses |
| `telemetry` | array | deque | snapshot | no | last 40 samples |
| `vision` | object | vision mgr | snapshot | yes | wrist/floor/leo |
| `env` | object | env+adapter | varies | no | mode, hosts, connected |
| `agv_link` | object | adapter | snapshot | no | link status |
| `meta` | object | map meta | varies | yes | map_name etc. |
| `nodes_health` | object | ROS2 | varies | no | |
| `hz` | object | rate stat | 1Hz | no | topic Hz |
| `ports` | object | static | boot | no | demo:19999, debug:1999 |
| `devices` | object | DeviceConfig | rare | no | public device cfg |
| `web_face_api` | number | env | boot | no | |
| `cargo` | null | — | — | yes | always null currently |

## `agv` Object (when connected)

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `x`, `y` | number | m | world pose |
| `angle` | number | rad | heading |
| `vx`, `vy` | number | m/s | velocity (if available) |
| `battery_level` | number | % | 0–100 |
| `task_status` | string | — | nav task state |
| `current_station` | string | — | LM id |
| `target_id` | string | — | nav target |
| `manual_block` | bool | — | safety block |
| `connected` | bool | — | |
| `blocked` | bool | — | motion blocked |

## `laser` Object

| Field | Type | Notes |
|-------|------|-------|
| `ok` | bool | |
| `live_lidar` | bool | true = real scan |
| `source` | string | `robokit*`, `smap_cloud+obstacles`, `none` |
| `points` | array | `{x,y}` downsampled ≤900 live / ≤360 static |
| `label` | string | human label set in snapshot |

## `map` Object

| Field | Type | Notes |
|-------|------|-------|
| `cloud` | array | `{x,y}` smap points |
| `curves` | array | path curves `{points:[{x,y}]}` |
| `cloud_total` | number | |
| `smap_file` | string | |
| `available` | array | map list |

## `alerts[]` Item

| Field | Type | Notes |
|-------|------|-------|
| `level` | string | info/warning/error |
| `code` | string | e.g. STATE_API_TIMEOUT |
| `message` | string | |
| `raw` | object | optional backend detail |

## V2 StateStore Keys

Subscribable paths used in Phase 2 PoC:

- `agv` — pose, velocity, task, manual_block
- `alerts` — forwarded to AlertQueue
- `navigation` — derived from `route`, `route_task`, `agv.target_id`
- `laser` — scene lidar layer
- `map` — scene map layer
- `system` — `version`, `uptime_sec`, `env`, `agv_link`
