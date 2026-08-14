# AGV × Jason 工业相机集成审计报告

> **审计类型**：只读集成审计（Phase 1）— **未修改任何业务代码**  
> **审计时间**：2026-08-13  
> **审计执行位置**：虚拟机 `192.168.18.240`（SSH 实测）+ 本地 Cursor 工作区留痕  
> **审计原则**：不知道就查代码；文件存在 ≠ 功能完成；禁止把 Mock/Stub 当作真机能力

---

## 0. 审计结论摘要（先读）

| 项 | 结论 |
|----|------|
| Jason 工业相机 SDK | **Basler Pylon**（`pylon_ros2_camera_*` 官方驱动栈） |
| 相机型号（配置证据） | **Basler acA2500-14GC**，`device_user_id="106611-18"` |
| 连接方式 | **GigE 以太网**；代码用 `device_user_id` 选设备，**不是**在 YAML 里写 IP |
| `192.168.18.251` 是否在 Jason 代码中 | **否**（全仓库 grep 无匹配）；IP 需运行时通过 `ip_configuration.launch.py` 配置 |
| Jason ROS2 是否已编译 | **是**（`Jason.Chen/ros2_ws/install/` 存在，2026-08-12 build） |
| 本次能否 ping 通相机 / Jason VM | **否**（从 AGV VM：`192.168.18.251` 100% loss；`192.168.18.249` SSH 超时） |
| 本次能否完成真实取图/识别 | **否**（硬件/网络不可达；Jason 栈未在本 VM 运行） |
| AGV 侧相机接入预留 | **有**（`camera_bridge` + `camera_ingress_node` + `delivery_interfaces`） |
| AGV 与 Jason 接口是否已对齐 | **否**（Topic/Msg/Service 命名与语义均不一致） |
| 推荐下一步 | **新增 `camera_adapter_node`（setup.py 已注册但源文件缺失）**，做 Jason→AGV 协议翻译 |
| 是否允许现在开始大规模改码 | **否** — 等本报告确认后再进入 Phase 4 |

---

## 1. 审计范围与路径

### 1.1 用户给定根目录

```text
/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921
```

### 1.2 实测目录结构（2026-08-13 SSH）

```text
/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/
├── AGVAPI文档/
├── note/
├── Jason.Chen/
│   └── ros2_ws/                          # Jason 工业相机工作区（已 colcon build）
└── AGV_Delivery_v0.2.0_20260807_0921/    # AGV 工程内层根（真正 workspace_v02 在这里）
    ├── workspace_v02/
    ├── .run/
    ├── docs/ reports/ scripts/
    └── note_share_25_相机ROS2_复制即用.txt
```

> **注意**：`workspace_v02` 不在最外层，而在内层 `AGV_Delivery_v0.2.0_20260807_0921/` 下。

### 1.3 相关文档已读

| 文档 | 路径 | 用途 |
|------|------|------|
| 相机工业契约 | `.../docs/25_相机ROS2工业契约.md` | AGV 期望的 Topic/Service |
| 复制即用摘要 | `.../note_share_25_相机ROS2_复制即用.txt` | Xavier 侧发布规范 |
| Jason README | `Jason.Chen/ros2_ws/README.md` | Jason 启动命令 |
| Jason 交接 SOP | `Jason.Chen/ros2_ws/handover_ros2_integration_2026-08-07/` | 运行/验收/故障 |
| 既有 AGV 状态报告 | 本地 `AGV_PROJECT_STATUS.md` | 背景参考（2026-08-11） |

---

## 2. 网络与硬件可达性（实测，非猜测）

### 2.1 AGV 虚拟机网络（192.168.18.240）

```text
ens33: 192.168.18.240/24
ens37: 192.168.0.240/24
ens38: 192.168.161.128/24 (dynamic)
docker0: 172.17.0.1/16
```

### 2.2 Ping 结果（从 AGV VM 执行）

| 目标 | IP | 结果 |
|------|-----|------|
| Jason 工业相机（用户提供） | `192.168.18.251` | **FAIL** — 2 transmitted, 0 received, 100% loss |
| Jason 虚拟机（用户提供） | `192.168.18.249` | **FAIL** — SSH `:22` Connection timed out |

### 2.3 含义

- **不能假装相机在线。** 当前审计环境无法做真实取图、真实 QR 解码验收。
- Jason 项目代码已在 AGV VM 本地（`Jason.Chen/ros2_ws`），**无需重新复制**；但运行 Jason 栈需要：
  1. 宿主或容器内 **ROS 2 Humble + Basler Pylon SDK**
  2. 与相机 **同网段可达**（或 Jason VM 249 在线且相机在其侧可达）

### 2.4 Jason 历史验收日志（代码库内证据）

`Jason.Chen/ros2_ws/log/acceptance/apriltag_acceptance_20260812_151433.md` 记录：

- 相机命名空间：`/basler_106611_18`
- **camera_stream FAIL** — 30s 内无 `image_raw` / `camera_info`
- Pylon 报错：`3774873620` buffer incompletely grabbed（GigE 网络/MTU/缓冲问题）
- 说明：Jason 栈曾在某环境跑通过程，但 **2026-08-12 自动验收未通过**

---

## 3. 当前 AGV ROS2 架构

### 3.1 运行环境

| 项 | 实测值 |
|----|--------|
| 宿主 OS | Ubuntu 26.04 LTS（无 `/opt/ros`） |
| ROS2 实际运行 | Docker `delivery-ros2:humble-gazebo-v02` |
| ROS 发行版 | **ROS 2 Humble**（容器内 Ubuntu 22.04） |
| Domain | `ROS_DOMAIN_ID=30` |
| 工作空间 | `workspace_v02/ros2_ws` |

### 3.2 Package 清单（8 个）

| Package | 作用 | 语言 |
|---------|------|------|
| `delivery_interfaces` | msg/srv/action 定义 | CMake |
| `delivery_bringup` | launch + `devices.yaml` | Python(launch) |
| `delivery_web` | Dashboard HTTP + ROS 聚合 | Python |
| `delivery_gazebo` | 仿真导航/臂/相机 | Python |
| `agv_bridge` | Robokit TCP + sim | Python |
| `xarm_bridge` | 双臂 sim/实机骨架 | Python |
| `camera_bridge` | 相机 sim/stub/ingress/Xavier 骨架 | Python |
| `face_bridge` | 人脸 stub/remote | Python |

### 3.3 AGV 当前启动方式

| 模式 | 启动路径 | 实测运行节点 |
|------|----------|--------------|
| Dev 仿真（当前 Up） | `docker compose` profile `sim-soft` → `boot_gazebo_lite.sh` | 7 节点（见下） |
| Bringup launch | `.run/.../delivery_bringup/launch/sim_all.launch.py` **有内容**；`workspace_v02/.../sim_all.launch.py` **0 字节空文件** | workspace 与 .run 不一致 |

**审计时容器内运行节点：**

```text
/agv_gazebo_nav
/arm_gazebo_driver
/camera_gazebo_qr
/camera_ingress_node
/dashboard_node
/face_bridge_node
/gz_physics_proxy
```

### 3.4 AGV 相机相关 Node（`camera_bridge`）

| 可执行名 | 源文件 | 状态 |
|----------|--------|------|
| `camera_sim_node` | `camera_sim_node.py` | 仿真合成图 + 假 QR |
| `camera_bridge_node` | `camera_bridge_node.py` | **stub**，capture/detect 返回 `not implemented` |
| `camera_ingress_node` | `camera_ingress_node.py` | NUC 侧 ingress（等 Xavier compressed+heartbeat） |
| `cam_front_ros_node` | `cam_front_ros_node.py` | Xavier 侧骨架（依赖外部 `gige_capture`） |
| `xavier_cam_front_bridge` | `xavier_cam_front_bridge.py` | legacy MJPEG |
| **`camera_adapter_node`** | **`camera_adapter_node.py`** | **setup.py 已注册，源文件不存在（缺失）** |

### 3.5 AGV 相机相关 Topic / Service（设计 + 运行）

#### 3.5.1 工业契约（docs/25，面向 Xavier）

| 名称 | 类型 | 方向 |
|------|------|------|
| `/camera/cam_front/image_raw/compressed` | `sensor_msgs/CompressedImage` | Xavier → NUC |
| `/camera/cam_front/heartbeat` | `delivery_interfaces/CameraHeartbeat` | Xavier → NUC |
| `/camera/cam_front/status` | `std_msgs/String` JSON | Xavier → NUC |
| `/camera/cam_front/image_raw` | `sensor_msgs/Image` | NUC ingress → Web |
| `/camera/cam_front/info` | `delivery_interfaces/CameraInfoLite` | **仅 NUC 权威** |
| `/camera/capture` | `delivery_interfaces/CameraCapture` | Xavier 提供 |

#### 3.5.2 Dashboard 消费（`dashboard_node.py`）

| 名称 | 类型 |
|------|------|
| `/camera/{cam_front,left,right}/image_raw` | `sensor_msgs/Image` |
| `/camera/{name}/info` | `CameraInfoLite` |
| `camera/{name}/qr` | `QrDetectionArray` |
| **`camera/status`** | `std_msgs/String` JSON — **来自 camera_adapter_node（尚未实现）** |
| **`camera/mask_cmd`** | `std_msgs/String` JSON — Web → adapter |

| Service 客户端 | 类型 |
|----------------|------|
| `camera/detect_qr` | `delivery_interfaces/DetectQr` |

#### 3.5.3 Dev 仿真假数据来源（必须在 REAL 模式禁用）

| 来源 | 假数据证据 |
|------|------------|
| `camera_gazebo_qr.py` | `d.payload = "STATION_LM2"` 硬编码 |
| `camera_sim_node.py` | 合成灰度图 + 注入 QR |
| `camera_bridge_node.py` | `connected=False`，服务 `not implemented` |
| `camera_ingress_node` | 无上游时 `transport=xavier_ros2_waiting`（**正确：暴露失败，不伪造图像**） |

### 3.6 AGV 配置中的相机 IP（与 Jason 不一致）

`devices.yaml` 当前写法：

```yaml
cameras:
  basler_camera_id: "192.168.1.100"    # 旧 Xavier 方案
  cam_front_source: "ros2"
  ros_domain_id: 30
```

用户口头新拓扑：`192.168.18.251` — **与 AGV 配置和 Jason YAML 均未对齐**。

---

## 4. Jason ROS2 架构

### 4.1 工作区

| 项 | 值 |
|----|-----|
| 路径 | `/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/Jason.Chen/ros2_ws` |
| 构建 | `install/`、`build/` 存在（2026-08-12） |
| 宿主 ROS | **无** `/opt/ros/humble`（与 AGV VM 相同） |
| 文档默认路径 | `/home/ubuntu/ros2_ws`（Jason README；与当前拷贝路径不同，启动时需改路径或用 symlink） |

### 4.2 Package 清单（5 个）

| Package | 作用 | 来源 |
|---------|------|------|
| `pylon_ros2_camera_component` | Basler Pylon 相机核心 C++ 节点 | Basler 官方 `pylon-ros-camera` |
| `pylon_ros2_camera_wrapper` | launch + config + wrapper 可执行 | Basler 官方 |
| `pylon_ros2_camera_interfaces` | Pylon 专用 msg/srv/action | Basler 官方 |
| `qrcode_detector` | QR 识别（OpenCV / 可选 WeChatQR） | Jason 自研 |
| `apriltag_pose_reader` | AprilTag TF→Pose 转发 | Jason 自研 |

### 4.3 工业相机 SDK（代码确认，非猜测）

| 项 | 证据 |
|----|------|
| SDK | **Basler Pylon** |
| 驱动仓库 | `github.com/basler/pylon-ros-camera`（`package.xml` url） |
| 安装文档 | `Jason.Chen/ros2_ws/BASLER_INSTALL_GUIDE.md` |
| Pylon 路径（launch 默认） | `/opt/pylon` |
| 相机型号 | `aca2500_106611_18.yaml` → **acA2500-14GC**, S/N 22297681 |
| 选相机方式 | YAML `device_user_id: "106611-18"`（Pylon DeviceUserID，**非 IP**） |
| 连接 | **GigE**（YAML 含 `mtu_size`, `inter_pkg_delay`；SOP 含 IP 配置流程） |

### 4.4 Jason Node 与 Launch

| 组件 | Node 名 | Launch |
|------|---------|--------|
| 相机 | `{camera_id}/pylon_ros2_camera_node`（默认 `camera_id=my_camera`） | `pylon_ros2_camera.launch.py` |
| QR | `wechat_qr_node` | `qrcode_detector.launch.py` |
| AprilTag 姿态 | `apriltag_pose_reader` 相关 | `apriltag_pose_reader.launch.py` |

**Jason 推荐启动（README / SOP）：**

```bash
# 1) 相机
ros2 launch pylon_ros2_camera_wrapper pylon_ros2_camera.launch.py \
  config_file:=.../aca2500_106611_18.tuned_v3.yaml

# 2) QR
ros2 launch qrcode_detector qrcode_detector.launch.py

# 一键
./scripts/deploy_and_run_camera_qr.sh
```

### 4.5 Jason Topic（默认命名，来自 launch 默认值）

| Topic | 类型 | 发布者 | 订阅者 |
|-------|------|--------|--------|
| `/{camera_id}/pylon_ros2_camera_node/image_raw` | `sensor_msgs/Image` | Pylon 节点 | QR 节点（默认订阅此 topic） |
| `/{camera_id}/pylon_ros2_camera_node/camera_info` | `sensor_msgs/CameraInfo` | Pylon 节点 | AprilTag 等 |
| `/wechat_qr_node/decoded_info` | `std_msgs/String` | `wechat_qr_node` | 下游（Jason 文档验证用） |
| `/apriltag/pose` | `geometry_msgs/PoseStamped` | apriltag_pose_reader | — |
| `/apriltag/transform` | `geometry_msgs/TransformStamped` | apriltag_pose_reader | — |

> 部署脚本默认 `CAMERA_ID=basler_106611_18`，则图像 topic 为  
> `/basler_106611_18/pylon_ros2_camera_node/image_raw`  
> （与 launch 默认 `my_camera` 不同，**以实际 launch 参数为准**）

### 4.6 Jason Service / Action

| 类别 | 名称模式 | 说明 |
|------|----------|------|
| Pylon 控制 Service | `/{ns}/pylon_ros2_camera_node/set_*` 等大量服务 | 曝光、增益、ROI、触发等 |
| Pylon Action | `GrabImagesAction`（raw/rect） | 单次抓图 action |
| QR | **无 Service** | 仅 Topic 持续输出 |
| AprilTag | 依赖 `apriltag_ros` + TF | 非 AGV `DetectQr` 接口 |

### 4.7 Jason 真实数据链路（代码级）

```text
Basler acA2500-14GC (GigE)
        │
        ▼
Basler Pylon SDK (/opt/pylon)
        │
        ▼
pylon_ros2_camera_component (C++ PylonROS2CameraNode)
        │
        ├──► /{ns}/pylon_ros2_camera_node/image_raw      (持续发布)
        └──► /{ns}/pylon_ros2_camera_node/camera_info
        │
        ▼
qrcode_detector/wechat_qr_node
        │  订阅 image_raw → OpenCV/WeChatQR 解码
        ▼
/wechat_qr_node/decoded_info   (std_msgs/String，有码才 publish)
```

**真实图像产生点**：`pylon_ros2_camera_node` 的 Pylon grab 循环。  
**真实 QR 结果产生点**：`qrcode_node.py` 的 `_decode_qr()` → `result_pub.publish(String)`。

---

## 5. AGV 与 Jason 接口对照（缺口分析）

### 5.1 消息/Topic 对照表

| 能力 | AGV 期望 | Jason 实际 | 对齐？ |
|------|----------|------------|--------|
| 原始图像 | `/camera/cam_front/image_raw` 或 compressed | `/{ns}/pylon_ros2_camera_node/image_raw` | **否**（命名+是否 compressed） |
| 相机心跳 | `/camera/cam_front/heartbeat` | **无** | **否** |
| 相机状态 JSON | `/camera/cam_front/status` | Pylon `ComponentStatus`（不同 msg） | **否** |
| 权威 info | `/camera/cam_front/info` (`CameraInfoLite`) | `camera_info` (`sensor_msgs/CameraInfo`) | **否** |
| QR 结果 | `camera/cam_front/qr` (`QrDetectionArray`) | `/wechat_qr_node/decoded_info` (`String`) | **否** |
| 系统状态 | `camera/status` JSON | **无** | **否** |
| 单次拍/识别 | `camera/detect_qr` Service | **无**（QR 为 streaming topic） | **否** |

### 5.2 架构冲突（必须解决，不能硬连）

1. **AGV docs/25** 设计为 **Xavier 发布 compressed+heartbeat**，NUC `camera_ingress_node` 解码 — Jason 直接发 `sensor_msgs/Image` raw。  
2. **AGV dashboard** 已预留 **`camera_adapter_node`** + `camera/status` + `camera/mask_cmd`，但 **adapter 源文件缺失**。  
3. **Jason 不使用 `192.168.18.251` 字符串**；AGV `devices.yaml` 仍写 `192.168.1.100`。  
4. **三相机**（cam_front/left/right）vs Jason **单 Basler** — 需明确 Jason 相机映射到哪个逻辑名（建议 `cam_front` 或独立 `cam_basler`）。  
5. **Dev 仿真** 已有假 QR（`STATION_LM2`）— REAL 模式必须 **完全绕过** `camera_gazebo_qr` / `camera_sim_node`。

### 5.3 已存在 vs 缺失 vs 需新增

| 类别 | 已存在 | 缺失 | 需新增（建议） |
|------|--------|------|----------------|
| Jason 侧 | Pylon 驱动、QR 节点、launch、build 产物 | 与 AGV 契约对齐的 wrapper | 可选：Jason 侧 thin republisher（非必须，adapter 在 AGV 侧即可） |
| AGV 侧 | `delivery_interfaces`、`camera_ingress_node`、dashboard 订阅、setup.py 入口 | **`camera_adapter_node.py`** | **Adapter 节点 + launch + config + 模式开关** |
| 集成 | 同 VM 上有两份代码 | 网络互通、Pylon 在 AGV 运行环境、端到端测试 | Phase 2–7 联调与异常测试 |

---

## 6. 推荐集成方案（待你确认后再开发）

> 原则：**不修改 Jason 核心驱动**；**新增 AGV Adapter**；**REAL 禁止 fake**；**DEV 优先真机**。

### 6.1 目标数据流（推荐）

```text
Industrial Camera 192.168.18.251 (GigE)
        │
        ▼
Basler Pylon SDK
        │
        ▼
Jason: pylon_ros2_camera_node          (Jason.Chen/ros2_ws, 同 Domain 或同机)
        │  /{ns}/pylon_ros2_camera_node/image_raw
        │  /{ns}/pylon_ros2_camera_node/camera_info
        ▼
Jason: wechat_qr_node (可选)
        │  /wechat_qr_node/decoded_info
        ▼
AGV NEW: camera_adapter_node           (camera_bridge 包内，补缺失文件)
        │  订阅 Jason topics
        │  发布 AGV 契约:
        │    /camera/cam_front/image_raw
        │    /camera/cam_front/info (CameraInfoLite)
        │    camera/cam_front/qr (QrDetectionArray)
        │    camera/status (JSON: online/error/NO_FRAME/...)
        │  提供 camera/detect_qr → 读缓存或触发一次识别，失败返回明确错误码
        ▼
dashboard_node / 导航 / 机械臂（已有订阅）
```

### 6.2 建议新增/修改项（Phase 4 范围，**本报告不实施**）

| 项 | 建议 |
|----|------|
| **Node** | 实现 `camera_bridge/camera_adapter_node.py`（setup.py 已指向它） |
| **Config** | `camera_bridge/config/jason_basler.yaml`：`pylon_image_topic`, `qr_topic`, `camera_name=cam_front`, `pylon_ns`, `camera_ip`（仅用于健康检查 ping，不写密码） |
| **Launch** | `camera_bridge/launch/jason_camera_real.launch.py` — 仅起 adapter（Jason 栈由 Jason 脚本起）或 compose 编排 |
| **Mode** | 环境变量 `CAMERA_MODE=real|dev|mock`；**mock 与 dev 隔离**；real 时 disable gazebo/sim QR |
| **错误码** | `CAMERA_UNAVAILABLE`, `NO_FRAME`, `CAPTURE_TIMEOUT`, `RECOGNITION_FAILED`, `RECOGNITION_TIMEOUT`, `SERVICE_UNAVAILABLE` |
| **devices.yaml** | 增加 `jason` 段：image topic、qr topic、logical name；更新 IP 为 `192.168.18.251`（与现场一致） |
| **修复** | 恢复空的 `workspace_v02/.../sim_all.launch.py`（从 `.run` 同步） |

### 6.3 REAL / DEV / MOCK 设计

| 模式 | 允许 | 禁止 |
|------|------|------|
| **REAL** | 仅 Jason Pylon 真图 + 真 QR/AprilTag 结果 | 任何 fake/mock/random/写死 QR |
| **DEV** | 优先 Jason 真机；真机离线时可只显示 **明确错误**；可选仅转发真图、识别失败报 `RECOGNITION_FAILED` | 默认 test.jpg / fake_result |
| **MOCK** | 仅 `camera_sim_node` / `camera_gazebo_qr`；必须与 REAL 完全隔离（不同 launch profile） | 与 REAL 同时启用；mock 结果写入 `cam_front` 而不标注 source |

**dashboard 已有 `adapter_mode`**（`set_env` 时设置 simulation/real）— adapter 应读取并执行。

### 6.4 Service vs Topic 策略

| 场景 | 建议 |
|------|------|
| 实时画面 | 订阅 Jason `image_raw` → adapter 转发（Topic） |
| 持续 QR | 订阅 `/wechat_qr_node/decoded_info` → 转 `QrDetectionArray`（Topic） |
| Dashboard `detect_qr` Service | adapter 实现：**返回最近一次真实结果**；无结果则 `success=false`, `message=NO_RESULT/RECOGNITION_TIMEOUT` — **绝不返回假码** |
| 单次抓图 | 可调用 Pylon `GrabImages` action（可选）；失败 → `CAPTURE_TIMEOUT` |

---

## 7. 测试方案（Phase 2–7，待网络恢复后执行）

| # | 场景 | 操作 | 期望 |
|---|------|------|------|
| T1 | Camera online | Jason 起 pylon + `ros2 topic hz .../image_raw` | 有稳定帧率；`rqt_image_view` 见真图 |
| T2 | Camera offline | 停相机或断网 | adapter 报 `CAMERA_UNAVAILABLE`；**无 QR 成功** |
| T3 | No frame | Pylon 节点在但 grab 失败 | `NO_FRAME` / `CAPTURE_TIMEOUT` |
| T4 | QR 失败 | 镜头无码 | `decoded_info` 无输出；`detect_qr` → `NO_RESULT` |
| T5 | QR 成功 | 对准真实二维码 | `QrDetectionArray.payload` = 真实字符串 |
| T6 | Service 不可用 | 停 adapter | Dashboard `detect_qr` → `SERVICE_UNAVAILABLE` |
| T7 | REAL 模式守卫 | `mode=real` 时 | 无 `STATION_LM2` 等仿真 QR 进入 `cam_front/qr` |

---

## 8. 日志要求（与实现对齐）

adapter 必须输出可区分日志（禁止 silent fake success）：

```text
Camera Connected / Disconnected
Frame Received / Frame Timeout
Recognition Started / Success / Failed / Timeout
ROS2 Service Available / Unavailable
```

---

## 9. 当前阻塞项（进入 Phase 2 前）

1. **网络**：AGV VM ↔ `192.168.18.251` / `192.168.18.249` 不通  
2. **运行环境**：Jason 栈需 Humble + Pylon；AGV VM 宿主无 ROS，需定：**Jason 在 249 跑 + DDS 跨机**，或 **在 240 装 Pylon 并接相机**  
3. **配置统一**：`192.168.18.251` vs `192.168.1.100` vs `device_user_id`  
4. **缺失代码**：`camera_adapter_node.py` 未实现  
5. **workspace 损坏**：`sim_all.launch.py` 在 workspace 为空文件  

---

## 10. 建议执行顺序（你确认后）

```text
Phase 1  项目审计                    ← 本报告（已完成）
Phase 2  Jason 相机真实连接验证       ← 需 249/251 网络 + Pylon
Phase 3  ROS2 接口验证               ← ros2 topic/service 实测
Phase 4  AGV camera_adapter_node     ← 新增，不重构全栈
Phase 5  DEV 模式（真机优先）
Phase 6  REAL 模式（100% 真数据）
Phase 7  异常测试
Phase 8  与 dashboard / 导航联调
```

---

## 11. 审计证据索引

| 证据 | 位置 |
|------|------|
| AGV 包列表 | VM `find .../workspace_v02/ros2_ws/src/*/package.xml` |
| AGV 运行节点 | `docker exec delivery_gazebo_soft ros2 node list` @ 2026-08-13 |
| Jason 包列表 | `Jason.Chen/ros2_ws/src/*/package.xml` |
| Jason SDK | `pylon_ros2_camera_wrapper/package.xml`, `aca2500_106611_18.tuned_v3.yaml` |
| Jason QR topic | `qrcode_node.py` L189, `qrcode_detector.launch.py` |
| AGV 假 QR | `camera_gazebo_qr.py` L66 `STATION_LM2` |
| adapter 缺失 | `setup.py` 有 entry；`camera_adapter_node.py` 不存在 |
| dashboard 预留 | `dashboard_node.py` L445–449, L831+, L1031 |
| Ping 失败 | SSH 脚本输出 @ 2026-08-13 |
| Jason 验收 FAIL | `log/acceptance/apriltag_acceptance_20260812_151433.md` |

---

## 12. 暂停点

**本报告完成后停止。** 未进行：

- 任何 AGV / Jason 业务代码修改  
- adapter 实现  
- launch 编排变更  

请你确认：

1. Jason 栈运行位置：**249 远程 DDS** vs **240 本机接相机**  
2. 逻辑相机名：Jason Basler 映射 **`cam_front`** 还是新名字  
3. Phase 1 范围：是否包含 AprilTag，或先做 **相机 + QR**  
4. 是否同意按 §6 新增 `camera_adapter_node`（而非改 Jason Pylon 驱动）

确认后再进入 Phase 2–4 开发。

---

*报告生成：AGV × Jason 工业相机集成审计 · 2026-08-13 · 只读*

---

## 附录：后续阶段文档索引（不修改上文审计结论）

| 日期 | 文档 | 阶段 |
|------|------|------|
| 2026-08-13 | `AGV_JASON_CAMERA_INTEGRATION_PHASE2_DESIGN.md` | Phase 2 设计（Adapter/Domain/IP/跨 VM） |
| 2026-08-13 | `AGV_JASON_CAMERA_INTEGRATION_PROGRESS.md` | 进度留痕（追加式） |
| 2026-08-13 | `AGV_JASON_CAMERA_INTEGRATION_PHASE4_PLAN.md` | Phase 4 实现计划（Plan-only，待确认） |
