# AGV Web Phase 3 Test — Step 1: System Audit + LM1→LM2→LM3 Reproduction

> **日期**：2026-08-13  
> **阶段**：Phase 3 Step 1（仅审计 + 复现，**未改代码**）  
> **环境**：`delivery_gazebo_soft` @ 192.168.18.240，ROS_DOMAIN_ID=30

---

## Executive Summary

| 项 | 结论 |
|----|------|
| **多站点后端链路** | **存在且可工作** — `run_route()` 顺序调用 3 次 `navigate()` |
| **LM1→LM2→LM3 API 实测** | **3/3 SUCCESS**（`POST /api/sim/route` + `run:true` + `wait:true`） |
| **用户「只走第一站」最可能原因** | **UI/API 用错** — 非后端只取 `stations[0]` |
| **实时 AGV LiDAR 点云** | **N/A** — 无 `sensor_msgs/PointCloud2` 导航雷达 topic |
| **Web 点云显示** | **静态 smap 点云 + 仿真 laser 点**（非真实 LiDAR） |

---

## 1. Environment

| 项 | 值 |
|----|-----|
| Container | `delivery_gazebo_soft` — Up |
| ROS2 | Humble |
| Web | http://192.168.18.240:19999/ |
| Jason Camera | `/my_camera/pylon_ros2_camera_node` — Up |
| `/agv/status` Hz | ~10 Hz |
| `/agv/odom` Hz | ~45 Hz |

**Environment：PASS**

---

## 2. ROS2 节点 / Topic / Service / Action

### Nodes（实测）

```
/agv_gazebo_nav
/arm_gazebo_driver
/camera_gazebo_qr
/dashboard_node
/face_bridge_node
/face_executor_node
/gz_physics_proxy
/my_camera/pylon_ros2_camera_node
```

### AGV 相关 Topic

| Topic | 类型 | 用途 |
|-------|------|------|
| `/agv/cmd_vel` | geometry_msgs/Twist | 速度控制（Gazebo 仿真） |
| `/agv/odom` | nav_msgs/Odometry | 里程计 → agv_gazebo_nav 读 pose |
| `/agv/pose` | delivery_interfaces/AgvPose | 定位 pose |
| `/agv/status` | delivery_interfaces/AgvStatus | 任务状态、坐标、站点 |

### Service

| Service | 提供者 | 用途 |
|---------|--------|------|
| `/agv/navigate` | `agv_gazebo_nav` | 单站点导航（AgvNavigate） |
| `/agv/cancel` | `agv_gazebo_nav` | 取消 |
| `/agv/lock` | `agv_gazebo_nav` | 锁车 |

### Action

无 AGV 导航 action。仅有 Jason camera `grab_images_raw/rect`。

**不存在**：`/api/route`、`/api/task` 对应 ROS action。

---

## 3. Web API 架构（dashboard_node @ :19999）

### 导航 / 路线

| 方法 | 路径 | 作用 |
|------|------|------|
| POST | `/api/navigate` | **单站**导航 `{target_id, wait}` |
| POST | `/api/sim/route` | 设置路线 `{stations[], run, wait}` |
| POST | `/api/sim/route/run` | 执行已存路线 |
| GET | `/api/sim/route` | 读当前路线 |
| POST | `/api/cancel` | 取消 |

### 地图 / 仿真

| 方法 | 路径 | 作用 |
|------|------|------|
| GET | `/api/sim/maps` | smap 列表 |
| POST | `/api/sim/map` | 加载 smap |
| GET/POST | `/api/sim/obstacles` | 障碍物 |
| GET | `/api/state` | 全状态（agv/map/laser/route/stations） |

### Camera / QR（Phase 2 已加）

| 方法 | 路径 |
|------|------|
| GET | `/camera.html` |
| GET | `/api/jason/camera/status` |
| GET | `/api/jason/camera/snapshot` |
| POST | `/api/jason/qr/start` |
| POST | `/api/jason/qr/stop` |

### 站点 API

**当前无** `GET/POST /api/stations`。站点来自：

- 文件：`/data/agv_downloaded/maps/stations_from_smap.json`
- 加载：`dashboard_node._load_smap()` / `_load_stations()`
- 暴露：`GET /api/state` → `state.stations`

---

## 4. 地图数据关系（必须先搞清楚）

### 静态地图

| 项 | 来源 |
|----|------|
| 文件格式 | **`.smap`**（Robokit 导出） |
| 目录 | `/data/agv_downloaded/maps/` |
| 当前加载 | `20260723112931750.smap`（24511 点） |
| 解析 | `delivery_web/smap_sim.py` → `load_smap_layers()` |
| Web 显示 | `state.map.cloud`（UI 降采样 ~1800 点） |
| 坐标系 | smap header `minPos/maxPos`，站点 x/y 同坐标系 |

### AGV Pose

| 项 | 来源 |
|----|------|
| 仿真 odom | `gz_physics_proxy` → `/agv/odom` |
| 导航节点 | `agv_gazebo_nav._on_odom()` |
| Web | `gz_physics_proxy` 状态 + `/agv/status` @ 10Hz |
| frame_id | `"map"` |

### 实时点云 / 激光

| 项 | 结论 |
|----|------|
| ROS2 真实 LiDAR | **无** — `ros2 topic list` 无 `/scan`、无 AGV `PointCloud2` |
| Jason `blaze_cloud` | Basler 3D 相机点云，**不是 AGV 导航雷达** |
| Web `state.laser` | **仿真**：`sim_laser_from_map()` 用静态 smap 点云 + 障碍物，2Hz |
| demo 模式 | 可选 Robokit 真车 laser API |

**关系**：

```
静态 smap 点云 (map.cloud)  →  Web 底图
仿真 laser (state.laser)     →  Web 叠加（非真实传感器）
/agv/status (x,y,angle)      →  Web AGV 图标
```

**PointCloud：N/A（无真实 AGV LiDAR ROS topic）**

---

## 5. 多站点路线代码路径

```
UI: setRoute(true)  或  POST /api/sim/route
  ↓
dashboard_node.set_route(stations)
  ↓
dashboard_node.run_route(wait=true)
  ↓
for st in ["LM1","LM2","LM3"]:
    navigate(st, wait=true)          # 同步循环，非后台状态机
      ↓
    AgvNavigate → /agv/navigate
      ↓
    agv_gazebo_nav._on_nav()
      wait_until_done=true → 阻塞直到 task_status==4
```

**关键**：`run_route()` **不会**只取 `stations[0]`；会顺序执行全部。

---

## 6. LM1 → LM2 → LM3 复现（实测）

### Test A：`POST /api/sim/route` 三站连续

**Request**：
```json
{"stations":["LM1","LM2","LM3"],"run":true,"wait":true}
```

**Response**（~30s，HTTP 200）：
```json
{
  "success": true,
  "message": "route done",
  "results": [
    {"station":"LM1","success":true,"final_status":4,"message":"arrived"},
    {"station":"LM2","success":true,"final_status":4,"message":"arrived"},
    {"station":"LM3","success":true,"final_status":4,"message":"arrived"}
  ]
}
```

| Goal | Result |
|------|--------|
| Goal 1: LM1 | **SUCCESS** (final_status=4 arrived) |
| Goal 2: LM2 | **SUCCESS** |
| Goal 3: LM3 | **SUCCESS** |

### Test B：`run:false` 仅设置（不移动）

- 设置 `["LM2","LM3"]`，`run:false`
- Pose 前后均为 `(6.26, -0.659)` — **确认不移动**

### Test C：`/api/sim/route/run` 执行已存路线

- 执行 LM2→LM3，~37s，**2/2 SUCCESS**
- 结束后 pose ≈ `(10.15, -4.652)`（朝 LM3 方向，未精确到 LM3 坐标）

### 结论

**后端多站点链路在当前 Gazebo 环境下可以连续执行 3 站。**

---

## 7. 为什么用户可能「只走 LM1」— 根因分析

### P0 — UI 误用（最可能）

| 用户操作 | 实际效果 |
|----------|----------|
| 点击 **LM1 / LM2 / LM3 按钮** | 每次调用 `go()` → **单站** `/api/navigate`，不是路线 |
| 点击 **「设置路线」** | `setRoute(false)` → **只存路线，不执行** |
| 输入 LM1,LM2,LM3 但未点 **「设置并执行」** | 同上 |
| 调用不存在的 `/api/route` | **404** |

**正确多站操作**：

1. 路线输入框填：`LM1,LM2,LM3`
2. 点击 **「设置并执行」**（`setRoute(true)`）
3. 或 API：`POST /api/sim/route` + `"run":true,"wait":true`

### P1 — `wait:false` 导致目标覆盖

若 `wait:false`，`run_route` 快速连续发 3 个 navigate，`agv_gazebo_nav` 每次 **覆盖 `_goal`**，最终只到 **最后一站**（或表现异常）。

当前 UI 默认 `wait:true` ✅

### P2 — HTTP 同步阻塞

`run_route` 在 **HTTP 请求线程内同步执行** 全程（LM1→LM2→LM3 可能 30–120s）。浏览器 fetch 若超时，用户以为失败，但服务端可能仍在跑。

### P3 — Demo 模式（真车）

真车走 Robokit 3051，逻辑不同；当前容器为 **gazebo/dev 模式**。

---

## 8. AGV ONLINE/OFFLINE 现状

| 现象 | 原因 |
|------|------|
| 页面顶部「连接中…」 | `poll()` 等待 `/api/state` 首次成功 |
| 失败显示「断开」 | fetch 异常 |
| **无明确 AGV OFFLINE** | 未基于 `/agv/status` 超时判定 |
| `nodes_health.agv` | 基于是否收到过 status，非超时 |

**AGV Status UI：需 Phase 3 改进**（timeout + OFFLINE 显式显示）

---

## 9. Jason Camera Web（Phase 2 状态）

- 页面：http://192.168.18.240:19999/camera.html
- 真实 Basler 画面已通（独立页）
- **尚未并入** 主控制台 `index.html` 地图页

---

## 10. Problems（待 Phase 3 修复）

### P0

1. **多站点 UI 易误用** — LM1/LM2/LM3 按钮 vs 路线执行混淆
2. **无 `/api/stations` CRUD** — 不能 Web 新增站点

### P1

3. **AGV OFFLINE 未实现** — 仅 loading/断开
4. **地图不跟随 AGV 居中** — 当前 bounds 包含全图+站点
5. **主页面未集成 Jason Camera** — 仅在 `/camera.html`
6. **路线执行 HTTP 长时间阻塞** — 需异步任务 + 进度 polling

### P2

7. **无真实 AGV LiDAR 点云** — laser 为 smap 仿真
8. **到达后 pose 与站点坐标偶发偏差** — 需验证 goal_tol / odom 一致性
9. **容器 recreate 后需 colcon build delivery_web**

---

## 11. Step 1 Final Result

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGV WEB PHASE 3 — STEP 1 AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Environment:        PASS
Web API 审计:        PASS
Map 数据关系:        PASS（已明确）
PointCloud:         N/A（无真实 AGV LiDAR）
AGV Status 审计:     PARTIAL（无 OFFLINE timeout）
Jason Camera:       PASS（独立页，未入主控）
Route API 审计:      PASS
LM1→LM2→LM3 复现:   PASS（API 三站均 SUCCESS）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 RESULT: AUDIT COMPLETE — READY FOR PHASE 3 IMPLEMENTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**LM1→LM2→LM3 现在是否已连续执行？**

- **通过正确 API/UI：是**（本次实测 3/3 SUCCESS）
- **若用户只点 LM1 按钮或只「设置路线」：否**（只执行一站或不执行）

**浏览器验证（Step 1）**：未做 UI 路线按钮实测；API 已在容器内实测。

---

## 12. Phase 3 下一步建议（Step 2+）

1. 新主控台 UI（地图主体 + 双相机 + QR）
2. AGV OFFLINE timeout + 地图跟随 AGV 居中
3. 路线 UI 明确化 + 异步任务进度
4. `POST /api/stations` 最小 API
5. 集成 Jason Camera 到主页面（复用 Phase 2 bridge）
6. Jetson Face Camera placeholder
7. Docker rebuild 固化

**Jason 原工程：不修改。**
