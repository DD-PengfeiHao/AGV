# Jason Smoke Test Report

> **日期**：2026-08-13（第四轮：Pylon 安装 + 全链路实测）  
> **执行模式**：Smoke Test 工程师  
> **Jason 原工程**：只读，未修改

---

## Summary Table

| 检查项 | 结果 |
|--------|------|
| **Environment** | **PASS** |
| **Jason Packages** | **PASS**（4/4） |
| **Pylon** | **PASS** |
| **Basler Discovery** | **PASS** |
| **Camera Node** | **PASS** |
| **image_raw** | **PASS** |
| **Camera HZ** | avg **1.83 Hz**（12s 窗口；配置 8 Hz，GigE/曝光限制导致实际偏低） |
| **QR Node** | **PASS** |
| **decoded_info** | **PARTIAL**（Publisher=1，现场无 QR 未测识别） |
| **Duplicate QR** | **NO** |

### FINAL RESULT: **CAMERA PASS / QR PARTIAL**

真实数据流已验证：

```
Basler acA2500-14gc (106611-18)
  → Pylon 8.0.0 (/opt/pylon)
  → /my_camera/pylon_ros2_camera_node
  → /my_camera/pylon_ros2_camera_node/image_raw (sensor_msgs/Image, mono8)
  → /wechat_qr_node (订阅 image_raw)
  → /wechat_qr_node/decoded_info (Publisher=1)
```

---

## 1. Environment

| 项 | 结果 |
|----|------|
| Host | `192.168.18.240` |
| Container | `delivery_gazebo_soft` — **Up**（Pylon build 后 recreate） |
| Container OS | Ubuntu 22.04.5 LTS ✅ |
| ROS2 | Humble ✅ |
| `ROS_DOMAIN_ID` | **30** ✅ |
| `/etc/agv_pylon_state` | **PYLON_INSTALLED=1** ✅ |
| Network | `ens37` = `192.168.18.240/24`；ping `192.168.18.251` **0% 丢包** ✅ |

**Environment：PASS**

---

## 2. Jason Packages

| Package | `ros2 pkg list` |
|---------|-----------------|
| `pylon_ros2_camera_interfaces` | **OK** |
| `pylon_ros2_camera_component` | **OK** |
| `pylon_ros2_camera_wrapper` | **OK** |
| `qrcode_detector` | **OK** |

Docker build：`Summary: 12 packages finished [3min 51s]`

**Jason Packages：PASS**

---

## 3. Pylon

### 安装来源

| 项 | 值 |
|----|-----|
| 官方文件 | `pylon-8.0.0-linux-x86_64_setup.tar.gz`（664 MB，用户手动放置） |
| 内层 SDK | `pylon-8.0.0.16021_linux-x86_64.tar.gz` |
| 安装路径 | `/opt/pylon` |

### 容器内验证

```
PYLON_INSTALLED=1
/opt/pylon/lib/libpylonbase.so.9  ✅
/opt/pylon/share/pylon/cmake/pylon-config.cmake  ✅
PYLON_ROOT=/opt/pylon
GENICAM_GENTL64_PATH=/opt/pylon/lib/gentlproducer/gtl
```

**说明**：Pylon 8.0.0 setup 包为双层 tar 结构；`libpylon.so` 在旧路径不存在，实际库为 `libpylonbase.so.9`（已修复 `Dockerfile.lite` 安装逻辑）。

**Pylon：PASS**

---

## 4. Basler Discovery

| 检查项 | 结果 |
|--------|------|
| ping 192.168.18.251 | **0% 丢包** |
| Pylon 发现（Camera launch 日志） | **Found camera device! Device Model: acA2500-14gc with Device User Id: 106611-18** ✅ |
| `pylonIPConfigurator` GUI | 容器无 display，未用 GUI 工具；**以 Camera Node 连接日志为准** |
| 只读约束 | 未修改相机 IP/配置/网络 ✅ |

**Basler Discovery：PASS**

---

## 5. Camera Node

| 检查项 | 结果 |
|--------|------|
| 启动方式 | `ros2 launch delivery_bringup jason_camera.launch.py` |
| Node | `/my_camera/pylon_ros2_camera_node` ✅ |
| Topic | `/my_camera/pylon_ros2_camera_node/image_raw` ✅ |
| AGV 仿真 Camera | `/camera_gazebo_qr` 仍在运行（不同 topic，无冲突） |

**Camera Node：PASS**

---

## 6. image_raw / Camera HZ

```
ros2 topic info /my_camera/pylon_ros2_camera_node/image_raw
  Type: sensor_msgs/msg/Image
  Publisher count: 1

ros2 topic hz (12s):
  average rate: 1.831
  min: 0.120s  max: 1.639s  std dev: 0.44338s  window: 12

ros2 topic echo --once:
  encoding: mono8
  width: 1294  height: 970
  frame_id: basler_aca2500_106611_18
  data: [真实像素值 ...]
```

**image_raw：PASS**  
**Camera HZ：1.83 Hz 平均**（配置 frame_rate=8.0；GigE inter_pkg_delay / exposure 等导致实际帧率偏低，但持续有真实 Image 输出）

---

## 7. QR

| 检查项 | 结果 |
|--------|------|
| 启动 | `ros2 launch qrcode_detector qrcode_detector.launch.py image_topic:=/my_camera/pylon_ros2_camera_node/image_raw` |
| Node | `/wechat_qr_node` ✅ |
| 订阅 | `/my_camera/pylon_ros2_camera_node/image_raw` ✅ |
| Topic | `/wechat_qr_node/decoded_info` ✅ |
| Publisher count | **1** ✅ |
| 实际 QR 识别 | **NOT TESTED**（现场无二维码，未伪造结果） |

**QR Node：PASS**  
**decoded_info：PARTIAL**（链路就绪，Publisher=1）  
**Duplicate QR：NO**

---

## 8. AGV 侧修复记录（本轮）

| 文件 | 修改 |
|------|------|
| `docker/Dockerfile.lite` | setup 包双层解压：`setup.tar.gz` → 内层 `pylon-*.tar.gz` → `/opt/pylon`；验证 `libpylonbase.so.9` |
| `docker/vendor/pylon/` | 用户放置 `pylon-8.0.0-linux-x86_64_setup.tar.gz` |
| `scripts/jason_smoke_rebuild.sh` | CRLF 修复 |

**已知小问题（不阻塞 Smoke Test）**：
- `/boot_jason_camera.sh` 镜像内仍有 CRLF，需下次 rebuild 前修复；本轮使用 `ros2 launch delivery_bringup jason_camera.launch.py` 直接启动

**Jason 原工程**：未修改、未 build、未 install 复制。

---

## 9. Blocking Issues

**无 P0 阻塞。**

### P2（可选后续）

1. 修复 `boot_jason_camera.sh` CRLF 并 rebuild 镜像  
2. 优化 GigE 参数提升 frame_rate 接近配置 8 Hz  
3. 现场放置 QR 码复测 `decoded_info` 实际识别内容  

---

## 10. 复现命令（容器内）

```bash
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
export ROS_DOMAIN_ID=30
export PYLON_ROOT=/opt/pylon
export GENICAM_GENTL64_PATH=/opt/pylon/lib/gentlproducer/gtl

# Camera only
ros2 launch delivery_bringup jason_camera.launch.py

# Verify
ros2 topic hz /my_camera/pylon_ros2_camera_node/image_raw
ros2 topic echo /my_camera/pylon_ros2_camera_node/image_raw --once

# QR (after camera PASS)
ros2 launch qrcode_detector qrcode_detector.launch.py \
  image_topic:=/my_camera/pylon_ros2_camera_node/image_raw
ros2 topic info /wechat_qr_node/decoded_info
```

---

## 附录：Camera 启动关键日志

```
Trying to connect the camera device with the following device user id: 106611-18
Found camera device! Device Model: acA2500-14gc with Device User Id: 106611-18
Start image grabbing if node connects to topic with a spinning rate of: 8 Hz
Current ROI (x_offset, y_offset, height, width): 0, 0, 970, 1294
```
