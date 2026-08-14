# AGV项目当前状态分析报告

> **审计类型**：只读技术架构审计（不改代码、不补功能、不自动修复）  
> **审计时间**：2026-08-11  
> **审计对象版本**：`AGV_Delivery_v0.2.0`（打包戳 `20260807_0921`，工作区 `VERSION=0.2.0`）  
> **证据来源**：
> 1. 虚拟机 `192.168.18.240` 实际路径与运行态  
> 2. 仓库源码 / 配置 / docs / reports  
> 3. 本机解压副本 `_audit_extract/AGV_Delivery_v0.2.0_20260807_0921`（与 VM 同源包）  
>
> **结论原则**：文件存在 ≠ 功能完成；文档宣称 ≠ 已验收；Mock/Dev PASS ≠ Demo 就绪。

---

## 1. 项目概况

### 1.1 项目定位（来自任务背景 + 仓库文档）

本仓库是公司复合型 AGV / 未来 AIGV 的软件底座，当前冻结在 **v0.2.x 送货 Demo 联调栈**：

- 目标 Phase 1：任务接收 → 移动到站点 → 识别 → 取放/操作 → 送达/返回  
- 当前仓库实际交付重心：**Dev 仿真（Gazebo lite / physics proxy）+ Web Dashboard + Robokit TCP 客户端 + 相机/人脸接口契约**  
- 项目自有正式门禁（`docs/27`）：**不得宣称 Demo 就绪**；仅允许受控现场联调

### 1.2 审计时现场可达性（实测）

| 目标 | IP | 审计结果 |
|------|----|----------|
| 虚拟机（项目所在） | `192.168.18.240` | **可达**；主机名 `ALPHA`；`ens33=192.168.18.240/24` |
| NUC | `192.168.18.207` | **不可达**（SSH 超时；从 VM ping FAIL） |
| AGV | `192.168.18.198` | **不可达**（ping FAIL；`19204–19207` 全部 “没有到主机的路由”） |
| Jetson | `192.168.0.207` | **不可达**（从 VM ping FAIL） |

说明：用户资料里 Jetson 为 `192.168.0.207`，但仓库默认配置仍大量写 `192.168.0.225`（`devices.yaml` / `face_bridge` / docker compose）。**配置与当前口头拓扑不一致，属接口风险。**

### 1.3 虚拟机上的真实路径（重要）

用户给出路径：

`/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921`

实测该路径下是**再包一层**的解压结果：

```text
/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/
├── AGVAPI文档/                          # 仙工 Roboshop 手册
├── note/                                # 交接/相机契约等笔记
└── AGV_Delivery_v0.2.0_20260807_0921/   # ← 真正工程根
    ├── workspace_v02/                   # 源码工作区
    ├── .run/                            # 运行镜像副本
    ├── docs/ reports/ scripts/
    ├── agv_downloaded/ docker_data/ images/
    └── ...
```

**真正工程根：**

`/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/AGV_Delivery_v0.2.0_20260807_0921`

### 1.4 当前运行态（审计时实测）

| 项 | 状态 |
|----|------|
| Docker 容器 `delivery_gazebo_soft` | **Up**（image `delivery-ros2:humble-gazebo-v02`） |
| 运行模式 `env.json` | `"mode": "dev"`，`use_sim_cameras: true` |
| 人脸后端 | `FACE_BACKEND=stub`（进程参数实测） |
| 相机前路 | `camera_ingress_node` 已起，等待外部 Xavier 发布（本机无 Xavier） |
| Action | `ros2 action list` **空** |
| 真车桥接 `agv_bridge_node` | **未启动**（符合 soft boot 设计） |

---

## 2. 当前系统架构

### 2.1 项目目录树（工程根，标注用途）

```text
AGV_Delivery_v0.2.0_20260807_0921/          # 工程根
├── workspace_v02/                          # 【真实代码】ROS2 工作区 + Docker
│   ├── VERSION                             # 0.2.0
│   ├── README.md
│   ├── config/
│   ├── docker/                             # Dockerfile / compose / boot 脚本
│   ├── gazebo/                             # 仿真模型与 worlds（VM 上存在）
│   ├── scripts/                            # smoke / pack 脚本
│   └── ros2_ws/                            # 【ROS2 工作空间】
│       └── src/                            # 8 个 package（见 §3）
├── .run/                                   # 【运行副本】部署用镜像树（与 workspace 双份）
├── docs/                                   # 【文档】00–28（索引未完全同步）
├── reports/                                # 【过程报告】联调/交接/快照
├── scripts/                                # 顶层 smoke / deploy
├── agv_downloaded/                         # smap / stations / 地图资产
├── docker_data/volumes/logs_v02/           # 运行日志、env.json
├── images/                                 # docker image tar（转移用）
├── windows/                                # Windows 辅助脚本
├── TRANSFER_UNPACK_README.md
└── MANIFEST.txt
```

旁路文档（工程根外一层）：

- `AGVAPI文档/`：Roboshop 使用手册（端口、配置、诊断）— **不是本仓库自研驱动**
- `note/`：交接材料、相机契约包、历史说明

### 2.2 目录性质判定

| 路径 | 性质 | 判定 |
|------|------|------|
| `workspace_v02/ros2_ws/src/*` | 真实 Python/CMake ROS2 包 | **真实代码** |
| `workspace_v02/docker/*` | 可运行 compose / boot | **真实部署资产** |
| `.run/workspace_v02` | 运行同步副本 | **真实运行树**（编辑约定：改 src 后需同步） |
| `docs/` + `reports/` | 设计/门禁/联调记录 | **文档**；部分结论有时效 |
| `agv_downloaded/` | 地图/站点 JSON/smap | **数据资产** |
| `*_sim_node` / `robokit_mock_server` / `jetson_fake_face_pub` / stub backend | 仿真/桩 | **模板/桩代码**，不能计为真机完成 |
| `camera_bridge_node` / `colleague_sdk` | 接口骨架 | **接口预留** |
| 仓库内 `Nav2/SLAM/MoveIt` | — | **未实现（不存在）** |
| 型号 `CSFHC5S2` / 超声波×8 | — | **仓库无对应实现与配置** |

### 2.3 逻辑架构（以仓库实际控制路径为准）

```text
                         Web Dashboard (:19999 / :1999)
                                dashboard_node
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
   Dev (当前实测)                Demo (代码存在)              相机 / 人脸
          |                           |                           |
   Gazebo lite 栈              RobokitClient TCP            ROS2 topics
   agv_gazebo_nav              -> 192.168.18.198            camera_ingress
   gz_physics_proxy            端口 19204-19207             face_bridge(stub)
   arm_gazebo_driver           API 1004/1007/1009/...       (Xavier/Jetson 离线)
   camera_gazebo_qr
```

**关键事实（`docs/27` 已写死）**：

- Dev 与 Demo 是**两套控制实现**  
- soft 路径默认**不起** `agv_bridge_node`  
- Demo 主路径是 **Dashboard 直连 RobokitClient**，不是 Nav2 `cmd_vel`

---

## 3. ROS2状态分析

### 3.1 运行环境（实测）

| 层级 | 发行版 / 版本 | 证据 |
|------|----------------|------|
| 虚拟机宿主 | Ubuntu **26.04** LTS；Python **3.14.4**；无 `/opt/ros`；无 host `colcon` | SSH 实测 |
| ROS2 实际运行环境 | **Docker** `delivery-ros2:humble-*` | `docker images` / `docker ps` |
| 容器内 ROS | **ROS 2 Humble**；Ubuntu **22.04.5**；Python **3.10.12**；g++ **11.4.0**；有 `colcon` | `docker run ...` 实测 |
| Domain | `ROS_DOMAIN_ID=30` | compose / boot 脚本 |

> 宿主 Ubuntu 26 / Python 3.14 **不是** ROS Humble 官方目标环境；项目依赖容器运行，这是当前可工作的前提。

### 3.2 Workspace 与 Package 清单

工作空间：`workspace_v02/ros2_ws`

| Package | 作用（来自 package.xml/代码） | 语言 | 关键依赖 | 状态 |
|---------|-------------------------------|------|----------|------|
| `delivery_interfaces` | msg/srv/action 定义 | CMake/rosidl | std/geometry/action_msgs | **部分实现**（action 无运行时） |
| `delivery_bringup` | launch + `devices.yaml` | Python(launch) | 各 bridge / web | **部分实现**（无业务节点） |
| `delivery_web` | Web Dashboard + 状态聚合 | Python | rclpy, delivery_interfaces | **部分实现**；**缺少包内测试** |
| `delivery_gazebo` | 仿真导航/臂/相机/物理代理 | Python | gazebo_ros*, tf2, nav_msgs… | **部分实现**（lite 路径可运行） |
| `agv_bridge` | Robokit TCP + sim + mock | Python | rclpy, delivery_interfaces | **部分实现**；真车闭环 **验证失败/未完成** |
| `xarm_bridge` | 双臂 sim + 实机骨架 | Python | rclpy；可选 `xarm-python-sdk` | **部分实现**；无 SDK 则 offline |
| `camera_bridge` | 相机 sim / stub / Xavier ingress | Python | rclpy, sensor_msgs… | sim **部分实现**；实机桥 **stub/接口预留** |
| `face_bridge` | 人脸桥接 | Python | rclpy, delivery_interfaces | 默认 **stub**；SDK **接口预留** |

### 3.3 节点 / Topic / Service / Action

#### 3.3.1 审计时正在运行的节点（容器实测）

```text
/agv_gazebo_nav
/arm_gazebo_driver
/camera_gazebo_qr
/camera_ingress_node
/dashboard_node
/face_bridge_node          # backend:=stub
/gz_physics_proxy
```

未运行但代码存在的重要节点：`agv_bridge_node`、`agv_sim_node`、`xarm_bridge_node`、`camera_bridge_node`、`cam_front_ros_node`、`robokit_mock_server` 等。

#### 3.3.2 Topic（运行时 `ros2 topic list`）

| Topic | 当前含义 |
|-------|----------|
| `/agv/cmd_vel` `/agv/odom` `/tf` | Dev 仿真运动链 |
| `/arm/left/status` `/arm/right/status` `/joint_states` | 仿真臂状态 |
| `/camera/cam_{front,left,right}/info|image_raw|qr` | 左/右来自仿真；front 走 ingress |
| `/camera/cam_front/heartbeat|compressed|status` | 工业契约 topic（本机无 Xavier 发布源） |
| `/face/*/detections` `/face/status` | stub 人脸 |

#### 3.3.3 Service（业务相关，运行时存在）

`/agv/navigate` `/agv/cancel` `/agv/lock`  
`/arm/move_joints` `/arm/move_pose` `/arm/execute_sequence`  
`/camera/capture` `/camera/detect_qr`  
`/face/detect_face` `/face/identify_face`

#### 3.3.4 Action

接口定义存在：

- `NavigateToStation.action`
- `ExecuteArmSequence.action`

运行时：`ros2 action list` **为空** → **接口预留**（无 ActionServer/Client 实现）。

### 3.4 ROS2 节点通信架构图（仅含审计时真实运行节点）

```mermaid
flowchart TB
  subgraph Web
    DASH[dashboard_node<br/>HTTP :19999/:1999]
  end

  subgraph SimMotion["Dev 运动链"]
    NAV[agv_gazebo_nav]
    PHYS[gz_physics_proxy]
  end

  subgraph SimArm["仿真臂"]
    ARM[arm_gazebo_driver]
  end

  subgraph SimCam["仿真相机 QR"]
    CQR[camera_gazebo_qr]
  end

  subgraph CamFront["前相机通路"]
    ING[camera_ingress_node]
  end

  subgraph Face["人脸"]
    FACE[face_bridge_node<br/>backend=stub]
  end

  DASH -->|client agv/navigate cancel| NAV
  DASH -->|client arm/execute_sequence| ARM
  DASH -->|client camera/detect_qr| CQR
  DASH -->|client face/*| FACE
  DASH -->|sub agv/status arm/*/status camera/*/qr face/*| DASH

  NAV -->|pub /agv/cmd_vel| PHYS
  PHYS -->|pub /agv/odom + TF odom→base_footprint| NAV
  NAV -->|pub agv/status agv/pose| DASH

  PHYS -->|pub /camera/cam_left|image_raw<br/>/camera/cam_right/image_raw| CQR
  CQR -->|pub camera/*/qr /camera/*/info| DASH

  ING -->|pub /camera/cam_front/image_raw info| DASH
  ING -.->|sub compressed/heartbeat/status<br/>当前无外部发布者| XAVIER[(Xavier/Basler<br/>审计时离线)]

  FACE -->|pub face/*/detections face/status| DASH
```

> 不上图的原因：`agv_bridge_node`、真车、Xavier、Jetson 算法、MoveIt、Nav2 **当前未运行或不存在**。

---

## 4. 硬件接口状态

### 4.1 激光雷达

| 检查项 | 结果 |
|--------|------|
| ROS2 LaserScan 驱动包 | **未实现**（仓库无 lidar driver / `sensor_msgs/LaserScan` 发布节点） |
| 数据来源（设计） | 仙工 Robokit API **1009**（TCP），由 `robokit_client` / Dashboard 轮询 |
| Dev 替代 | `dashboard_node` 的 `_laser_sim_stub()` / smap 点云近似 |
| 进入 Nav2 | **未实现**（无 Nav2） |
| frame_id / TF（雷达） | **未建立 ROS 雷达 TF 链** |
| 完成状态 | **部分实现（协议客户端）+ 真机链路当前验证失败** |

审计时：AGV `192.168.18.198` 路由不通，无法复验 1009。历史报告（2026-08-07）称只读 1009 曾 PASS；2026-08-08 快照记录大量 `laser_fail`。

### 4.2 工业相机

| 检查项 | 结果 |
|--------|------|
| SDK | 依赖外部 `app.capture.gige_capture`（Basler GigE）；**不在本 ROS 包内完整内嵌** |
| ROS2 driver | `cam_front_ros_node`（Xavier 骨架）、`camera_ingress_node`（NUC）、`camera_bridge_node`（**stub，服务返回 not implemented**） |
| image topic | 有：`/camera/*/image_raw`、compressed |
| camera_info | 使用自定义 `CameraInfoLite`，**不是**标准 `sensor_msgs/CameraInfo` 标定全量 |
| 标定文件 | **未发现完整 CameraInfo 标定管线/标定 yaml 作为运行必需资产** |
| 图像处理节点 | QR：仿真注入；实机 detect：**未接通** |
| 相机 → ROS2（真机） | **部分实现 / 验证失败**（契约有，G7 未过；当前 Xavier 离线） |

`camera_bridge_node.py` 明确日志：`real GigE capture not wired yet`。

### 4.3 xArm7 机械臂

| 检查项 | 结果 |
|--------|------|
| xArm SDK | 可选 `xarm-python-sdk`；缺失则 bridge offline |
| ROS2 package | `xarm_bridge` + 仿真 `arm_gazebo_driver` |
| 控制接口 | Service：`arm/move_joints|move_pose|execute_sequence` |
| MoveIt | **未实现**（仓库无 MoveIt 包/配置） |
| URDF | 仿真 URDF/xacro：`amb150_agv.urdf.xacro`；非完整双臂工业标定 URDF 体系 |
| ROS2 → xArm7 实控 | **部分实现（代码骨架）+ 缺少测试 + 审计时未验证真臂** |

配置 IP：`192.168.1.111` / `192.168.1.112`。

### 4.4 AGV 底盘

| 检查项 | 结果 |
|--------|------|
| 通信方式 | **TCP/IP Robokit（仙工）**，端口 19204–19207；**不是**本仓自研 CAN/`cmd_vel` 底盘驱动 |
| SDK/客户端 | `agv_bridge/robokit_client.py`（大端头 `HEADER_FMT=">BBHIH6s"` 已在树中） |
| `cmd_vel` | **仅 Dev/仿真**（`/agv/cmd_vel`）；文档明确勿对真车发 cmd_vel |
| `odom` / TF | 仿真有 `/agv/odom` + TF；真车路径发布 `agv/pose`/`agv/status`（map 语义），**不是 Nav2 标准 odom 栈** |
| driver | `agv_bridge_node` 存在，但 soft 默认不起；Demo 走 Dashboard 直连 |
| ROS2 能否控车移动 | **接口部分实现；当前网络验证失败；历史只读 PASS，导航闭环未验收** |

型号 `CSFHC5S2`：仓库全文 **未出现**；代码/配置按仙工 Robokit + AMB150 仿真命名组织。

### 4.5 超声波 ×8

仓库 ROS 包 / launch / topic：**未实现**。仅可能在 Roboshop 属性类外部文档中间接出现，**未接入本项目软件栈**。

---

## 5. 软件接口状态

| 接口 | 方向 | 当前状态 | 完成度 | 问题 |
|------|------|----------|--------|------|
| ROS2 msg/srv（AGV/Arm/Camera/Face） | 内部 | 已定义并在 sim 使用 | 70% | Action 未落地；缺包内单测 |
| ROS2 Action `NavigateToStation` / `ExecuteArmSequence` | 内部 | **接口预留** | 10% | 无 Server/Client |
| Dashboard HTTP API | Web→ROS/业务 | Dev 下有多端点实现；历史 ~22 端点冒烟曾 PASS | 55% | Demo 真车闭环未过门禁 |
| ROS2 ↔ AGV 域控（Robokit TCP） | NUC/VM→AGV | 客户端已实现；只读曾通；控制闭环未验收 | 40% | 现网不通；曾出现 `bad sync byte: 0x7b` |
| `/agv/cmd_vel` ↔ 真车 | ROS→底盘 | **未作为真车接口** | 0%（真车） | 真车禁用该路径 |
| ROS2 ↔ 工业相机 | Xavier→NUC | 契约+ingress+骨架节点 | 25% | G7 未过；当前无发布源 |
| ROS2 ↔ 人脸 | Jetson→NUC | stub 可跑；remote/sdk 预留 | 20% | 默认 stub；SDK not wired |
| ROS2 ↔ xArm7 | NUC→臂 | sim 可；实机依赖 SDK | 30% | 无 MoveIt；缺实机验证 |
| 业务订单系统 → 机器人任务 | 外部→机器人 | **未实现**独立订单/WMS 对接 | 5% | 仅有 Dashboard 手动导航/序列 |
| 任务执行反馈闭环 | 机器人→业务 | AgvStatus/HTTP state 部分有 | 25% | 无完整任务状态机/订单反馈 |

### 5.1 Robokit API（本项目代码实际使用）

| API | 端口 | 用途 | 状态 |
|-----|------|------|------|
| 1004 | 19204 | 位姿 | 历史只读 PASS；现网不通 |
| 1007 | 19204 | 电池 | 同上 |
| 1009 | 19204 | 激光 | 同上；Dev 用 stub |
| 1020 | 19204 | 任务状态 | 同上 |
| 2002–2004 等 | 19205 | 重定位 | Mock 有；真车未闭环 |
| 3051 / 3003 | 19206 | 导航/取消 | 真车闭环 **未验收** |
| 4005 / 4006 | 19207 | 锁/解锁 | 日志曾有抢锁；闭环未完成 |

---

## 6. 导航系统状态

| 能力 | 仓库现状 | 判定 |
|------|----------|------|
| slam_toolbox | 无 | **未实现** |
| cartographer | 无 | **未实现** |
| AMCL | 无（真车定位读 Robokit 1004） | **未实现（ROS）** |
| EKF / IMU 融合 | 无 | **未实现** |
| Nav2 | 无包无配置 | **未实现** |
| 地图创建 | 依赖仙工/Roboshop + 已下载 smap 资产 | **外部能力；非本仓 ROS SLAM** |
| 定位 | 真车：Robokit；Dev：仿真位姿 | **部分实现（厂商侧）** |
| 路径规划 | 真车：Robokit 3051；Dev：站点插值/`agv_gazebo_nav` | **部分实现** |
| 运动控制 | 真车：厂商；Dev：`cmd_vel`→physics proxy | **部分实现** |

### 导航链路完成度

```text
地图创建 ──(外部 Roboshop/smap)──▶ 定位 ──(Robokit 1004 / 仿真)──▶ 路径规划 ──(3051 / gazebo_nav)──▶ 运动控制
     本仓 ROS：未实现              本仓：读接口部分实现           真车闭环：未验收           真车：现网失败
                                                                         Dev：可运行
```

**结论**：本项目 Demo 导航策略是 **“用仙工车端导航，不在 ROS2 重建 Nav2”**。ROS2 侧没有完整 SLAM→AMCL→Nav2 链。同事 Nav2 材料在文档中被明确标为 **≠ Demo 契约**。

---

## 7. 团队模块边界

| 角色 | 模块边界（基于 docs/配置/代码注释） | 当前仓库落点 |
|------|--------------------------------------|--------------|
| 项目负责人 | ROS2 架构、系统集成、门禁推进 | `workspace_v02`、docs 26–28、bringup/web |
| Leo（门禁/人脸） | Jetson 人脸结果 → `/face/*`；不替代工业相机契约 | `face_bridge`（默认 stub） |
| Jason（工业相机/扫码） | Xavier+Basler → compressed/heartbeat/status | `camera_bridge` 契约/骨架；QR 仍偏仿真 |
| Zack（电气/运动控制） | 车端运动/电气；与 Robokit/Roboshop 协同 | 本仓无独立 Zack 驱动包；走厂商栈 |
| Kebo（电气/硬件支持） | 硬件支持 | 本仓无对应软件模块 |

控制权冻结（文档）：

- 同一时刻只允许 **Dashboard 或 `agv_bridge_node` 之一**控真车  
- Roboshop 仅配置/诊断，联调前释放锁  
- 工业相机权威 info 由 NUC ingress 看门狗产出，Xavier 不应抢权威 info

---

## 8. 当前完成度

### 8.1 整体完成度（相对 Phase 1 Demo 目标）

**整体：约 32%**

依据（审计可核对）：

| 加分项 | 证据 |
|--------|------|
| Dev 仿真全栈可运行 | 容器 Up；7 节点；topic/service 齐 |
| 接口契约较完整 | `delivery_interfaces` + docs/04/25 |
| Robokit 客户端存在且字节序已修 | `HEADER_FMT=">BBHIH6s"` |
| Web 控制台存在 | `:19999/:1999` |
| 门禁与风险已被文档化 | docs/27、reports 快照 |

| 减分项 | 证据 |
|--------|------|
| Demo Go/No-Go 未过 | docs/27；G3–G7 打开 |
| 真车/NUC/Jetson 现网不通 | 本次实测 |
| 无 Nav2/SLAM/MoveIt | 代码检索 0 |
| 相机/人脸真机未验收 | stub / missing_frames 历史 |
| 无订单级业务系统 | 仅 Dashboard 手动接口 |
| 包内几乎无自动化测试 | 无 `test/`；仅 smoke 脚本 |

> 若只评估 “Dev 演示界面能否转起来”，可达 **~55–60%**；但 Phase 1 目标是真机闭环 Demo，必须以门禁为准，故整体按 **~32%**。

### 8.2 分项评分

| 分项 | 完成度 | 依据 |
|------|--------|------|
| 机器人底盘 | **38%** | Robokit 客户端+Mock+历史只读 PASS；真车导航闭环未验收；现网不通 |
| ROS2 框架 | **58%** | 8 包、接口、Docker Humble、Dev bringup 可跑；Action/测试薄弱 |
| 导航 | **28%** | 无 ROS SLAM/Nav2；依赖厂商导航；真车闭环未过 |
| 视觉 | **22%** | 契约+骨架+仿真；实机 G7 未过；标定/处理未完成 |
| 机械臂 | **30%** | 仿真序列可用；实机 SDK 门控；无 MoveIt；缺实机验证 |
| 业务系统 | **18%** | Web 手动任务；无订单/调度业务闭环 |
| 系统集成 | **30%** | Dev 集成较强；Demo 跨设备集成未闭合；IP/拓扑不一致 |

---

## 9. 风险分析

### 9.1 技术风险

1. **Dev 证明力不能外推 Demo**（两套控制路径）— 最高技术风险  
2. 宿主 Ubuntu 26 + 容器 Humble 的运维割裂（host 无 ROS）  
3. 真机协议曾出现 `0x7b` 错流，说明字段/端口/并发客户端仍脆弱  
4. 相机链路依赖 Xavier 侧外部模块，本仓无法单独保证 “相机→ROS2”  
5. 无 MoveIt / 无真实操作规划，Phase 1 “取放/操作”缺少执行栈

### 9.2 接口风险

1. Jetson IP：口头 `192.168.0.207` vs 配置默认 `192.168.0.225`  
2. AGV / NUC 当前与 VM 不通，联调拓扑未恢复  
3. 双控风险：Dashboard 直连 vs `agv_bridge_node` vs Roboshop  
4. 标准 `CameraInfo`/TF/雷达话题缺失，后续若接 Nav2/融合成本高

### 9.3 人员协作风险

1. Leo 侧默认仍 stub，真实算法接入点 `colleague_sdk_not_wired`  
2. Jason 侧工业契约已写，但验收门禁 G7 仍开  
3. 电气/运动（Zack/Kebo）成果主要在车端厂商栈，ROS 仓内可见度低，集成责任边界容易虚化  
4. 文档索引滞后（`00_INDEX` 未完整收录 26–28），新人易读到过期表述

### 9.4 时间风险

1. 门禁 G3–G7 仍为打开/中断状态  
2. 真车健康状态在 08-08 快照已报故障，至今网络仍不通  
3. Phase 1 仍缺：真机导航闭环、真机视觉、真机双臂操作、任务编排

### 9.5 Phase 1 Demo 能否按计划完成？

**按当前真实状态：不能宣称可按计划完成正式 Demo。**

缺少的硬项：

1. 稳定同网段：NUC ↔ AGV `19204–19207`（现：无路由）  
2. Roboshop 基线：地图/定位/站点/释放控制权（G3）  
3. Dashboard 真车闭环：锁→导航→取消→解锁（G4）— **未验收**  
4. 安全与冷启动失败可见性（G5/G6）  
5. 若 Demo 含识别：Xavier+Basler ROS2 主链路（G7）  
6. 若 Demo 含操作：xArm 实机 SDK 连通 + 可靠序列（当前仅骨架/仿真）  
7. 端到端任务编排（订单/任务状态机）— **未实现**

仅可做：静态界面 / Dev 仿真演示 / Mock 联调，且必须声明非真车验收结果（与 docs/27 一致）。

---

## 10. 下一阶段建议

> 以下是审计建议，不是开发实施。

1. **先恢复物理连通与唯一控车方**  
   - 恢复 NUC/AGV 网络；统一 Jetson IP；Roboshop 释放锁  
   - 明确只保留 Dashboard 或 `agv_bridge_node` 一条真车控制链

2. **按 docs/27 顺序关门禁，禁止跳步**  
   G1 复验 → G2 端口 → G3 车端基线 → G4 低风险站点闭环 → G5/G6 →（可选）G7

3. **停止把 stub/sim 进度计为 Phase 1 完成**  
   - 人脸默认 stub、相机 bridge not implemented、Action 空置，均应保持 “未完成” 标签

4. **收敛配置真源**  
   - `devices.yaml` / `env.json` / docker env / 口头 IP 统一  
   - 文档索引补齐 26–28，避免过期 “联调就绪” 误读

5. **明确 Phase 1 Demo 范围降级策略**  
   - 若时间不够：书面降级为 AGV-only（无相机/无臂），并去掉界面上的虚假在线态

---

## 附录 A：审计现场摘要卡

### 1) 项目当前完成度

**约 32%（相对 Phase 1 真机 Demo）**；Dev 仿真可用性明显高于真机集成。

### 2) 最大三个问题

1. **真车/NUC/Jetson 现网不通，Demo 闭环无法进行**  
2. **Dev 与 Demo 双路径导致 “仿真通过” 不能证明真车能力**  
3. **感知与操作（相机/人脸/xArm/MoveIt）仍以 stub/骨架/仿真为主，未通过门禁验收**

### 3) 当前最优先三项工作

1. 恢复 AGV↔主控网络与 Roboshop 基线（地图/定位/解锁）  
2. 完成 G4：Dashboard 真车最小闭环（锁→低风险导航→取消→解锁）  
3. 统一设备 IP/模式真源，关闭界面上的虚假在线（相机/人脸 stub）

### 4) 需要负责人协调的事项

1. 现场网络与设备开机责任（AGV / NUC / Xavier / Jetson）  
2. 唯一控车方与 Roboshop 使用纪律  
3. Demo 范围是否降级（AGV-only vs 车+相机 vs 车+相机+臂）  
4. Leo/Jason 真机交付节奏与 G7/人脸非 stub 切换时间点  
5. 电气侧确认车型参数（CSFHC5S2）与仓库现状（Robokit/AMB150 仿真命名）对齐

---

## 附录 B：状态图例

| 标记 | 含义 |
|------|------|
| 未实现 | 仓库无对应代码/配置/运行实体 |
| 部分实现 | 有代码或仿真，但真机/闭环未完成 |
| 接口预留 | 仅有定义/骨架/未接线后端 |
| 验证失败 | 历史或本次实测未通过 |
| 缺少测试 | 无包内测试或无门禁级验收记录 |

---

*本报告结束。所有结论均可回溯至上述路径的源码、配置、容器运行态与 docs/reports。*
