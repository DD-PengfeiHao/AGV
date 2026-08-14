# AGV Web Phase 3 — P1-A Implementation Report

**Date:** 2026-08-13  
**Scope:** Adapter Interface + DTOs + Factory + minimal dashboard integration  
**Baseline:** P0 Freeze `AGV_WEB_PHASE3_PHASEB_P0_FREEZE_20260813/` (read-only, untouched)

---

## 1. Modified Files

| File | Change |
|------|--------|
| `migration_implementation/workspace_v02/ros2_ws/src/delivery_web/delivery_web/dashboard_node.py` | Replaced direct `RobokitClient` usage with `AgvApiAdapter`; added `_init_adapter`, `_ensure_adapter`, mock mode in `set_env`; demo laser/nav/cancel via adapter |
| `migration_implementation/workspace_v02/ros2_ws/src/agv_bridge/setup.py` | Register `agv_bridge.agv_adapter` subpackage |

## 2. New Modules

Package: `agv_bridge/agv_adapter/`

| Module | Purpose |
|--------|---------|
| `models.py` | DTOs: `RobotPose`, `LaserPoint`, `LaserScan`, `NavigationStatus`, `MapInfo`, `Station`, `RobotState` |
| `config.py` | `AgvAdapterConfig` |
| `base.py` | Abstract `AgvApiAdapter` interface |
| `laser_utils.py` | Robokit 1009 → `LaserScan` transform (moved from dashboard) |
| `real.py` | `RealAdapter` — wraps `RobokitClient` for demo mode |
| `dev.py` | `DevAdapter` — no TCP; ROS pose + smap sim laser remain in dashboard |
| `mock.py` | `MockAdapter` placeholder — extends `RealAdapter`, connects to `mock_host` |
| `factory.py` | `create_agv_adapter(mode, config)` |
| `__init__.py` | Public exports |

Also copied full `agv_bridge` package from P0 freeze into `migration_implementation/.../src/agv_bridge/` (robokit_client, mock server, nodes unchanged).

---

## 3. Adapter Interface (`AgvApiAdapter`)

**Implemented in P1-A:**

| Method | Dev | Demo | Mock |
|--------|-----|------|------|
| `connect(host)` / `disconnect()` | no-op OK | Robokit TCP | Robokit TCP → mock_host |
| `get_pose()` | empty DTO | Robokit 1004 | same as demo |
| `get_laser()` | stub message | Robokit 1009 → DTO | same |
| `get_task_status()` | empty | Robokit 1020 | same |
| `poll_robot_state()` | partial | full bundle | same |
| `goto_station()` | N/A (ROS) | Robokit 3051 | same |
| `cancel_navigation()` | N/A (ROS) | Robokit 3003 | same |
| `wait_navigation_done()` | — | poll 1020 | same |
| `lock()` / `unlock()` | — | Robokit 4005/4006 | same |
| `relocate()` / `wait_reloc_done()` | — | 2002/1021/2003 | same |

**Defined, not implemented (future P1-B/E/F):**

- `get_maps()`, `get_current_map()`, `switch_map()`, `get_stations()`, `navigate_path()`
- `upload_map()`, `download_map()`, `upload_and_switch_map()`
- `dynamic_obstacle_add()`, `dynamic_obstacle_add_world()`, `dynamic_obstacle_remove()`

---

## 4. DTO List

| DTO | Fields (summary) |
|-----|------------------|
| `RobotPose` | x, y, angle, confidence, current_station, last_station, vehicle_id |
| `LaserPoint` | x, y |
| `LaserScan` | ok, points[], beam_count, source, message |
| `NavigationStatus` | task_status, task_type, target_id, finished_path, unfinished_path |
| `MapInfo` | name, path, is_current |
| `Station` | id, x, y, name, type |
| `RobotState` | pose, navigation, laser, battery_level, charging, connected, host, mode + helpers `agv_state_dict()`, `laser_state_dict()` |

All adapters return the same DTO types; dashboard converts DTOs to existing JSON shape via `RobotState` helpers.

---

## 5. Factory Logic

```python
create_agv_adapter(mode, config) -> AgvApiAdapter
```

| `mode` | Returns | Connect target |
|--------|---------|----------------|
| `dev` | `DevAdapter` | N/A |
| `demo` | `RealAdapter` | `config.agv_host` (default 192.168.18.198) |
| `mock` | `MockAdapter` | `config.mock_host` (default 127.0.0.1) |

`AgvAdapterConfig`: `agv_host`, `mock_host`, `timeout`, `laser_max_points`, `maps_dir`, `lock_nickname`.

---

## 6. `dashboard_node.py` Modification Points

| Area | Before | After |
|------|--------|-------|
| Import | `RobokitClient` | `create_agv_adapter`, `AgvAdapterConfig` |
| State | `self._rk` | `self._agv_adapter` |
| Boot | `_ensure_robokit()` | `_init_adapter()` + `_ensure_adapter()` for demo/mock |
| `set_env` | dev/demo/prod | + `mock`; lock/unlock via adapter |
| `_laser_tick` demo | `_rk.get_pose/get_laser/...` + `_laser_points_from_robokit` | `_agv_adapter.poll_robot_state()` |
| `navigate` demo | `_rk.*` | `_agv_adapter.get_pose/relocate/goto_station/wait_*` |
| `cancel` demo | `_rk.cancel_nav()` | `_agv_adapter.cancel_navigation()` |
| Laser transform | inline 40 lines | moved to `agv_adapter/laser_utils.py` |

Dev path unchanged: ROS `agv/status` subscription + `_laser_sim_stub()` + smap map loading.

---

## 7. Dev Test Results (172.31.0.111:19999)

| Test | Result |
|------|--------|
| Dashboard starts | **PASS** |
| `GET /api/state` HTTP 200 | **PASS** |
| AGV status (Gazebo) | **PASS** — x=6.26, y=-0.659, LM1, battery 93% |
| Map canvas data | **PASS** — smap loaded, stations present |
| Laser point cloud | **PASS** — `source=smap_cloud+obstacles`, 100 beams |
| `GET /api/jason/camera/status` | **PASS** — OFFLINE (hardware), non-blocking |
| Camera offline non-blocking | **PASS** — page loads, Jason shows LOADING/OFFLINE |
| `GET /api/jason/camera/snapshot` | **404** when no frame (expected P0 behavior, not regression) |
| Main page MJPEG stream | **PASS** — `streamReqs=0`, `pollJasonSnapshot` present |
| `document.readyState` | **PASS** — `complete` |

Build on VM: `colcon build --packages-select agv_bridge delivery_web` — **SUCCESS**.

---

## 8. Demo Test Results

AGV **192.168.18.198 reachable** from container (ping OK).

| Test | Result |
|------|--------|
| `POST /api/env {"mode":"demo"}` | **PASS** — `adapter=ok`, `robokit_ok=true` |
| Real laser via adapter | **PASS** — `source=robokit_1009`, `beam_count=720`, `agv_host=192.168.18.198` |
| Restore dev mode | **PASS** |

---

## 9. P0 Regression Tests

| P0 Item | Result |
|---------|--------|
| No MJPEG on main page load | **PASS** |
| Snapshot endpoint exists | **PASS** (route at line ~1729) |
| Stream backend unchanged | **PASS** (not invoked by main page) |
| `/api/state` stable | **PASS** |
| Jason OFFLINE graceful | **PASS** |

---

## 10. Regressions

**None identified** for P1-A scope.

Note: In demo mode, ROS `agv/status` subscription can still overwrite AGV fields until `_laser_tick` refreshes from adapter (~1 Hz). This is pre-existing dual-source behavior; P1-B should gate `_on_agv` updates when `mode != dev`.

---

## 11. Known Issues

1. **Demo + ROS pose race** — Gazebo `/agv/status` may briefly show `mode:gazebo` while env is demo until adapter poll updates (cosmetic in mixed sim+demo VM).
2. **Snapshot 404 when camera OFFLINE** — by design (`no frame`); P0 snapshot polling skips when OFFLINE.
3. **MockAdapter** — placeholder only; connects to mock TCP host but full mock behavior deferred to P1-C.
4. **Map/station Robokit APIs** — not wired; dashboard still uses local `.smap` via `smap_sim.py`.

---

## 12. Next Steps — P1-B Suggestions

1. **RealAdapter map layer** — implement `get_maps()`, `get_current_map()`, `switch_map()`, `get_stations()` via Robokit 1300/1301/2022.
2. **Gate ROS updates in demo** — skip `_on_agv` pose merge when `env.mode in (demo, mock)`.
3. **Migrate map UI** — route map list/switch through adapter instead of local smap-only path (keep smap fallback for dev).
4. **Env.json** — add `mock_host` field to `system_logger.load_env_file` / UI.
5. **P1-C MockAdapter** — full mock state machine aligned with DTOs (no raw JSON divergence).
6. **Unit tests** — `laser_utils.from_robokit`, DTO round-trip, factory mode selection.

---

**P1-A STATUS: COMPLETE — STOP (P1-B not started)**
