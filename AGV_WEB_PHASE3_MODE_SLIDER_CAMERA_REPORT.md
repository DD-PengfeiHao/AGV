# Mode Slider + Demo Camera Debug Report

**Date:** 2026-08-13  
**Version:** V0.3.1 (mode slider + ROS probe)

---

## 1. Mode Slider (IMPLEMENTED)

### UI
- Header **三段滑块**: Mock (左) | Dev (中) | Demo (右)
- 中文标签: 模拟模式 / 开发模式 / 实车模式
- Adapter 状态: ✅已连接 / ❌离线
- Demo 额外显示 AGV IP + Robokit 连接

### 交互
- 点击段位 → 确认弹窗
- 导航进行中 → 额外警告 + 自动 `/api/cancel`
- 确认 → `POST /api/env` → 成功后 `location.reload()`
- 失败 → alert + 滑块回退

### 部署后验证
```bash
# 切换 mock
curl -X POST http://172.31.0.111:19999/api/env -H "Content-Type: application/json" -d '{"mode":"mock","agv_host":"127.0.0.1"}'

# 切换 demo
curl -X POST http://172.31.0.111:19999/api/env -H "Content-Type: application/json" -d '{"mode":"demo","agv_host":"192.168.18.198"}'

# 切换 dev
curl -X POST http://172.31.0.111:19999/api/env -H "Content-Type: application/json" -d '{"mode":"dev"}'
```

---

## 2. Demo 模式相机离线 — 根因

**Ping 通 ≠ ROS 在线**

| 模式 | 88 腕部相机数据源 |
|------|------------------|
| mock | Mock JPEG（无需硬件） |
| dev/demo | ROS topic `/my_camera/pylon_ros2_camera_node/image_raw` |

Demo 模式走 **真实 ROS 订阅**，不是 HTTP 直连相机 IP。

### 最可能原因（按概率）

1. **ROS_DOMAIN_ID 不一致** — VM dashboard Domain 30，Jason/相机节点可能是其他 Domain
2. **Pylon ROS 节点未运行** — topic publisher count = 0
3. **DDS 跨机防火墙** — UDP 7400-7500 未放行
4. **Topic 名称不匹配** — 已在 `devices.yaml` 配置

### 代码改进（本次）

- `devices.yaml` → `ros.domain_id: 30`
- `vision/ros_probe.py` — 统一 topic publisher 探测 + ping
- 腕部/91 状态拆分: `network_online` / `ros_node_online`
- UI 显示: `NET OK · NO ROS PUBLISHER (Domain 30)`

---

## 3. Camera-A (88) 排查清单

在 **VM 容器内**执行:

```bash
docker exec -it delivery_gazebo_soft bash
export ROS_DOMAIN_ID=30   # 与 devices.yaml 一致
source /opt/ros/humble/setup.bash && source /opt/delivery_ws/install/setup.bash

ping -c1 172.31.0.88
ros2 topic list | grep pylon
ros2 topic info -v /my_camera/pylon_ros2_camera_node/image_raw
ros2 topic hz /my_camera/pylon_ros2_camera_node/image_raw
```

**PASS 标准:** Publisher count >= 1, hz > 0

**若 publisher=0:** 在相机所在机器启动 Pylon:
```bash
ros2 launch pylon_ros2_camera_wrapper pylon_ros2_camera.launch.py \
  config_file:=.../aca2500_106611_18.tuned_v3.yaml
```

**Web 验证 (demo/dev 模式):**
```bash
curl http://172.31.0.111:19999/api/vision/wrist_camera/status
curl -o /tmp/w.jpg http://172.31.0.111:19999/api/vision/wrist_camera/snapshot
file /tmp/w.jpg   # expect JPEG
```

---

## 4. Camera-B (91) 排查清单

91 是 **Keyence 扫码器**，不是视频相机。

```bash
ping -c1 172.31.0.91
ros2 topic info -v /scanner/barcode
ros2 service list | grep trigger
```

UI 显示扫码结果 + 定位校验，**无视频窗口**。

---

## 5. Leo (87/85)

状态: **DEVELOPING** — 独立窗口预留，无真实视频。

---

## 6. 修改文件

| 文件 | 变更 |
|------|------|
| `www/index.html` | 三模式滑块 + 确认弹窗 + 状态显示 |
| `dashboard_node.py` | `_public_env()` adapter 状态 + label 修复 |
| `device_config.py` | `ros_domain_id`, `agv.robokit_host` |
| `devices.yaml` | `ros.domain_id` |
| `vision/ros_probe.py` | **NEW** |
| `vision/wrist_camera.py` | 使用 ros_probe + domain_id |
| `vision/floor_qr_scanner.py` | network/ROS 状态 |

---

## 7. 部署

```bash
scp delivery_web agv_bridge → VM
docker exec delivery_gazebo_soft colcon build --packages-select delivery_web agv_bridge
# restart dashboard_node
```

---

## 8. 验收表

| 项 | 状态 |
|----|------|
| 模式滑块 UI | **IMPLEMENTED** — 待部署验证 |
| Mock 切换 | **IMPLEMENTED** |
| Dev 切换 | **IMPLEMENTED** |
| Demo 切换 | **IMPLEMENTED** |
| Mock 88 画面 | **PASS** (mock JPEG) |
| Demo 88 画面 | **HARDWARE BLOCKED** until ROS publisher >= 1 |
| Demo 91 扫码 | **HARDWARE BLOCKED** until /scanner/barcode pub |
| Leo | **DEVELOPING** |
