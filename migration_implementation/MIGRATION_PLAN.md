# Jason ROS2 Camera + QR → AGV Docker 迁移实施计划

> **日期**：2026-08-13  
> **阶段**：实施（非审计）  
> **原则**：Jason 原工程只读；只复制 `src`；在 AGV Docker 内 `colcon build`；不复制 Jason `build/install`

---

## 1. 当前 AGV 环境

| 项 | 值 |
|----|-----|
| VM | `192.168.18.240`（ALPHA） |
| AGV 项目根 | `/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/AGV_Delivery_v0.2.0_20260807_0921` |
| 运行容器 | `delivery_gazebo_soft` |
| 镜像 | `delivery-ros2:humble-gazebo-v02`（FROM `delivery-ros2:humble-jammy`） |
| `network_mode` | **host** |
| `ROS_DOMAIN_ID` | **30** |
| Workspace（镜像内） | `/opt/delivery_ws`（`install` 在镜像；`src` bind-mount） |
| 运行时 `src` 挂载 | `.run/workspace_v02/ros2_ws/src` → `/opt/delivery_ws/src` |
| 规范 `src` 树 | `workspace_v02/ros2_ws/src`（Dockerfile COPY 源） |
| 现有 packages（8） | `agv_bridge`, `camera_bridge`, `delivery_bringup`, `delivery_gazebo`, `delivery_interfaces`, `delivery_web`, `face_bridge`, `xarm_bridge` |
| Pylon（容器内） | **未安装** |

**重要**：`deploy_up.sh` 会将 `workspace_v02` 整树复制到 `.run/workspace_v02` 后再 compose。迁移后需同步两棵树，或重新 deploy。

---

## 2. Jason 工程（只读源）

| 项 | 值 |
|----|-----|
| 路径 | `.../Jason.Chen/ros2_ws` |
| 相机 | Basler acA2500-14gc，Device User Id `106611-18`，GigE |
| Pylon | 8.0.0 → `/opt/pylon` |
| 核心链 | Pylon → `pylon_ros2_camera_*` → `image_raw` → `qrcode_detector` → `/wechat_qr_node/decoded_info` |

---

## 3. 迁移 packages（4）

| Package | 说明 |
|---------|------|
| `pylon_ros2_camera_interfaces` | msg/srv/action |
| `pylon_ros2_camera_component` | C++ 组件（**构建依赖 Pylon SDK**） |
| `pylon_ros2_camera_wrapper` | launch + yaml |
| `qrcode_detector` | Python QR（OpenCV fallback 默认） |

目标目录：`<AGV>/workspace_v02/ros2_ws/src/`（并同步到 `.run/.../src`）

---

## 4. 不迁移 packages

| Package | 原因 |
|---------|------|
| `apriltag_pose_reader` | Phase 1 冻结，用户明确要求不迁移 |
| Jason `build/` / `install/` / `log/` | 旧路径绑定 `/home/ubuntu/ros2_ws`，不可直接使用 |

---

## 5. Pylon 安装方式

1. **离线 deb 包**：`pylon-8.0.0-linux-x86_64_debs.tar.gz`
2. **放置路径**：`workspace_v02/docker/vendor/pylon/pylon-8.0.0-linux-x86_64_debs.tar.gz`
3. **Dockerfile.lite**：构建时解压并 `dpkg -i pylon_*.deb`，安装到 `/opt/pylon`
4. **环境变量**：`PYLON_ROOT=/opt/pylon`，`GENICAM_GENTL64_PATH=/opt/pylon/lib/gentlproducer/gtl`

**当前阻塞（2026-08-13）**：VM `192.168.18.240` 上 **未找到** `pylon-8.0.0-linux-x86_64_debs.tar.gz`。  
按用户要求：**不自行下载**；请将 deb 包放入 vendor 目录后再 `docker compose build`。

---

## 6. Docker 修改位置

| 文件 | 修改 |
|------|------|
| `workspace_v02/docker/Dockerfile.lite` | 增加 ROS 依赖（cv_bridge, pcl_ros, image_transport 等）；Pylon deb 安装；COPY `boot_jason_camera.sh` |
| `workspace_v02/docker/boot_jason_camera.sh` | **新增** — 独立启动 Jason 相机/QR（不接入 `boot_gazebo_lite.sh`，避免与 `camera_gazebo_qr` 冲突） |
| `workspace_v02/docker/vendor/pylon/README.md` | **新增** — 说明 deb 放置要求 |
| `workspace_v02/docker/docker-compose.yml` | **暂不修改**（保持现有 AGV 仿真栈） |

---

## 7. Workspace 修改位置

| 文件 | 修改 |
|------|------|
| `ros2_ws/src/pylon_ros2_camera_*` | 从 Jason **复制** |
| `ros2_ws/src/qrcode_detector` | 从 Jason **复制** |
| `ros2_ws/src/delivery_bringup/launch/jason_camera.launch.py` | **新增** — 相机（tuned_v3 + my_camera） |
| `ros2_ws/src/delivery_bringup/launch/jason_camera_qr.launch.py` | **新增** — 相机 + QR（验收用，注意单实例） |

---

## 8. Namespace 统一方案

| 来源 | `camera_id` / namespace |
|------|-------------------------|
| `pylon_ros2_camera.launch.py` 默认 | **`my_camera`** |
| SOP/README（只指定 config，不覆盖 camera_id） | **`my_camera`** |
| 用户已验证运行 | `/my_camera/pylon_ros2_camera_node` |
| `deploy_and_run_camera_qr.sh` 默认 | `basler_106611_18`（**不采用**） |

**AGV 生产约定**：

- `camera_id:=my_camera`
- `config_file:=.../aca2500_106611_18.tuned_v3.yaml`
- 节点：`/my_camera/pylon_ros2_camera_node`
- 图像：`/my_camera/pylon_ros2_camera_node/image_raw`

---

## 9. ROS_DOMAIN_ID

- 容器内必须为 **30**（与现有 AGV 一致）
- Jason 相机/QR 手动启动时：`export ROS_DOMAIN_ID=30`

---

## 10. 网络要求

- Docker **`network_mode: host`** 必须保持（GigE + DDS）
- 工业网段：`192.168.18.0/24`（宿主 ens37，MTU 1500）
- 相机 IP **须用 Pylon 工具 + Device User Id `106611-18` 确认**，不能仅凭 ping `192.168.18.251`
- GigE buffer underrun（`3774873620`）属 **网络/硬件性能问题**，不得用改 topic 掩盖

---

## 11. 构建步骤

```bash
# 1. 放置 Pylon deb（阻塞项）
cp pylon-8.0.0-linux-x86_64_debs.tar.gz \
  workspace_v02/docker/vendor/pylon/

# 2. 同步 .run（若未跑 deploy_up）
cp -a workspace_v02/ros2_ws/src/pylon_ros2_camera_* workspace_v02/ros2_ws/src/qrcode_detector \
  .run/workspace_v02/ros2_ws/src/

# 3. 重建镜像（在 .run/workspace_v02 或 deploy_up）
cd .run/workspace_v02
docker compose -f docker/docker-compose.yml --profile sim-soft build

# 4. 重启容器（会短暂中断仿真；可择时执行）
docker compose -f docker/docker-compose.yml --profile sim-soft up -d
```

---

## 12. 验收步骤（严格顺序）

| Stage | 检查 |
|-------|------|
| 1 | 容器内 Ubuntu 22.04、Humble、Pylon 8.0.0、OpenCV、cv_bridge、colcon |
| 2 | 4 个 package 已在 `src/` |
| 3 | 镜像 rebuild 成功 |
| 4 | 容器 Up，`network_mode: host` |
| 5 | `echo $ROS_DOMAIN_ID` → **30** |
| 6 | `bash /boot_jason_camera.sh camera` → `/my_camera/pylon_ros2_camera_node` |
| 7 | `ros2 topic list` 含 `image_raw`、`camera_info` |
| 8 | `ros2 topic hz .../image_raw` 连续稳定（记录实际 FPS；underrun 单独记录） |
| 9 | `ros2 topic echo .../image_raw --once` 有数据 |
| 10 | `bash /boot_jason_camera.sh qr` → `/wechat_qr_node` |
| 11 | `ros2 topic info -v /wechat_qr_node/decoded_info` → **Publisher count = 1** |
| 12 | 实物二维码 → `decoded_info` 有字符串 |

**禁止**：出现 2 个 `wechat_qr_node` 时自动 kill；先分析启动来源（`boot_gazebo_lite.sh` 已有 `camera_gazebo_qr`）。

---

## 13. 风险

| 风险 | 级别 | 说明 |
|------|------|------|
| Pylon deb 缺失 | **BLOCKER** | 无法 build pylon 组件 |
| GigE underrun | **HIGH** | 可能导致 hz 不稳定或丢帧 |
| `.run` vs `workspace_v02` 漂移 | **MED** | bind-mount 用 `.run`，Dockerfile 用 canonical |
| 双 QR 节点 | **MED** | 仿真 QR + Jason QR 同 domain |
| `colcon build` 时间/磁盘 | **LOW** | pcl_ros 等依赖较大 |
| 重建镜像中断仿真 | **LOW** | 计划内停机窗口 |

---

## 14. 回滚方法

1. **源码**：删除 AGV `src/` 下 4 个 Jason package 及 `delivery_bringup/launch/jason_*.launch.py`
2. **Dockerfile**：`git checkout` 或恢复 `Dockerfile.lite` 备份
3. **镜像**：继续使用原 `delivery-ros2-humble-gazebo-v02.tar` 或 rebuild 无 Jason 源码的版本
4. **运行态**：不启动 `boot_jason_camera.sh`；现有 `boot_gazebo_lite.sh` 不受影响
5. **Jason 原工程**：全程未修改，无需回滚

---

## 附录：启动命令

```bash
docker exec -it delivery_gazebo_soft bash
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
export ROS_DOMAIN_ID=30

# 仅相机
bash /boot_jason_camera.sh camera

# 仅 QR（相机需已运行）
bash /boot_jason_camera.sh qr

# 相机+QR（验收 Stage 10+ 慎用，确认无重复 QR）
bash /boot_jason_camera.sh both
```
