# 容器架构分析：xarm7_real vs delivery_gazebo_soft

> 版本：V0.52.0 · 2026-08-17

## 背景

现场 `pick_place_server` 运行在 Zack 的 **xarm7_real** 容器中；Dashboard 后端与 **agv_bridge** 运行在 **delivery_gazebo_soft** 中。两者通过 `ROS_DOMAIN_ID=30` + `rmw_fastrtps_cpp` 跨容器 DDS 发现服务，偶发超时，调试需进两个容器。

**问题**：能否将 Dashboard + agv_bridge 迁入 xarm7_real，去掉 delivery_gazebo_soft 这一层？

---

## 两容器职责对比

| 维度 | xarm7_real | delivery_gazebo_soft |
|------|------------|----------------------|
| **所有者** | Zack（厂商/机械臂栈） | 本项目（Delivery Web） |
| **主要节点** | `pick_place_server`、`unlock_and_home`、`do_pick_place`、`set_gripper`、xArm 真实驱动 | `dashboard_node`、`agv_bridge_node`、Gazebo 仿真（可选）、`camera_bridge`、`face_bridge` |
| **ROS 包** | xarm_ros2、pick_place 相关 | `delivery_web`、`agv_bridge`、`delivery_bringup`、Keyence/Pylon 视觉栈 |
| **网络** | 需现场确认（通常 host 或桥接） | `network_mode: host`（AGV TCP 直连） |
| **用户** | `xarm`（非 root） | `root` |
| **源码挂载** | `/home/ubuntu/Zack.Li/AGV/v43` 等 | `/opt/delivery_ws/src` 挂载 |

---

## xarm7_real 中缺失、需补装的内容

1. **delivery_web** — HTTP Dashboard（aiohttp 经 stdlib `http.server`，依赖 rclpy、delivery_interfaces）
2. **agv_bridge** — Robokit TCP 客户端、AGV 状态轮询
3. **stack_supervisor 依赖** — Keyence、Pylon、QR/AprilTag（若仍在 NUC 本机跑，不一定进 xarm 容器）
4. **Python 依赖** — 与 delivery 镜像一致（`pip` 装 yaml、numpy 等，若基础镜像无）
5. **配置与地图** — `devices.nuc.release.yaml`、`/data/agv_downloaded` 地图目录
6. **日志目录** — `/var/log/delivery` 写权限

**不应迁入 xarm7_real 的**：Gazebo 仿真、Leo/Jason 独立容器内的节点（保持 DDS 远程调用即可）。

---

## 可行性分析

### 1. pip / 依赖安装权限

- **xarm 用户**通常可在用户目录 `pip install --user`，但系统级包需 root。
- Dashboard 主要依赖 ROS2 Humble + 工作空间 `colcon build`，与 delivery 镜像相同；**若 xarm7_real 已是 Humble + 可挂载 `ros2_ws/src`，技术上可 colcon 编译 delivery_web + agv_bridge**。
- 风险：Zack 镜像可能是**只读或受控**，随意 `apt`/`pip` 可能被现场策略禁止。

### 2. ros2_ws 挂载

- delivery_gazebo_soft 已挂载 `../ros2_ws/src:/opt/delivery_ws/src`。
- xarm7_real 若**未挂载**本项目 `ros2_ws`，需改 docker-compose 增加 volume，或与 Zack 协调目录布局。

### 3. 网络模式与 AGV TCP

- AGV Robokit API 使用 **TCP 直连车辆 IP**（如 192.168.x.x）。
- **必须 `network_mode: host`**（或等效 macvlan），否则容器 NAT 可能导致连接不稳定。
- 若 xarm7_real 为 bridge 网络，**agv_bridge 迁过去会失败**，除非改 compose 为 host。

### 4. 端口 19999

- Dashboard 监听 `0.0.0.0:19999`。
- 非 root 用户绑定 **1024 以上端口**通常无问题；19999 **可行**。
- 需确认无防火墙/已有进程占用。

### 5. 跨容器 DDS 问题是否消失

- 迁入后 **pick_place_server 与 dashboard 同进程空间/同容器**，机械臂服务调用变为本机 loopback DDS，**消除跨容器发现延迟**。
- AGV、Leo 人脸、Jason 相机仍在其他主机/容器时，**仍依赖 DDS**，仅机械臂链路简化。

### 6. 为何不直接合并的主要风险

| 风险 | 说明 |
|------|------|
| 镜像所有权 | xarm7_real 由 Zack 维护，升级可能覆盖我们的启动项 |
| 依赖冲突 | 两套 ROS 包版本不一致可能导致 ABI/消息定义冲突 |
| 职责混杂 | 机械臂故障与 Web 故障同容器，重启影响面变大 |
| 仿真场景 | Gazebo 仍在 delivery_gazebo_soft，**无法完全去掉**该容器，只能改为「仅仿真 profile」 |

---

## 推荐方案

### 方案 A（推荐，渐进）：机械臂同机、Dashboard 留 delivery_gazebo_soft

- 保持 Dashboard + agv_bridge 在 **delivery_gazebo_soft**（host 网络、root、已验证）。
- 机械臂继续 **xarm7_real**；优化 `arm_bridge.py` CLI 回退与超时（V0.51.x 已做）。
- 用 **故障码弹窗 + 重启关联件** 降低运维成本。
- **适用**：生产 NUC，Zack 容器不可改。

### 方案 B（可行，需 Zack 配合）：Dashboard 迁入 xarm7_real

**前提**：xarm7_real 可改 compose、host 网络、挂载 `delivery_ws/src`。

1. 在 xarm7_real 的 compose 中增加：
   - `network_mode: host`
   - volumes: `../../migration_implementation/workspace_v02/ros2_ws/src:/opt/delivery_ws/src:rw`
   - volumes: 地图与日志目录
   - `ROS_DOMAIN_ID=30`、`RMW_IMPLEMENTATION=rmw_fastrtps_cpp`
2. 容器内 `colcon build` `delivery_web` + `agv_bridge`。
3. 启动脚本增加：
   ```bash
   ros2 run agv_bridge agv_bridge_node &
   python3 -m delivery_web.dashboard_node  # 或现有 start_dashboard_release.sh
   ```
4. **delivery_gazebo_soft** 改为仅 `sim-soft` profile 启动 Gazebo，不再跑 dashboard。

### 方案 C（不可行/不推荐）

- 在 **只读厂商镜像** 且禁止挂载、禁止 host 网络时，**不可迁移**。
- 将 `docker restart xarm7_real` 放入 Dashboard「重启关联件」——**禁止**（非我方容器）。

---

## 决策清单（现场核对）

在 NUC 上执行：

```bash
# xarm7_real 内
docker inspect xarm7_real --format '{{.HostConfig.NetworkMode}}'
docker inspect xarm7_real --format '{{json .Mounts}}'
whoami && python3 -c "import rclpy; print('rclpy ok')"
ss -tlnp | grep 19999

# delivery_gazebo_soft 内
ros2 service list | grep pick_place
```

| 检查项 | 期望（方案 B） |
|--------|----------------|
| NetworkMode | `host` |
| src 挂载 | 有 `/opt/delivery_ws/src` 或可添加 |
| rclpy | 可 import |
| 19999 | 未被占用或改端口 |

---

## 结论

- **技术上可行**：在 xarm7_real 具备 host 网络、可挂载源码、可安装/编译 delivery 包的前提下，将 Dashboard + agv_bridge 迁入可消除机械臂跨容器 DDS 问题。
- **组织上需协调**：xarm7_real 非我方镜像，默认 **方案 A** 更稳妥；方案 B 作为与 Zack 对齐后的优化路径。
- **delivery_gazebo_soft 不能完全删除**：仿真与部分视觉栈仍需要该镜像；可收缩为「仅仿真 / 仅视觉」角色。

---

## 相关文件

- `docker/docker-compose.yml` — delivery 容器定义
- `delivery_web/delivery_web/dashboard_node.py` — Dashboard 入口
- `agv_bridge/agv_bridge/robokit_client.py` — AGV TCP
- `release/V0.51.4/start_dashboard_release.sh` — 启动脚本
