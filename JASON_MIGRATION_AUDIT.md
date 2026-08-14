# Jason ROS2 项目迁移前审计报告

> **日期**：2026-08-13  
> **审计类型**：只读 — 源码 / 依赖 / 部署 / 运行态 / Docker 迁移分析  
> **审计机器**：`192.168.18.240`（hostname: **ALPHA**）  
> **Jason 工程路径**：`/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/Jason.Chen/ros2_ws`  
> **禁止项遵守**：未修改 Jason 任何文件；未 apt/pip/rosdep；未 build/install；未改网络/ROS 配置

---

## 1. Audit Scope

| 范围 | 状态 |
|------|------|
| Jason 完整 `ros2_ws` 源码/配置/脚本 | **CONFIRMED** — 95 个 src 文件；5 ROS packages |
| Jason `build/` / `install/` 可迁移性 | **CONFIRMED** — 已分析 |
| VM 240 网络 / Pylon / Docker | **CONFIRMED** — 只读命令 |
| VM 249 运行态 `ros2 topic echo/hz` | **BLOCKED** — 240→249 SSH 无凭据 |
| Jason 相机当前是否在 240 运行 | **CONFIRMED** — **未运行** |
| AGV Docker 现状 | **CONFIRMED** — `delivery_gazebo_soft` Up，`network_mode: host` |

---

## 2. Machine Information

### 2.1 Cursor 审计连接确认

| 项 | 值 |
|----|-----|
| 审计 SSH 目标 | `ubuntu@192.168.18.240` |
| hostname | **ALPHA** |
| IP | `192.168.18.240`（ens37）、`192.168.161.128`（ens38） |
| OS | **Ubuntu 26.04 LTS**（非 Jason 要求的 22.04） |
| Python（宿主） | 3.14.4 |
| `/opt/ros`（宿主） | **不存在** |
| Pylon SDK（宿主） | **未安装**（`dpkg` 无 pylon；无 `/opt/pylon`） |

### 2.2 网络（只读）

| 接口 | 状态 | 地址 | 用途推断 |
|------|------|------|----------|
| ens37 | UP, 1000Mb/s, MTU 1500 | 192.168.18.240/24 | **工业网段**（相机/ Jason VM） |
| ens38 | UP | 192.168.161.128/24 | 另一 DHCP 网段（默认路由 metric 101） |
| docker0 | DOWN | 172.17.0.1/16 | Docker bridge（当前 AGV 用 host 网络） |

| 目标 | ping（从 240） |
|------|----------------|
| 192.168.18.251 | **OK**（0% loss） |
| 192.168.18.249 | **OK**（0% loss） |

**注意**：251 ping 通 **≠** 已确认其为 Basler Pylon 相机 IP（见 §12）。

### 2.3 Shell 环境（240 宿主，未 export）

```
ROS_DISTRO=          (empty)
ROS_DOMAIN_ID=       (empty)
RMW_IMPLEMENTATION=  (empty)
```

### 2.4 AGV Docker（运行中）

| 项 | 值 |
|----|-----|
| 容器 | `delivery_gazebo_soft` |
| Base | `delivery-ros2:humble-jammy`（Ubuntu **22.04** + Humble） |
| `network_mode` | **host** |
| `ROS_DOMAIN_ID` | **30** |
| Pylon in container | **NO** |
| 当前 ROS nodes | `/face_executor_node`, `/gz_physics_proxy`（**无 Jason 相机**） |

---

## 3. Jason Workspace Structure

```
Jason.Chen/ros2_ws/
├── README.md
├── BASLER_INSTALL_GUIDE.md
├── install_dependencies.sh      # apt 安装脚本 — 要求 Ubuntu 22.04
├── install_basler_driver.sh       # Pylon 8.0.0 + 克隆 pylon-ros-camera
├── handover_ros2_integration_2026-08-07/   # 中文交接 SOP
├── scripts/
│   ├── deploy_and_run_camera_qr.sh
│   ├── deploy_and_run_camera_apriltag.sh
│   ├── calibrate_basler_camera_and_apply.sh
│   └── open_camera_rviz.sh
├── src/
│   ├── pylon_ros2_camera_component/   # C++ 核心
│   ├── pylon_ros2_camera_wrapper/     # launch + yaml
│   ├── pylon_ros2_camera_interfaces/  # msg/srv/action
│   ├── qrcode_detector/               # Python QR
│   └── apriltag_pose_reader/          # AprilTag（Phase 4 不接入 AGV）
├── build/    # colcon 产物 — 存在
├── install/  # colcon 安装 — 存在
└── log/acceptance/  # 2026-08-12 验收 FAIL 记录
```

**工程完整性**：**CONFIRMED 完整交付** — 源码 + 配置 + 脚本 + 交接文档 + build/install + git（`bcde7d8`）。

**路径不一致（CONFLICT）**：

| 引用位置 | 路径 |
|----------|------|
| README / SOP / deploy 脚本 | `/home/ubuntu/ros2_ws` |
| 实际备份位置 | `.../Jason.Chen/ros2_ws` |
| `install/setup.sh` 链 | 仍指向 `/home/ubuntu/ros2_ws/install` |

---

## 4. Software Dependencies

| 依赖 | Jason 要求 | VM 240 宿主 | AGV Docker |
|------|-----------|-------------|------------|
| Ubuntu | **22.04** | **26.04** ❌ | **22.04** ✅ |
| ROS 2 | **Humble** | 无 ❌ | Humble ✅ |
| Python | 3.10（Jammy） | 3.14 ❌ | 3.10 ✅ |
| Pylon SDK | **≥ 8.0.0** → `/opt/pylon` | 无 ❌ | 无 ❌ |
| OpenCV + cv_bridge | 是 | 未在宿主验证 | 部分有 |
| C++ / colcon | 是 | 无 ROS 工具链 | 有 |

`install_dependencies.sh` / `install_basler_driver.sh` **均会 apt/dpkg/wget** — 本阶段 **未执行**。

---

## 5. Basler / Pylon Dependency

### 5.1 版本与安装方式（源码）

| 项 | 值 | 证据 |
|----|-----|------|
| Pylon 版本 | **8.0.0** | `install_basler_driver.sh` `PYLON_VERSION="8.0.0"` |
| 安装路径 | `/opt/pylon` | BASLER_INSTALL_GUIDE、`pylon_ros2_camera.launch.py` |
| GigE 工具 | `pylonGigEConfigurator` | BASLER_INSTALL_GUIDE、acceptance FAIL 建议 |
| USB 相机 | `setup-usb.sh` | install 脚本（本相机为 **GigE**） |
| 相机选型 | `device_user_id`（非 IP） | yaml `106611-18` |

### 5.2 Docker 相关问题（分析，非猜测）

| 问题 | 结论 |
|------|------|
| Pylon SDK 是否必须进 Docker？ | **是**（若 Camera Node 在容器内运行）— wrapper 链接 `libpylon*` |
| Wrapper 是否必须进 Docker？ | **是** — 与 SDK 同环境 |
| 相机访问方式 | **GigE 以太网**（yaml mtu/inter_pkg_delay；acceptance GigE 错误） |
| 是否需要 host network？ | **强烈建议** — GigE + DDS discovery；AGV 已用 `network_mode: host` |
| 是否需要 USB？ | **否**（本型号 acA2500-14GC GigE） |
| 额外 Linux capability？ | **可能** — `CAP_NET_RAW` 有时用于 GigE；**PENDING 硬件测试** |
| 宿主机网卡访问 | host 模式下容器共享 ens37，**可访问 192.168.18.0/24** |
| GigE Docker 要求 | 大 MTU/jumbo、packet size、inter-packet delay、足够 grab buffer；见 tuned_v3 |

**240 宿主当前状态**：**无法独立运行 Jason 相机栈**（无 ROS、无 Pylon）。

---

## 6. ROS2 Packages

| Package | 类型 | 作用 | 主要依赖 | 是否必须进 Docker |
|---------|------|------|----------|-------------------|
| `pylon_ros2_camera_interfaces` | ament_cmake | msg/srv/action | rosidl | **是** |
| `pylon_ros2_camera_component` | C++ component | Pylon 驱动核心 | rclcpp, cv_bridge, pylon SDK, image_transport | **是** |
| `pylon_ros2_camera_wrapper` | C++ wrapper + launch | 启动相机 | component | **是** |
| `qrcode_detector` | Python | QR 识别 | rclpy, cv_bridge, OpenCV | **是**（QR 链路） |
| `apriltag_pose_reader` | Python | AprilTag 姿态 | apriltag_ros, tf2 | **否**（AGV Phase 4 冻结） |

---

## 7. ROS2 Nodes

| Node 名 | Package | Executable | 源文件 | Launch |
|---------|---------|------------|--------|--------|
| `{camera_id}/pylon_ros2_camera_node` | wrapper | `pylon_ros2_camera_wrapper` | component | `pylon_ros2_camera.launch.py` |
| `wechat_qr_node` | qrcode_detector | `qrcode_node` | `qrcode_node.py` | `qrcode_detector.launch.py` |
| `ip_auto_config` | component | `ip_auto_config` | component | `ip_configuration.launch.py` |
| `apriltag_pose_reader` | apriltag_pose_reader | — | — | 独立 launch |

**Namespace（CONFLICT — 见 §11）**：

| 启动方式 | `camera_id` / namespace |
|----------|-------------------------|
| `pylon_ros2_camera.launch.py` **默认** | **`my_camera`** |
| `deploy_and_run_camera_qr.sh` **默认** | **`basler_106611_18`** |
| SOP / README 启动命令 | 只指定 `config_file`，**未覆盖 camera_id** → 实际为 **`my_camera`** |

→ 用户报告的 `/my_camera/pylon_ros2_camera_node` 与 **SOP 启动方式一致**，与 **deploy 脚本默认不一致**。

---

## 8. ROS2 Topics

### 8.1 Camera（源码构造）

| Topic | 类型 | Publisher |
|-------|------|-----------|
| `/{camera_id}/pylon_ros2_camera_node/image_raw` | `sensor_msgs/Image` | Pylon node |
| `/{camera_id}/pylon_ros2_camera_node/camera_info` | `sensor_msgs/CameraInfo` | Pylon node |
| `/{camera_id}/pylon_ros2_camera_node/status` | Pylon 自定义 status | 可选 |

**SOP 默认** → `/my_camera/pylon_ros2_camera_node/image_raw`  
**Deploy 默认** → `/basler_106611_18/pylon_ros2_camera_node/image_raw`

### 8.2 QR

| Topic | 类型 | Publisher | 订阅 |
|-------|------|-----------|------|
| `/wechat_qr_node/decoded_info` | `std_msgs/String` | `wechat_qr_node` | — |
| （参数）`image_topic` | `sensor_msgs/Image` | Pylon | `wechat_qr_node` |

Deploy 将 QR 输入设为 `/$CAMERA_ID/pylon_ros2_camera_node/image_raw`。  
SOP 单独启 QR launch 时默认仍为 `/my_camera/.../image_raw`。

### 8.3 240 运行态实测

| 项 | 结果 |
|----|------|
| Jason 相机进程 | **NONE**（`ps` 无 pylon/wechat_qr） |
| `ros2 topic hz/echo` | **未执行** — 无运行栈 |
| 249 运行态 | **BLOCKED** — 无法 SSH 249 验证 |

### 8.4 用户报告（249 运行态 — OBSERVED，非本轮实测）

- `/my_camera/pylon_ros2_camera_node/*` 存在  
- `/wechat_qr_node/decoded_info` Publisher count = **2**  
- `ros2 node list` 出现 **两个** `/wechat_qr_node`  

**只读分析（未修复）**：

| 可能原因 | 说明 |
|----------|------|
| 重复 launch | 两次 `qrcode_detector.launch.py` 或 deploy + 手动各启一次 |
| deploy + SOP 各启 QR | 同一 node 名 `wechat_qr_node`，两进程 |
| 不同 terminal 重复运行 | 常见运维问题 |

源码 **不会** 单进程创建两个 publisher；**Publisher count=2** 强烈暗示 **两个 QR 节点进程**。

---

## 9. ROS2 Services

Pylon component 提供大量 `set_*` / `get_*` service（曝光、增益、binning 等）— 前缀 `{namespace}/pylon_ros2_camera_node/...`。

**AGV Phase 4 设计**：Adapter **不封装** Pylon services；保留 Jason 原生。

QR 节点：**无 service**。

---

## 10. Launch Files

| Launch | 用途 | 迁移最少需要 |
|--------|------|--------------|
| `pylon_ros2_camera.launch.py` | 主相机 | **必须** |
| `qrcode_detector.launch.py` | QR | **必须**（QR 链路） |
| `ip_configuration.launch.py` | GigE IP 配置 | **运维/首次**（非日常） |
| `apriltag_pose_reader.launch.py` | AprilTag | **否** |

**最少启动组合（无统一 launch）**：

```text
1) ros2 launch pylon_ros2_camera_wrapper pylon_ros2_camera.launch.py \
     config_file:=<yaml> [camera_id:=<ns>]
2) ros2 launch qrcode_detector qrcode_detector.launch.py \
     image_topic:=/<ns>/pylon_ros2_camera_node/image_raw
```

或使用 `scripts/deploy_and_run_camera_qr.sh`（一体化，但硬编码 `/home/ubuntu/ros2_ws`）。

---

## 11. YAML Configuration

| 文件 | 作用 | Launch 引用 | 关键参数 | 生产？ |
|------|------|-------------|----------|--------|
| `aca2500_106611_18.tuned_v3.yaml` | 稳定/降带宽 v3 | **SOP/README** | binning 2×2, fps 8, mtu 1500, inter_pkg_delay 1000 | **SOP 生产推荐** |
| `aca2500_106611_18.yaml` | 基线 | **deploy 脚本默认** | fps 14, 无 binning | deploy 默认 |
| `aca2500_106611_18.calib.yaml` | 标定 | camera_info_url | 内参 | 必须 |
| `default.yaml` | 模板 | launch 默认 | — | 否 |
| `qrcode_detector/config/params.yaml` | QR 参数 | 可选 | image_topic 默认 `/camera/image_raw` | 易与相机不一致 |

**CONFLICT 汇总**：

| 冲突 | A | B |
|------|---|---|
| Config | tuned_v3（SOP） | aca2500 base（deploy） |
| Namespace | my_camera（launch 默认） | basler_106611_18（deploy） |
| Workspace 路径 | `/home/ubuntu/ros2_ws` | 实际备份路径 |
| QR image_topic | launch 默认 my_camera | params.yaml 默认 `/camera/image_raw` |

**yaml 中无 camera_ip 字段** — IP 通过 GigE / `ip_configuration.launch.py` / Pylon 工具配置。

---

## 12. Camera Hardware Information

| 项 | 状态 | 证据 |
|----|------|------|
| Model | **CONFIRMED** acA2500-14GC | yaml 注释；用户 Pylon 日志 |
| device_user_id | **CONFIRMED** `106611-18` | yaml；Pylon 日志 |
| Serial | yaml 注释 22297681 | 源码 |
| 连接 | **GigE** | yaml mtu/inter_pkg_delay；GigE 错误码 |
| Camera IP | **PENDING** | 251 ping OK；**未用 Pylon 工具确认绑定** |
| 251 = Basler? | **PENDING** | 不能只凭 ping |

**网络错误性质（OBSERVED — acceptance log）**：

- `3774873620` buffer incompletely grabbed  
- Grab was not successful  
- 建议：网卡/交换机/线缆/MTU/`pylonGigEConfigurator`/grab buffer  

→ **GigE 性能/网络类问题**，非 ROS topic 命名问题；**未在本轮修复**。

---

## 13. Current Runtime Observation

### VM 240（本轮实测）

| 项 | 结果 |
|----|------|
| Jason 相机栈 | **未运行** |
| AGV Docker | 运行中（仿真 + face） |
| 宿主 ROS | 无 |

### VM 249（用户报告 + 历史 acceptance）

| 项 | 结果 |
|----|------|
| namespace `/my_camera` | **OBSERVED**（与 SOP 一致） |
| image 不稳定 | **OBSERVED**（buffer underrun） |
| duplicate wechat_qr_node | **OBSERVED** |
| 2026-08-12 acceptance | **FAIL**（basler_106611_18 路径也无 stream） |

---

## 14. QR Pipeline

```text
Basler GigE
    ↓ Pylon SDK
pylon_ros2_camera_node
    ↓ sensor_msgs/Image  (/{ns}/.../image_raw)
wechat_qr_node (OpenCV QRCodeDetector 默认; WeChatQR 可选)
    ↓ std_msgs/String  (/wechat_qr_node/decoded_info, 有码才发)
[未来] AGV camera_adapter_node
    ↓ QrDetectionArray / DetectQr
AGV Dashboard / 业务
```

**Payload**：`String.data` = 解码后的 **纯文本**（无 JSON 包装）— **CONFIRMED** 源码。

---

## 15. Current Errors

| 错误 | 性质 | 处理 |
|------|------|------|
| `3774873620` buffer incompletely grabbed | GigE 网络/性能 | 只记录；tuned_v3 已尝试降负载 |
| Grab was not successful | 同上 | 只记录 |
| duplicate wechat_qr_node | 运维/重复 launch | 只记录 |
| Publisher count=2 on decoded_info | 两 QR 进程 | 只记录 |
| install/setup 路径 `/home/ubuntu/ros2_ws` | 迁移路径不一致 | 迁移时需 symlink 或 rebuild |
| 240 无 ROS/Pylon | 环境未就绪 | 阻塞独立运行 |

---

## 16. DDS / Network Analysis

| 项 | Jason（249 用户报告 shell） | AGV Docker |
|----|----------------------------|------------|
| ROS_DOMAIN_ID | 空（默认 0？） | **30** |
| RMW | 空 | 空（Humble 默认 **rmw_fastrtps_cpp**） |
| network_mode | 物理 VM | **host** |

**跨 VM/容器发现 topic 需**：

1. 相同 `ROS_DOMAIN_ID`（建议统一 **30** 与 AGV）  
2. `ROS_LOCALHOST_ONLY=0`  
3. 多播可达（同 L2 或正确防火墙）  
4. 相同 RMW（建议显式 `rmw_fastrtps_cpp`）

**249↔240 DDS**：**BLOCKED** — 本轮未在两侧同时跑 Jason + echo。

---

## 17. Docker Migration Requirements

| 需求 | 说明 |
|------|------|
| Base OS | **Ubuntu 22.04**（与 AGV `humble-jammy` 一致） |
| ROS 2 Humble | 已有 |
| Pylon **8.0.0+** | **必须新增**到目标镜像 |
| colcon build Jason packages | **必须**（不建议裸复制 install） |
| `network_mode: host` | **必须**（GigE + 现有 AGV 模式） |
| `ROS_DOMAIN_ID=30` | 与 AGV 对齐 |
| GigE 调优 | MTU、inter-packet delay、Jumbo（按 Basler 文档） |
| 不修改 Jason yaml | 迁移阶段通过 **launch 参数** 注入 namespace/topic |
| camera_adapter | AGV 侧边界层（Phase 4 Plan，**本阶段不实现**） |

---

## 18. Migration Options A/B/C/D

| 维度 | A 整 ws 复制 | B 只复制 src + rebuild | C 独立 Jason 容器 | D 同容器 |
|------|-------------|------------------------|------------------|----------|
| 稳定性 | 低（路径/OS 绑定） | **高** | 高 | 中 |
| 开发复杂度 | 低 | 中 | 中 | **低** |
| Docker 网络 | host | host | host + DDS | host |
| Pylon/GigE | 需装 SDK | 需装 SDK | 需装 SDK | 需装 SDK |
| 后期维护 | 差 | **好** | 好 | 中 |
| 与 AGV 集成 | 需 adapter | 需 adapter | DDS + adapter | 同 graph + adapter |

---

## 19. Recommended Architecture

**推荐：方案 D 的变体 — 单 AGV 容器 + host network + 源码迁入 rebuild**

```text
[物理] Basler GigE ──ens37──► AGV Docker (host net, Domain 30)
                                  ├── pylon_ros2_camera_wrapper
                                  ├── wechat_qr_node
                                  ├── camera_adapter_node (AGV Phase 4)
                                  ├── delivery_web / gazebo / ...
                                  └── Pylon SDK in /opt/pylon
```

**理由**：

1. AGV 已 `network_mode: host` + Humble Jammy — 与 Jason 要求一致  
2. 240 宿主是 Ubuntu **26.04** — **不适合** 直接跑 Jason；应进 Docker  
3. `build/install` 绑定 `/home/ubuntu/ros2_ws` — **应 src 迁入 AGV ws 后 colcon rebuild**  
4. 单容器 DDS 最简单；adapter 与 Dashboard 同 graph  
5. 独立 Jason 容器（C）可作为 **联调隔离** 备选，非首选  

**Phase 1 运行（迁移前验证）**：在 Docker 内仅启 Camera + QR launch，**不** 融合 AGV 业务；确认 GigE 稳定后再启 adapter。

---

## 20. Risks

| 风险 | 级别 |
|------|------|
| GigE buffer underrun 未解决 | **高** |
| namespace/config 三套约定并存 | **高** |
| 240 宿主无 ROS/Pylon | **高**（已规避：用 Docker） |
| duplicate QR 节点 | **中** |
| install 路径硬编码 | **中** |
| 251 IP 未 Pylon 确认 | **中** |
| Domain 不一致（Jason 空 vs AGV 30） | **中** |
| Pylon SDK 许可证/离线 deb 获取 | **中** |
| Ubuntu 26.04 宿主误跑 install 脚本 | **高**（禁止在宿主执行） |

---

## 21. PENDING Items

- [ ] Pylon 只读确认 251 = acA2500-14GC / 106611-18  
- [ ] 249 上 `ros2 topic echo` metadata（encoding/width/height）  
- [ ] 249 上 duplicate wechat_qr 根因（进程列表 `ps`）  
- [ ] 249↔240 同 Domain DDS echo  
- [ ] GigE 调优后 `ros2 topic hz` 稳定 ≥ 30s  
- [ ] Pylon 8.0.0 deb 离线包进入 AGV 镜像构建  
- [ ] 统一生产 namespace（my_camera vs basler_106611_18）  
- [ ] AGV `camera_adapter_node` 实现（Phase 4，非本阶段）

---

## 22. DO NOT TOUCH List

- `Jason.Chen/ros2_ws/**` 全部内容（含 build/install）  
- 249/251 相机 Pylon 参数、IP、MTU  
- `ROS_DOMAIN_ID` / `RMW` 环境（审计阶段不 export）  
- duplicate wechat_qr 进程（不 kill）  
- AGV 控制器 IP / 底层网络  
- 本阶段不 apt / pip / rosdep / colcon build  

---

## 23. Recommended Next Steps

1. **Jason 在岗**：在 249 执行 J1–J12 + `ps aux | grep qrcode` 查 duplicate QR  
2. **GigE 稳定性**：按 BASLER_INSTALL_GUIDE 运行 `pylonGigEConfigurator`（**人工**，非 AI）  
3. **统一约定**：选定生产 `camera_id` + config yaml（SOP vs deploy）  
4. **Docker 镜像**：在 `Dockerfile.lite` **新 stage 规划** 安装 Pylon 8.0.0 + Jason src colcon build（**下一阶段**，非现在）  
5. **隔离验证**：Docker 内仅 Camera+QR，确认 hz 稳定  
6. **Domain 对齐**：Jason 侧 `ROS_DOMAIN_ID=30`  
7. **再启 Phase 4**：`camera_adapter_node` + 独立 launch  
8. **最后融合**：与 AGV lite boot 协调（避免 camera_gazebo_qr 污染 REAL）

---

## 24. 迁移清单

| Jason 内容 | 进 Docker？ | 原因 | 迁移方式 | 当前状态 |
|------------|------------|------|----------|----------|
| Pylon SDK | **是** | wrapper 硬依赖 `/opt/pylon` | Dockerfile 安装 deb 8.0.0 | 240/容器 **均未安装** |
| pylon ROS2 component/wrapper/interfaces | **是** | 相机驱动 | **src 迁入 AGV ws + colcon build** | install 存在但路径绑定 |
| qrcode_detector | **是** | QR 链路 | src + build | install 存在 |
| calibration yaml | **是** | camera_info | COPY config | 在 src 中 |
| camera yaml | **是** | 运行参数 | COPY + launch 参数 | **CONFLICT** 多版本 |
| launch | **是** | 启动 | COPY share | 完整 |
| src | **是** | 真源 | 迁入 `delivery_ws/src` 或并列 ws | 完整 |
| build | **否** | 路径/OS 绑定 | 丢弃，重建 | 存在但不推荐复制 |
| install | **否** | 绑定 `/home/ubuntu/ros2_ws` | 丢弃，重建 | **CONFLICT** 路径 |
| scripts | **参考** | 运维 | 改路径后可选 COPY | 硬编码 ros2_ws |
| handover 文档 | **否** | 文档 | 保留在 AGV 文档目录 | 完整 |
| apriltag_pose_reader | **否** | Phase 4 冻结 | 不迁入 | 存在 |

---

## 25. 十问结论

| # | 问题 | 结论 |
|---|------|------|
| 1 | Jason 工程是否完整？ | **是** — src/build/install/文档/脚本齐全 |
| 2 | 能否在 240 **宿主**独立运行？ | **否** — Ubuntu 26.04、无 ROS、无 Pylon |
| 3 | 运行需要哪些系统依赖？ | Ubuntu 22.04 + Humble + Pylon 8.0.0 + OpenCV + colcon + cv_bridge 等 |
| 4 | Pylon 是否必须进 Docker？ | **是**（若相机在容器内跑） |
| 5 | Camera Node 发布什么 topic？ | `/{camera_id}/pylon_ros2_camera_node/image_raw` 等；**camera_id 未统一** |
| 6 | QR 订阅/发布？ | Sub: 参数 `image_topic`；Pub: `/wechat_qr_node/decoded_info` String |
| 7 | image_raw 是否稳定？ | **否** — acceptance FAIL + buffer underrun；249 用户报告仍有问题 |
| 8 | buffer underrun 性质？ | **GigE 网络/性能类** — 网卡/交换机/MTU/缓冲/grab 配置 |
| 9 | 复制 vs rebuild vs 拆包？ | **推荐 src 迁入 AGV Docker + colcon rebuild**；**不要**复制 install |
| 10 | Docker 架构？ | **单 AGV 容器 + host network + Pylon in image + adapter 边界** |

---

## 26. 是否具备开始 Docker 融合条件？

### **否 — 尚不具备开始 Docker 融合**

**阻塞项**：

1. **Pylon SDK 未安装**到目标 Docker 镜像  
2. **GigE 取流未稳定**（3774873620 / Grab failed）  
3. **namespace/config 未统一**（my_camera vs basler_106611_18 vs tuned vs base）  
4. **249 运行态未在本轮闭合验证**（duplicate QR、encoding、hz）  
5. **249↔240 DDS 未验证**  
6. **camera_adapter_node 未实现**（AGV 边界层）  
7. **240 宿主不可作为 Jason 运行环境**（必须 Docker 内完成）

**下一阶段实施步骤（批准后开始，非现在）**：

1. 扩展 AGV Dockerfile：离线安装 Pylon 8.0.0 + GigE 依赖  
2. 将 Jason `src`（4 包，不含 apriltag）复制到 AGV `ros2_ws/src`  
3. 容器内 `colcon build`；**不**复制 Jason install  
4. 统一 launch 参数：`camera_id` + `tuned_v3.yaml` + QR `image_topic`  
5. host 网络 + `ROS_DOMAIN_ID=30` 下仅启 Camera+QR，跑 30s hz 验收  
6. GigE 调优至稳定  
7. 实现 `camera_adapter_node`（Phase 4）  
8. 与 AGV boot 策略协调 REAL/sim 隔离  
9. 端到端 Web/DetectQr 验收  

---

*报告版本：JASON-MIGRATION-AUDIT-v1 · 2026-08-13 · Read-only*
