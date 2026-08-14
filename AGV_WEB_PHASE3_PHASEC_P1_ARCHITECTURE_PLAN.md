# AGV Web Phase 3 — Phase C P1 Architecture Plan

**Date:** 2026-08-13  
**Prerequisite:** Phase B P0 frozen at `AGV_WEB_PHASE3_PHASEB_P0_FREEZE_20260813/`  
**Scope:** Architecture design only — **no implementation in this document**

---

## 0. Executive Summary

Phase C introduces a **unified AGV API Adapter layer** between Web business logic and three runtime backends:

| Mode | Backend | Purpose |
|------|---------|---------|
| `dev` | Gazebo / ROS (`agv_gazebo_nav`, local smap) | Simulation without Robokit |
| `demo` | Real Robokit TCP (`RobokitClient`) | Production AGV |
| `mock` | Robokit TCP Mock (`robokit_mock_server` extended) | Offline Web development |

Business code (`dashboard_node`, future services) talks only to **`AgvApiAdapter`**. Mode selection via `env.json` + factory.

---

## 1. Phase B Freeze Confirmation

| Item | Location | Files |
|------|----------|-------|
| Full workspace | `AGV_WEB_PHASE3_PHASEB_P0_FREEZE_20260813/workspace_v02/` | 124 source files |
| VM deployed snapshot | `.../deployed_vm_172.31.0.111/` | P0 `index.html`, `dashboard_node.py` |
| API docs (complete) | `.../AGVAPI文档_ref/TCP_IP_API/` | 217 docx + `API概览.xlsx` |
| Reports | `.../reports/` | Phase 3 test reports |
| Device template | `.../config/devices.template.yaml` | IPs only, no secrets |

**Note:** Local `C:\Users\Administrator\Cursor\AGV\AGVAPI文档\` contains markdown subset only. Full docx/xlsx live on VM and are archived in freeze ref.

---

## 2. API Documentation Scan (from `API概览.xlsx` + docx)

Source: VM `/home/ubuntu/Pengfei.Hao/AGVAPI文档/.../TCP、IP API/API概览.xlsx`

### 2.1 Target API Registry

| API | Name | Port | Req | Res | Key Request | Key Response |
|-----|------|------|-----|-----|-------------|--------------|
| **1004** | robot_status_loc_req | 19204 | 1004 | 11004 | (empty) | `x,y,angle,confidence,current_station,...` |
| **1009** | robot_status_laser_req | 19204 | 1009 | 11009 | `{return_beams3D?}` | `lasers[].beams[], install_info` |
| **1020** | robot_status_task_req | 19204 | 1020 | 11020 | `{simple?}` | `task_status, target_id, finished_path,...` |
| **1300** | robot_status_map_req | 19204 | 1300 | 11300 | (empty) | `current_map, maps[], map_files_info[]` |
| **1301** | robot_status_station_req | 19204 | 1301 | 11301 | (empty) | `stations[{id,type,x,y,r,desc}]` |
| **2022** | robot_control_loadmap_req | 19205 | 2022 | 12022 | `{map_name}` | `ret_code` — ASCII map name only |
| **2025** | robot_control_upload_and_loadmap_req | 19205 | 2025 | 12025 | **raw smap JSON body** | `ret_code` — uploads + switches |
| **3051** | robot_task_gotarget_req | 19206 | 3051 | 13051 | `{id, source_id?, ...}` | `ret_code` |
| **3066** | robot_task_gotargetlist_req | 19206 | 3066 | 13066 | `{move_task_list:[{id,source_id,task_id}]}` | `ret_code` |
| **4010** | robot_config_uploadmap_req | 19207 | 4010 | 14010 | **raw smap JSON body** | `ret_code` — upload only |
| **4011** | robot_config_downloadmap_req | 19207 | 4011 | 14011 | `{map_name}` | **raw smap JSON** or error JSON |
| **4350** | robot_config_addobstacle_req | 19207 | 4350 | 14350 | `{name,x1..y4}` robot frame | `ret_code` |
| **4351** | robot_config_addgobstacle_req | 19207 | 4351 | 14351 | world frame rect | `ret_code` |
| **4352** | robot_config_removeobstacle_req | 19207 | 4352 | 14352 | `{name}` | `ret_code` |
| **9300** | robot_push_config_req | **19301** | 9300 | 19300 | `{interval, included_fields?, excluded_fields?}` | `ret_code` |
| **4091** | robot_config_push_req | 19207 | 4091 | 14091 | (config push on status port) | alt push config |
| **19301** | robot_push | **19301 TCP** | N/A | N/A | **Server push** — not req/resp | JSON: `x,y,angle,vx,vy,...` |

### 2.2 Critical Clarifications (doc-confirmed)

1. **19301 is a TCP port**, not a request API number. Push message type is `robot_push`.
2. **9300** configures push interval/fields on port **19301** (not 19204).
3. **4011 success** returns raw smap JSON in response body (not wrapped in `{ret_code:0}` only).
4. **2025 vs 4010:** 4010 uploads to storage; 2025 uploads **and** switches current map; 2022 switches existing map by name.
5. **3051 vs 3066:** 3051 single target navigation; 3066 ordered `move_task_list` with mandatory `task_id, id, source_id`.
6. **1301 stations** use `{id, type, x, y, r, desc}` — aligns with smap LocationMark concept.
7. **Map names:** ASCII only `[0-9a-zA-Z-]`, no Chinese (doc + 2022/4011).

### 2.3 3051 source_id Conflict (existing code vs doc)

| Source | Behavior |
|--------|----------|
| Official docx | `source_id` documented for path navigation |
| `robokit_client.py` | Omits `source_id` by default — real vehicle on 192.168.18.198 tested |
| **P1 resolution** | Adapter exposes both; RealAdapter default configurable per `AGV_3051_OMIT_SOURCE_ID=true`; MockAdapter follows doc |

---

## 3. Current Codebase Scan (`workspace_v02`)

### 3.1 Package Layout (frozen)

```
workspace_v02/ros2_ws/src/
├── agv_bridge/          robokit_client.py, robokit_mock_server.py, agv_bridge_node.py
├── delivery_web/        dashboard_node.py (monolith), jason_camera_web.py, smap_sim.py
├── delivery_gazebo/     gz_physics_proxy, agv_gazebo_nav, camera_gazebo_qr
├── face_bridge/         stub/remote_topics
├── camera_bridge/       ingress, xavier bridge
├── delivery_bringup/    jason_camera.launch.py, devices.yaml
└── delivery_interfaces/ ROS msgs/srvs
```

### 3.2 Current AGV Data Paths (to be replaced by Adapter)

| Mode | Pose | Laser | Map | Nav |
|------|------|-------|-----|-----|
| dev | ROS `/agv/status` | smap sim / stub | local smap dir | ROS `agv/navigate` |
| demo | Robokit 1004 poll | Robokit 1009 poll | local smap dir | Robokit 3051 |

**Gap:** No 1300/4011/2022/19301 in current code.

### 3.3 Existing Mock (`robokit_mock_server.py`)

Implements: 1004, 1007, 1009, 1020, 3051, 4005/4006, 50000 (internal ctrl)  
Missing: 1300, 1301, 2022, 2025, 4010, 4011, 3066, 4350-4352, 19301 push, 9300

---

## 4. Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Web UI (index.html) + HTTP handlers (dashboard_node)   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  Application Services (thin)                            │
│  MapService · NavService · RobotStateService · ...      │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  AgvApiAdapter (interface)                                │
│  + ConnectionState · timeout · retry policy             │
└───────┬─────────────────┬─────────────────┬─────────────┘
        │                 │                 │
┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────────────┐
│ DevAdapter   │  │ RealAdapter  │  │ MockAdapter          │
│ ROS/Gazebo   │  │ RobokitClient│  │ robokit_mock_server  │
│ + smap_sim   │  │ + 19301 sub  │  │ + push simulator     │
└──────────────┘  └──────────────┘  └──────────────────────┘
```

### 4.1 Separate Concerns (not in AgvApiAdapter)

| Component | Responsibility |
|-----------|----------------|
| `JasonCameraAdapter` | ROS topic → HTTP snapshot (existing bridge) |
| `FaceRecognitionAdapter` | ROS face_bridge / Leo Jetson |
| `MapRenderer` | Canvas, coordinate transform (frontend + smap parse) |

---

## 5. `AgvApiAdapter` Interface (P1-A)

```python
# agv_bridge/agv_adapter/base.py (proposed)

class ConnectionState(Enum):
    CONNECTED = "CONNECTED"
    CONNECTING = "CONNECTING"
    DISCONNECTED = "DISCONNECTED"
    ERROR = "ERROR"
    TIMEOUT = "TIMEOUT"

class AgvApiAdapter(Protocol):
    # lifecycle
    def connect(self) -> None: ...
    def close(self) -> None: ...
    def connection_state(self) -> ConnectionState: ...

    # state (1004, 1009, 1020)
    def get_pose(self) -> PoseSnapshot: ...
    def get_laser(self) -> LaserSnapshot: ...
    def get_task_status(self, simple: bool = False) -> TaskStatusSnapshot: ...

    # map (1300, 1301, 4011, 2022, 4010, 2025)
    def get_map_info(self) -> MapInfoSnapshot: ...      # 1300
    def get_stations(self) -> StationListSnapshot: ...   # 1301
    def download_map(self, map_name: str) -> bytes: ...  # 4011 → smap JSON bytes
    def switch_map(self, map_name: str) -> OpResult: ... # 2022
    def upload_map(self, smap_bytes: bytes) -> OpResult: ...        # 4010
    def upload_and_switch_map(self, smap_bytes: bytes) -> OpResult: ...  # 2025

    # nav (3051, 3066)
    def goto_station(self, req: GotoStationRequest) -> OpResult: ...
    def goto_station_list(self, req: GotoListRequest) -> OpResult: ...
    def cancel_nav(self) -> OpResult: ...

    # obstacles (4350, 4351, 4352)
    def add_obstacle_robot(self, req: ObstacleRobot) -> OpResult: ...
    def add_obstacle_world(self, req: ObstacleWorld) -> OpResult: ...
    def remove_obstacle(self, name: str) -> OpResult: ...

    # push (19301 + 9300)
    def configure_push(self, cfg: PushConfig) -> OpResult: ...  # 9300 on 19301
    def subscribe_push(self, callback: Callable[[PushSnapshot], None]) -> PushSubscription: ...
```

**DTOs** in `agv_bridge/agv_adapter/models.py` — typed dataclasses mirroring docx fields, not raw dicts in business layer.

### 4.2 Factory

```python
# agv_bridge/agv_adapter/factory.py
def create_adapter(mode: str, config: AgvAdapterConfig) -> AgvApiAdapter:
    if mode == "dev":
        return DevAdapter(config)
    if mode == "demo":
        return RealAdapter(RobokitClient(...), config)
    if mode == "mock":
        return MockAdapter(host=config.mock_host, config)
    raise ValueError(f"unknown mode: {mode}")
```

`env.json` schema extension:

```json
{
  "mode": "dev|demo|mock",
  "agv_host": "192.168.18.198",
  "mock_host": "127.0.0.1",
  "use_sim_cameras": true
}
```

---

## 6. Adapter Implementations (P1-B … P1-F)

### P1-B: RealAdapter

- Wrap existing `RobokitClient` — extend with 1300/1301/4010/4011/2022/2025/3066/4350-4352
- Add `PushClient` for TCP 19301 (separate long-lived socket, parse `robot_push` JSON)
- All calls: 3s timeout, state tracking, structured logging (no secrets)
- **Does not change** dashboard HTTP routes in first increment — internal swap only

### P1-C: MockAdapter

- TCP client to extended `robokit_mock_server`
- Same interface as RealAdapter — byte-identical protocol where possible

### P1-D: Mock Movement / State

Extend mock server internal state machine:

```
MockRobotState
├── pose (x,y,angle) — updated by nav simulation thread
├── laser — beams rotate with pose
├── task_status — 1020 enum cycle
├── current_map, maps[], stations[]
└── obstacles[] — 4350/4351/4352 backing store
```

Nav simulation: 3051/3066 spawn thread interpolating pose toward target station.

### P1-E: Map / Station Mock

Mock file store under `/var/log/delivery/mock_maps/` or in-memory:

- 1300 returns `current_map` + `maps[]`
- 1301 parses stations from loaded smap
- 4011 returns smap bytes from store
- 4010/2025 accept smap JSON, validate ASCII name, update store
- 2022 switches `current_map` pointer

### P1-F: 19301 Push Mock

Separate TCP listener on port 19301:

- On client connect, start periodic push thread (default interval from last 9300 or 500ms)
- Push JSON matching docx `robot_push` fields: `x,y,angle,vx,vy,current_station,...`
- 9300 handler on same port adjusts interval and field filters

---

## 7. DevAdapter (retain dev mode)

`dev` is **not** the same as `mock`:

| | dev | mock |
|---|-----|------|
| Pose source | ROS `/agv/status` | Mock TCP 1004 / push |
| Map source | Local smap files | Mock 1300/4011 |
| Nav | ROS services | Mock 3051/3066 |
| Purpose | Gazebo integration test | Offline Web UI dev |

DevAdapter implements `AgvApiAdapter` by delegating to existing ROS + `smap_sim` — unifies business layer without forcing Robokit in dev.

---

## 8. Dashboard Integration Plan (post-approval)

Phased migration of `dashboard_node.py`:

1. **Inject adapter** at init from `env.json` mode
2. Replace `_ensure_robokit` / `_laser_tick` direct calls with adapter methods
3. Replace `_load_smap` local-only path with adapter-aware map service:
   - dev: local files
   - demo/mock: 1300 → 4011 → parse
4. Restore env switch UI (`dev` / `demo` / `mock`) calling `POST /api/env`
5. Keep Jason/Face bridges unchanged (separate adapters)

**Monolith split (optional P1 later):**

```
delivery_web/
├── dashboard_node.py      # ROS node + HTTP (thin)
├── services/
│   ├── map_service.py
│   ├── nav_service.py
│   └── robot_state_service.py
└── www/
```

---

## 9. Configuration Unification

New file: `config/devices.yaml` (from template, gitignored local override)

```yaml
agv:
  robokit_host: ${AGV_HOST:-192.168.18.198}
  timeout_sec: 3.0
jason:
  camera_a_host: ${JASON_CAMERA_A_HOST:-172.31.0.88}
  ros_topic: /my_camera/pylon_ros2_camera_node/image_raw
leo:
  jetson_host: ${LEO_JETSON_HOST:-172.31.0.85}
  camera_host: ${LEO_CAMERA_HOST:-172.31.0.87}
```

Environment variables override YAML. **No hardcoded IPs in Python source.**

---

## 10. Implementation Phases (after architecture approval)

| Phase | Deliverable | Test |
|-------|-------------|------|
| **P1-A** | Interface + DTOs + factory + env `mock` | Unit: factory creates correct adapter |
| **P1-B** | RealAdapter + RobokitClient extensions | smoke_robokit against real AGV |
| **P1-C** | MockAdapter shell | Connect to mock server |
| **P1-D** | Mock pose/nav/laser motion | Web shows moving AGV offline |
| **P1-E** | Mock map/station 1300/4011/2022 | Map dropdown from mock |
| **P1-F** | 19301 push + 9300 config | Web pose from push not poll |
| **P1-G** | Dashboard refactor to use adapter | Regression: P0 tests still pass |
| **P1-H** | Restore env UI + mock mode docs | Full offline Web walkthrough |

Each phase: **modify → start → test → report → wait for approval**.

---

## 11. Risks & Open Questions

| # | Item | Recommendation |
|---|------|----------------|
| 1 | 3051 `source_id` real vs doc | Config flag; document in adapter |
| 2 | 4011 response is raw smap vs JSON wrapper | RealAdapter must branch on `ret_code` presence |
| 3 | 2025 body format vs 4010 | Same smap JSON; different port/API |
| 4 | Push 19301 concurrent with req/resp ports | Separate socket class; do not multiplex |
| 5 | `dashboard_node.py` size (~2100 lines) | Split services after adapter lands |
| 6 | Camera A deferred test | Re-run when hardware ready; not P1 blocker |
| 7 | Local AGVAPI markdown incomplete | Use freeze `AGVAPI文档_ref` as authority |

---

## 12. Explicit Non-Goals (Phase C planning)

- No map upload UI (P2)
- No live lidar overlay refactor (P2)
- No Leo Jetson UI (P2)
- No AI path planner (P3)
- No implementation until this plan is approved

---

## 13. Approval Checklist

Please confirm:

- [ ] Three-mode model: `dev` / `demo` / `mock`
- [ ] Adapter interface scope (section 5)
- [ ] DevAdapter retains ROS/Gazebo path
- [ ] Mock extends `robokit_mock_server` + 19301 listener
- [ ] Phased delivery order (section 10)
- [ ] Config via env vars + devices.yaml template
- [ ] Freeze location acceptable for rollback

**Awaiting approval before P1-A implementation.**
