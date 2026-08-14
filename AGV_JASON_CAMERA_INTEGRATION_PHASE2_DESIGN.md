# AGV × Jason 工业相机集成 — Phase 2 设计报告

> **阶段**：Phase 2 — Camera Adapter 设计与最小实现方案（**设计-only，本文件生成时未改业务代码**）  
> **日期**：2026-08-13  
> **依据**：`AGV_JASON_CAMERA_INTEGRATION_AUDIT.md` + VM 源码复核（192.168.18.240）  
> **硬件现状**：`192.168.18.251` ping FAIL；`192.168.18.249` SSH FAIL — **不得宣称 Real PASS**

---

## 0. 本阶段确认清单（相对 Phase 1 增量复核）

| # | 确认项 | 结论 | 证据 |
|---|--------|------|------|
| 1 | 审计报告 | 已读；主体仍有效 | `AGV_JASON_CAMERA_INTEGRATION_AUDIT.md` |
| 2 | `camera_adapter_node` | **setup.py 已注册，`.py` 源文件仍缺失** | VM `camera_bridge/setup.py` L25；`camera_bridge/` 目录无该文件 |
| 3 | `delivery_interfaces` | Camera/QR 相关 msg/srv **已够用，无需新增** | 见 §3 |
| 4 | Web Dashboard | **已预留** `camera/status`、`camera/mask_cmd`、mode API | `dashboard_node.py` |
| 5 | Jason Domain ID | **Jason 仓库内无配置**；249 不可达 → **无法实机确认** | Jason grep 0 命中 |
| 6 | AGV Domain ID | 默认 30，多处可配置入口，但部分代码仍写死默认 30 | `devices.yaml`、`docker-compose.yml` |
| 7 | 相机 IP | Jason 代码无 `192.168.18.251`；需配置化 | Jason grep 0 命中 |
| 8 | 网络 | 251/249 仍不可达（2026-08-13 复测） | VM ping |

### 审计报告 vs 源码差异（以源码为准）

| 项 | 审计报告 | 当前 VM 源码 | 处理 |
|----|----------|--------------|------|
| Dashboard camera mask | 审计已提及 | **已实现** `/api/camera/mask`、`get_camera_status`、`set_camera_mask` | 设计复用，不重建 |
| `set_env` mode 名 | dev/demo | **已扩展** simulation/real（legacy dev/demo 仍映射） | 设计沿用 simulation/real |
| `sim_all.launch.py` | 提及 | workspace 副本 **0 字节**；`.run` 副本正常 | Phase 4 同步修复，非 Phase 2 设计范围 |
| Jason Domain | 未细查 | **Jason 仓库无任何 ROS_DOMAIN_ID** | 见 §11 |

---

## 1. 当前 Jason ROS2 接口（源码确认）

### 1.1 技术栈

| 项 | 值 |
|----|-----|
| SDK | **Basler Pylon**（`/opt/pylon`） |
| 驱动包 | `pylon_ros2_camera_component` / `wrapper` / `interfaces` |
| 相机型号 | **acA2500-14GC** |
| 设备选择 | YAML `device_user_id: "106611-18"`（**非 IP**） |
| 连接 | **GigE** |
| QR | `qrcode_detector` / `wechat_qr_node`（OpenCV QRCodeDetector 默认） |

### 1.2 Node

| Node | 启动方式 | 默认命名空间 |
|------|----------|--------------|
| `{camera_id}/pylon_ros2_camera_node` | `pylon_ros2_camera.launch.py` | `camera_id` 默认 **`my_camera`**；部署脚本常用 **`basler_106611_18`** |
| `wechat_qr_node` | `qrcode_detector.launch.py` | 全局名（非 namespace） |

### 1.3 Topic（默认 launch 参数）

| Topic | 类型 | 发布者 | 说明 |
|-------|------|--------|------|
| `/{camera_id}/pylon_ros2_camera_node/image_raw` | `sensor_msgs/Image` | Pylon | 持续图像 |
| `/{camera_id}/pylon_ros2_camera_node/camera_info` | `sensor_msgs/CameraInfo` | Pylon | 标定信息 |
| `/wechat_qr_node/decoded_info` | `std_msgs/String` | QR 节点 | **有码才 publish**；无码无消息 |

Launch 默认 `image_topic=/my_camera/pylon_ros2_camera_node/image_raw`。

### 1.4 Service / Action（Jason 侧，Adapter 不直接依赖）

| 类别 | 示例 | Adapter 策略 |
|------|------|--------------|
| Pylon 控制 Service | `set_exposure`, `set_gain`, … | **不封装**；保留 Jason 原生 |
| Pylon Action | `GrabImagesAction` | Phase 4 可选用于 `CameraCapture`；非必须 |
| QR | 无 Service | Adapter 用 Topic 缓存 + `DetectQr` 读缓存 |

### 1.5 Jason 真实数据链路

```text
Basler GigE Camera
        │
        ▼
Pylon SDK (/opt/pylon)
        │
        ▼
pylon_ros2_camera_node
        │  image_raw + camera_info
        ▼
wechat_qr_node (optional)
        │  decoded_info (String)
        ▼
(待接) AGV camera_adapter_node
```

---

## 2. 当前 AGV Camera Contract（源码确认）

### 2.1 已有 `delivery_interfaces`（**全部复用，不新增**）

| 类型 | 名称 | 用途 |
|------|------|------|
| msg | `CameraInfoLite` | `/camera/<name>/info`；`connected` + `transport` |
| msg | `CameraHeartbeat` | `/camera/<name>/heartbeat`（ingress 设计；adapter 可生成） |
| msg | `QrDetection` / `QrDetectionArray` | `camera/<name>/qr` |
| srv | `DetectQr` | `camera/detect_qr` — Dashboard 已调用 |
| srv | `CameraCapture` | `camera/capture` — 可选 Phase 4 |

**为何不新增 Mask msg/srv**：Dashboard 已用 `std_msgs/String` JSON 做 `camera/status` 与 `camera/mask_cmd`；`get_camera_status()` 已定义 Web 字段。Adapter 只需填充约定 JSON 字段。

### 2.2 AGV 逻辑相机（`CAMERAS_META` + `interfaces.md`）

| 逻辑名 | Web 标签 | 角色 | 能力 |
|--------|----------|------|------|
| `cam_left` | 扫码相机 | qr_scan | qr |
| `cam_front` | 前视相机 | face_qr_object | face, qr, object |
| `cam_right` | 侧视相机 | third_view_cargo | view, cargo |

**Jason Basler 映射决策（本设计采用）**：

- 工业相机 + QR 主链路 → **`cam_front`**
- 依据：`devices.yaml` / docs/25 已将 Basler 工业通路绑定 `cam_front`；避免改动 Web 契约键名
- `cam_left` / `cam_right` 在 DEV 仍可由 Gazebo/sim 填充；REAL 模式不伪造

### 2.3 现有 AGV 相机 Node 职责

| Node | 职责 | Jason 集成关系 |
|------|------|----------------|
| `camera_ingress_node` | Xavier **compressed+heartbeat** → decode | **不用于 Jason 直连**；保留 legacy |
| `camera_sim_node` / `camera_gazebo_qr` | DEV 仿真 | REAL 模式 **必须 disable** |
| `camera_bridge_node` | stub | REAL 模式 **不启动** |
| **`camera_adapter_node`** | **待实现** | Jason→AGV 唯一翻译层 |

### 2.4 Web → ROS2 已有控制链（已实现，Adapter 需对接）

```text
Web POST /api/env 或 /api/camera/mode
        │  body: {"mode":"simulation"|"real"}  (legacy: dev/demo)
        ▼
dashboard_node.set_env()
        │  写 env.json (adapter_mode)
        │  **当前未向 ROS 发布 mode 命令** ← Phase 4 需补一条 topic
        ▼
(缺失) camera_adapter_node 收 mode
        │
Web POST /api/camera/mask
        │  body: {"camera_name":"cam_front","enabled":false}
        ▼
dashboard_node.set_camera_mask()
        │  publish camera/mask_cmd  JSON: {"cam_front": false}
        ▼
(缺失) camera_adapter_node 收 mask

Web GET /api/camera/status
        ▼
dashboard_node.get_camera_status()
        │  合并 _cam_info + _camera_system_status
        ▼
(缺失) adapter 发布 camera/status JSON
```

---

## 3. AGV 与 Jason 差异矩阵

| 维度 | Jason | AGV Contract | 差异 |
|------|-------|--------------|------|
| 图像 Topic | `/{ns}/.../image_raw` | `/camera/cam_front/image_raw` | 命名、namespace |
| 图像格式 | `sensor_msgs/Image`（Pylon 原生 encoding） | `sensor_msgs/Image` rgb8/bgr8 | 可能需 encoding 转换 |
| QR 结果 | `String` 单字符串 | `QrDetectionArray` | 类型 + 字段 |
| 心跳 | 无 | `CameraHeartbeat` | Adapter 由帧率合成 |
| 权威 info | `sensor_msgs/CameraInfo` | `CameraInfoLite` + transport 语义 | Adapter 翻译 |
| 系统状态 | 无统一 JSON | `camera/status` | Adapter 新增发布 |
| 单次识别 | 无 Service | `DetectQr` Service | Adapter 提供读缓存/超时 |
| 设备身份 | `device_user_id` | `CameraHeartbeat.device_id` / status JSON | 用 user_id，非 IP |
| Domain | **未在 Jason 代码配置** | AGV 默认 30 | 必须环境变量对齐 |

---

## 4. Adapter 设计 — `camera_adapter_node`

### 4.1 设计原则

1. **不 import pypylon / 不复制 Jason SDK**
2. **只订阅 Jason 已有 Topic**，发布 AGV 已有 Contract
3. **不修改 Jason driver**
4. **REAL 禁止 fake**；DEV 仿真必须 `transport=simulation` 明示
5. **IP / Domain 全部来自 config/env**，业务逻辑不硬编码

### 4.2 文件与配置（Phase 4 实施范围，此处仅设计）

| 新增/修改 | 路径 | 说明 |
|-----------|------|------|
| **新增** | `camera_bridge/camera_bridge/camera_adapter_node.py` | 核心 Adapter |
| **新增** | `camera_bridge/config/jason_basler.yaml` | Jason 源 topic + 逻辑相机映射 |
| **新增** | `camera_bridge/launch/camera_adapter.launch.py` | 单独启动 adapter |
| **扩展** | `delivery_bringup/config/devices.yaml` | `cameras.jason_*` 字段（见 §10） |
| **小改** | `dashboard_node.set_env()` | mode 切换时 publish `camera/mode_cmd`（1 处，非重构） |
| **不改** | Jason `pylon_ros2_camera_*` | — |

### 4.3 Adapter 职责对照（用户 §6）

| # | 职责 | 实现要点 |
|---|------|----------|
| 1 | Jason image → AGV image | Sub Pylon `image_raw` → Pub `/camera/cam_front/image_raw` |
| 2 | Jason QR → AGV QR | Sub `/wechat_qr_node/decoded_info` → Pub `camera/cam_front/qr` |
| 3 | Heartbeat | 内部计时；Pub `/camera/cam_front/heartbeat`（`CameraHeartbeat`） |
| 4 | Camera status | Pub `camera/status` JSON（见 §7） |
| 5 | Frame timeout | 超 `_frame_timeout_sec` → `NO_FRAME` / error 传播 |
| 6 | Recognition timeout | QR 请求时无近期结果 → `RECOGNITION_TIMEOUT` |
| 7 | Mask | Sub `camera/mask_cmd`；masked 时不转发业务 QR/图像消费 |
| 8 | REAL/DEV 约束 | Sub `camera/mode_cmd`；REAL 无 Jason 源 → 仅错误态 |
| 9 | 日志 | 结构化 log（见 §14） |
| 10 | 错误传播 | `DetectQr.message` + status JSON `error` 字段 |

### 4.4 Adapter 内部模块（单 Node 内聚，避免过度抽象）

```text
camera_adapter_node
├── ConfigLoader        # yaml + env: domain_id, jason topics, logical cameras
├── JasonImageIngress   # sub image_raw, frame clock, encoding convert
├── JasonQrIngress      # sub decoded_info → QrDetectionArray cache
├── HeartbeatPublisher  # CameraHeartbeat from frame stats
├── StatusPublisher     # camera/status JSON timer
├── MaskController      # sub camera/mask_cmd
├── ModeController      # sub camera/mode_cmd (simulation|real)
├── DetectQrService     # srv camera/detect_qr (adapter 实现 server)
└── HealthProbe         # optional: ping configured IP (ICMP), 仅诊断，非连接身份
```

---

## 5. Topic 映射表

### 5.1 订阅（Jason → Adapter）

| 配置键 | 默认值（可配置） | 类型 |
|--------|------------------|------|
| `jason.image_topic` | `/basler_106611_18/pylon_ros2_camera_node/image_raw` | `sensor_msgs/Image` |
| `jason.camera_info_topic` | `/basler_106611_18/pylon_ros2_camera_node/camera_info` | `sensor_msgs/CameraInfo` |
| `jason.qr_topic` | `/wechat_qr_node/decoded_info` | `std_msgs/String` |
| `camera/mask_cmd` | （固定） | `std_msgs/String` JSON |
| `camera/mode_cmd` | （新增，固定） | `std_msgs/String` JSON |

> **说明**：默认 topic 与 Jason `deploy_and_run_camera_qr.sh` 的 `CAMERA_ID=basler_106611_18` 一致；若 Jason 用 `my_camera`，只改 YAML，不改代码。

### 5.2 发布（Adapter → AGV）

| Topic | 类型 | 条件 |
|-------|------|------|
| `/camera/cam_front/image_raw` | `sensor_msgs/Image` | REAL：有 Jason 帧且未 MASKED；DEV：Jason 优先，否则不发布（由 sim 节点负责） |
| `/camera/cam_front/info` | `CameraInfoLite` | 同上 |
| `/camera/cam_front/heartbeat` | `CameraHeartbeat` | REAL/DEV 真 Jason 链路时 |
| `camera/cam_front/qr` | `QrDetectionArray` | 有真实解码结果且未 MASKED |
| `camera/status` | `std_msgs/String` JSON | 始终（含错误态） |

### 5.3 DEV 模式下与仿真 Node 共存规则

| 源 | transport 值 | 何时启用 |
|----|--------------|----------|
| Jason 真机在线 | `basler_pylon` | DEV/REAL 均可用 |
| Gazebo/sim | `simulation` | **仅** `mode=simulation` 且 Jason 不可达 |
| 无源 | `none` + error | 明确失败，不 fallback fake QR |

**REAL 模式**：即使 Gazebo 在跑，Adapter **不得**转发 sim 图像/QR 到 `cam_front` 权威 topic。

---

## 6. Service 映射

| AGV Service | 类型 | Adapter 行为 |
|-------------|------|--------------|
| `camera/detect_qr` | `DetectQr` | **Adapter 作为 Server**（与 sim/gazebo 互斥 launch） |

### `DetectQr` 响应语义（REAL）

| 条件 | success | message |
|------|---------|---------|
| 相机 MASKED | false | `CAMERA_MASKED` |
| Jason 无图像流 | false | `CAMERA_UNAVAILABLE` |
| 有流但超时无帧 | false | `NO_FRAME` / `CAPTURE_TIMEOUT` |
| 有帧但 QR 缓存空 | false | `NO_RESULT` |
| 有帧但识别超时 | false | `RECOGNITION_TIMEOUT` |
| Service 内部异常 | false | `SERVICE_UNAVAILABLE` |
| 有真实 QR 缓存 | true | payload 来自 Jason `decoded_info` |

**禁止**：以上任一失败路径返回 `success=true` 或编造 payload。

### `CameraCapture`（Phase 4 可选）

- 非 Phase 2 必须；若实现：REAL 模式下返回最近一帧真实 JPEG bytes，失败同错误码
- 不调用 Pylon Action 也可（减少耦合）

---

## 7. Camera Status 状态机

### 7.1 单相机硬件态（`hardware_state`）

```text
                    ┌─────────────┐
         无 Jason   │  OFFLINE    │◄──── ping/topic 均不可用
         topic      └──────┬──────┘
                           │ 收到 image_raw
                           ▼
                    ┌─────────────┐
              帧超时│   ONLINE    │──────► DEGRADED (帧抖动/低 fps)
                    └──────┬──────┘
                           │ topic 消失
                           └──────────► OFFLINE
```

| hardware_state | 条件 |
|----------------|------|
| `OFFLINE` | 配置时间内无 `image_raw`；或 REAL 模式下 Jason topic 不存在 |
| `ONLINE` | 收到帧且 `_frame_timeout` 内持续 |
| `DEGRADED` | 有帧但 fps < 阈值或 Pylon 报错计数升高 |

### 7.2 业务态（`business_state`）— Mask 与 Offline 分离

| enabled (mask) | hardware_state | business_state | error 字段 |
|----------------|----------------|----------------|------------|
| true | ONLINE | **ACTIVE** | `` |
| false | ONLINE | **CAMERA_MASKED** | `` |
| true | OFFLINE | **CAMERA_OFFLINE** | `CAMERA_UNAVAILABLE` |
| false | OFFLINE | **CAMERA_MASKED** | `CAMERA_UNAVAILABLE`（硬件仍离线，但主因是 mask） |

**Web 展示规则**：

- `enabled=false` → 按钮显示「已屏蔽」→ `business_state=CAMERA_MASKED`
- `enabled=true` + `online=false` → 「离线」→ `CAMERA_OFFLINE`
- 不得把 MASKED 显示为 OFFLINE-only（需在 status JSON 分字段）

### 7.3 `camera/status` JSON 契约（Adapter 发布，Dashboard 已能解析）

```json
{
  "mode": "real",
  "real_camera_connected": true,
  "domain_id": 30,
  "cameras": {
    "cam_front": {
      "label": "前视相机",
      "enabled": true,
      "online": true,
      "hardware_state": "ONLINE",
      "business_state": "ACTIVE",
      "source": "basler_pylon",
      "device_user_id": "106611-18",
      "ip": "192.168.18.251",
      "width": 1224,
      "height": 1024,
      "fps": 8.0,
      "error": "",
      "last_frame_age_sec": 0.12
    },
    "cam_left": { "enabled": true, "online": false, "source": "none", "error": "CAMERA_UNAVAILABLE" },
    "cam_right": { "enabled": true, "online": false, "source": "none", "error": "CAMERA_UNAVAILABLE" }
  }
}
```

> Dashboard `_on_camera_status` 已读 `enabled`/`online`/`source`/`error`；Phase 4 扩展 `hardware_state`/`business_state` 字段，**不改 API 路径**。

---

## 8. Mask 状态机

```text
         mask_cmd enabled=true
    ┌───────────────────────────────┐
    │                               │
    ▼                               │
 UNMASKED ──mask_cmd enabled=false──► MASKED
    │                               │
    │  MASKED: 不发布 qr/image      │
    │  但 hardware_state 仍更新     │
    └───────────────────────────────┘
```

| 操作 | ROS | Web |
|------|-----|-----|
| 屏蔽前置（cam_front） | `camera/mask_cmd` `{"cam_front":false}` | POST `/api/camera/mask` |
| 屏蔽左侧（cam_left） | `{"cam_left":false}` | 同上 |
| 屏蔽右侧（cam_right） | `{"cam_right":false}` | 同上 |

按钮文案（Web 已有 label，建议 UI 使用）：

- 「屏蔽前视相机（cam_front）」
- 「屏蔽扫码相机（cam_left）」
- 「屏蔽侧视相机（cam_right）」

---

## 9. DEV / REAL 行为矩阵

| 行为 | REAL (`mode=real`) | DEV (`mode=simulation`) |
|------|--------------------|-------------------------|
| Jason 真机在线 | 使用真实 image + QR | **优先**使用真实 image + QR |
| Jason 离线 | 仅错误态；`CAMERA_UNAVAILABLE` | 允许 Gazebo/sim 发布 `transport=simulation` |
| 假 QR (`STATION_LM2`) | **禁止** | 允许，但必须 `source=simulation` |
| `DetectQr` 失败 | 明确错误码 | 同左（不对 real 伪装） |
| Ping IP | 仅日志/诊断 | 同左 |
| `camera/status.mode` | `"real"` | `"simulation"` |

### Mode 传播设计（最小改动）

1. `dashboard_node.set_env()` 在更新 `env.json` 后 **publish**：

```json
// topic: camera/mode_cmd  (std_msgs/String)
{"mode": "simulation"}  // or "real"
```

2. `camera_adapter_node` 订阅 `camera/mode_cmd`，切换内部 `_mode`
3. Web 已有两个入口等效：`POST /api/env` 与 `POST /api/camera/mode`

**不在 Web 增加 MOCK 模式。**

---

## 10. Camera IP 配置方案

### 10.1 原则

- **逻辑 ID**（`cam_front`）= AGV 稳定身份
- **device_user_id**（`106611-18`）= Pylon 物理设备身份（优先）
- **ip** = 连接/健康检查参数，**可变更**

### 10.2 建议扩展 `devices.yaml`（遵循现有风格）

```yaml
cameras:
  names: ["cam_front", "cam_left", "cam_right"]
  ros_domain_id: 30                    # 已有；adapter 读 param/env，不硬编码

  jason_basler:                        # 新增段
    logical_name: cam_front
    device_user_id: "106611-18"
    ip: "192.168.18.251"               # 仅 health probe；可 env 覆盖
    pylon_namespace: basler_106611_18  # → topic 前缀
    image_topic: ""                    # 空则自动拼 /{ns}/pylon_ros2_camera_node/image_raw
    qr_topic: /wechat_qr_node/decoded_info
    frame_timeout_sec: 2.0
    recognition_timeout_sec: 3.0
```

### 10.3 环境变量覆盖（与 docker-compose 一致）

| 变量 | 用途 |
|------|------|
| `ROS_DOMAIN_ID` | DDS domain（**不在 Python 写死 30**） |
| `JASON_CAMERA_IP` | 覆盖 yaml ip |
| `JASON_PYLON_NAMESPACE` | 覆盖 namespace |
| `JASON_IMAGE_TOPIC` | 完全覆盖 image topic |
| `JASON_QR_TOPIC` | 覆盖 QR topic |

Adapter 读取优先级：**ROS param > 环境变量 > devices.yaml > 内置默认（无 IP）**

---

## 11. ROS_DOMAIN_ID 配置方案

### 11.1 现状

| 位置 | Domain 配置 |
|------|---------------|
| Jason `ros2_ws` | **无任何 ROS_DOMAIN_ID / domain_id 配置** |
| Jason VM 249 | **不可达，无法实机确认** |
| AGV docker-compose | `ROS_DOMAIN_ID: ${ROS_DOMAIN_ID:-30}` |
| AGV devices.yaml | `cameras.ros_domain_id: 30` |
| 部分 AGV 代码 | 仍 `get(..., "30")` 默认值 — Phase 4 adapter **禁止硬编码** |

### 11.2 设计

1. **Adapter** 启动日志打印：`effective_domain_id=os.environ.get("ROS_DOMAIN_ID")`
2. **Jason 侧运行 SOP 补充**（文档，非改 driver）：启动前 `export ROS_DOMAIN_ID=<与 AGV 相同>`
3. **配置单一真源**：`devices.yaml` → launch 注入 env；docker 已支持 `${ROS_DOMAIN_ID:-30}`
4. Phase 4 可选：`camera_bridge/config/jason_basler.yaml` 增加注释说明 cross-VM 需一致

---

## 12. 跨 VM ROS2 通信方案（静态设计 + 检查清单）

### 12.1 拓扑

```text
AGV VM 192.168.18.240                Jason VM 192.168.18.249
┌─────────────────────────┐          ┌─────────────────────────┐
│ Docker delivery_gazebo  │          │ Jason ros2_ws           │
│ ROS_DOMAIN_ID=?         │◄─ DDS ─►│ ROS_DOMAIN_ID=? (未确认) │
│ camera_adapter_node     │          │ pylon + qrcode nodes    │
└─────────────────────────┘          └───────────┬─────────────┘
                                                 │ GigE
                                                 ▼
                                      Camera 192.168.18.251
```

### 12.2 跨 VM DDS 通信检查清单（设备恢复后执行）

| # | 检查项 | 命令/方法 | 通过标准 |
|---|--------|-----------|----------|
| 1 | L3 互通 | `ping 249` from 240 | 双向可达 |
| 2 | Domain 一致 | 两边 `echo $ROS_DOMAIN_ID` | 相同整数 |
| 3 | RMW 一致 | `echo $RMW_IMPLEMENTATION` | 建议同为 `rmw_fastrtps_cpp` |
| 4 | 组播/防火墙 | `iptables -L` / 安全组 | UDP 7400-7500 等 DDS 端口放行 |
| 5 | Docker network | AGV 容器 `network_mode: host` 已启用 | 容器与宿主同 DDS 域 |
| 6 | 接口绑定 | `FASTRTPS_DEFAULT_PROFILES_FILE` 如需 | 多网卡时指定 `ens33` |
| 7 | Jason 发布 | 249 上 `ros2 topic list` | 可见 pylon image_raw |
| 8 | AGV 订阅 | 240 容器 `ros2 topic echo <jason topic> --once` | 收到真实帧 |
| 9 | 反向 | adapter 发布 `/camera/cam_front/image_raw` | 240 本机可见 |
| 10 | 性能 | `ros2 topic hz` | fps 稳定；无 Pylon 3774873620 |

**当前状态**：清单 **全部未测**（249/251 不可达）。不得写 PASS。

### 12.3 备选：同机部署 Jason 栈

若跨 VM DDS 困难，可将 Jason 节点与 Adapter 同跑在 240（需装 Pylon + 相机同网段）。设计仍用 **topic 配置化**，与部署位置无关。

---

## 13. Web → ROS2 → Adapter 完整控制链

```text
┌──────────── Web UI ────────────┐
│ 模式: DEV | REAL               │
│ 按钮: 屏蔽 cam_front/left/right│
└───────────────┬────────────────┘
                │ HTTP
                ▼
┌──────── dashboard_node ────────┐
│ POST /api/env  → set_env()     │──► env.json (adapter_mode)
│ POST /api/camera/mode          │──► camera/mode_cmd (新增 publish)
│ POST /api/camera/mask          │──► camera/mask_cmd
│ GET  /api/camera/status        │◄── camera/status
│ GET  /api/camera/*/stream      │◄── /camera/*/image_raw
│ POST /api/detect_qr (若有)     │──► camera/detect_qr service
└───────────────┬────────────────┘
                │ ROS2
                ▼
┌────── camera_adapter_node ─────┐
│ mode + mask + jason ingress    │
│ REAL: no fake                  │
│ DEV: jason first, else sim tag │
└───────────────┬────────────────┘
                │ sub
                ▼
┌────── Jason VM / 本机 ─────────┐
│ pylon_ros2_camera_node         │
│ wechat_qr_node                 │
└────────────────────────────────┘
```

---

## 14. 异常处理与日志

### 14.1 错误码（统一字符串）

`CAMERA_UNAVAILABLE` | `NO_FRAME` | `CAPTURE_TIMEOUT` | `NO_RESULT` | `RECOGNITION_FAILED` | `RECOGNITION_TIMEOUT` | `SERVICE_UNAVAILABLE` | `CAMERA_MASKED`

### 14.2 日志事件（Adapter）

| 日志 | 级别 | 触发 |
|------|------|------|
| `Camera Connected` | INFO | 首帧 |
| `Camera Disconnected` | ERROR | 帧超时 |
| `Frame Received` | DEBUG | 可 throttle |
| `Frame Timeout` | ERROR | `_frame_timeout_sec` |
| `Recognition Success` | INFO | QR 转发 |
| `Recognition Failed` | WARN | 解码空 |
| `Recognition Timeout` | ERROR | DetectQr 超时 |
| `ROS2 Service Available` | INFO | detect_qr server ready |
| `Camera Masked` | INFO | mask off |

**禁止** `Camera failed → fake success` 类日志。

---

## 15. 测试计划（分阶段，明确 Real/Dev 边界）

### 15.1 当前可执行（无真机）

| ID | 测试 | 类型 | 可宣称 |
|----|------|------|--------|
| T0 | Python 语法 / import adapter | 静态 | 仅静态 |
| T1 | launch adapter 无 Jason 源 | 接口 | DEV/REAL 均报 `CAMERA_UNAVAILABLE` |
| T2 | 注入 fake Jason topic（**单元测试 fixture，非 REAL 路径**） | 接口 | Adapter 翻译正确 |
| T3 | mask_cmd | 功能 | MASKED 不转发 |
| T4 | mode_cmd REAL + sim 源 | 功能 | REAL 拒绝 sim QR |
| T5 | DetectQr 错误码 | 功能 | 各错误码正确 |

### 15.2 设备恢复后（才可宣称 Real）

| ID | 测试 | 需硬件 |
|----|------|--------|
| R1 | ping 251 + Pylon 发现 | 相机 |
| R2 | Jason launch + `ros2 topic hz .../image_raw` | 相机+249 |
| R3 | `ros2 topic echo /wechat_qr_node/decoded_info` | 相机+QR 码 |
| R4 | 跨 VM DDS echo Jason topic on 240 | 240+249 网络 |
| R5 | Adapter REAL 模式端到端 | 全链路 |
| R6 | Web `/api/camera/status` online=true | 全链路 |
| R7 | DetectQr 真实 payload | 全链路 |

---

## 16. 不修改 Jason Driver 的原因

1. Jason 栈已在 249 独立开发/验收（交接包完整）
2. Pylon 驱动升级应跟随 Basler 官方与 Jason 维护节奏
3. AGV 只需 **DDS 层契约**，不应耦合 SDK 版本
4. 降低集成风险与合并冲突
5. 未来换相机只需换 Adapter 配置/映射，不动 AGV 业务与 Jason 驱动

---

## 17. Phase 4 最小实现范围（下一阶段，**本报告完成后才做**）

| 顺序 | 任务 |
|------|------|
| 1 | 创建 `camera_adapter_node.py` |
| 2 | 创建 `config/jason_basler.yaml` + launch |
| 3 | 扩展 `devices.yaml` |
| 4 | `dashboard_node.set_env` 增加 `camera/mode_cmd` publish（~5 行） |
| 5 | `boot_gazebo_lite.sh` REAL 路径：不启 sim QR 到 cam_front（条件化） |
| 6 | 静态/接口测试 + 更新 PROGRESS.md |

**明确不做**：重写 Jason、重写 Dashboard、重写 ingress、新增 msg/srv。

---

## 18. 暂停点

✅ Phase 2 设计报告已完成。  
⛔ **未进行任何业务代码修改。**  
⏭ 等待你确认本设计后，进入 Phase 4 最小实现。

### 请你确认的设计决策

1. Jason Basler → 逻辑相机 **`cam_front`**（沿用 docs/25）是否 OK？  
2. 跨 VM DDS vs 240 同机跑 Jason 栈，优先哪种？  
3. `camera/mode_cmd` 新 topic 是否同意？（或改用读 `env.json` 轮询）  
4. Phase 4 是否先只做 **cam_front + QR**，AprilTag 后续？

---

*文档版本：Phase2-v1 · 2026-08-13*
