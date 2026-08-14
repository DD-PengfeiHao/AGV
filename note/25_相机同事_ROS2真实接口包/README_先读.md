# 相机同事：仓库真实接口核查说明（勿手写兼容版）

> 来源仓库路径（以团队机为准）：  
> `AGV_Delivery_v0.2.0_*/workspace_v02/ros2_ws/src/`  
> 本目录文件均为 **原样拷贝**，见 `SHA256SUMS.txt`。

**原则：没有下列真实定义前，不要自写兼容 `.msg/.srv`。**

---

## 1. 已核对存在的真实定义

| 文件 | 本包路径 | 仓库源路径 |
|------|----------|------------|
| CameraHeartbeat.msg | `delivery_interfaces/msg/CameraHeartbeat.msg` | `delivery_interfaces/msg/CameraHeartbeat.msg` |
| CameraInfoLite.msg | `delivery_interfaces/msg/CameraInfoLite.msg` | 同上 |
| CameraCapture.srv | `delivery_interfaces/srv/CameraCapture.srv` | 同上 |
| Xavier 骨架 | `camera_bridge/cam_front_ros_node.py` | `camera_bridge/camera_bridge/cam_front_ros_node.py` |
| NUC 接收（对照 QoS） | `camera_bridge/camera_ingress_node.py` | 同上 |

`CMakeLists.txt` 已包含 `CameraHeartbeat.msg` 注册（勿漏编）。

---

## 2. 字段（必须按仓库）

### CameraHeartbeat.msg
```
std_msgs/Header header
string camera_name
uint64 seq
float32 uptime_sec
float32 fps_actual
uint64 frames_total
uint64 frames_dropped
bool link_ok
string device_id
int32 error_code
string error_msg
```

### CameraInfoLite.msg
```
std_msgs/Header header
string camera_name
uint32 width
uint32 height
float32 fps
bool connected
string transport   # 填 xavier_ros2；无链路时仍可发，connected=false
```

### CameraCapture.srv
```
string camera_name
---
bool success
string message
string encoding      # 骨架用 "jpeg"
uint32 width
uint32 height
uint8[] data         # jpeg 字节；勿改成 Image 嵌套
```

---

## 3. QoS（骨架已写死，收发必须对齐）

来自 `cam_front_ros_node.py` / `camera_ingress_node.py`：

| Topic | 类型 | Publisher QoS |
|-------|------|----------------|
| `/camera/cam_front/image_raw/compressed` | CompressedImage | `qos_profile_sensor_data`（BEST_EFFORT, depth≈5） |
| `/camera/cam_front/heartbeat` | CameraHeartbeat | RELIABLE, KEEP_LAST 1, VOLATILE |
| `/camera/cam_front/status` | std_msgs/String JSON | RELIABLE, KEEP_LAST 1 |
| `camera/cam_front/info` | CameraInfoLite | RELIABLE, KEEP_LAST 1 |
| `/camera/capture` | CameraCapture | 默认 service（RELIABLE） |

NUC `camera_ingress` 用同一套订 compressed / heartbeat / status。  
**改 QoS 会导致订不到。**

---

## 4. Aravis 接口情况（最小改动范围）

仓库骨架 **没有内嵌 Aravis 代码**，而是可选导入你们现有工程：

```python
from app.capture.gige_capture import GigeCapture
cap = GigeCapture(camera_id=self._device_id, ...)
cap.start(); frame = cap.read()
```

含义：

| 项 | 结论 |
|----|------|
| 是否已有 Aravis 封装 | **在人脸工程** `python+opencv/app/capture/gige_capture.py`，不在本 ROS 包内 |
| 骨架职责 | ROS2 发布/心跳/抓拍；采集失败则 `link_ok=false` 且节点不退出 |
| **最小改动** | ① 编译本仓库 `delivery_interfaces`+`camera_bridge` ② PYTHONPATH 指到含 `app.capture.gige_capture` 的工程 ③ `-p camera_id:=<Basler IP>` ④ 保证 eth1 有链路 |
| 不要做 | 另写一套 msg；改 topic 名；先上 HTTP :8080 当正式通路 |

若不愿依赖 `app.capture`：只改 `_open_camera()` / `_grab_tick()` 换成你们的 Aravis 读取，**发布侧字段与 QoS 保持不动**。

---

## 6. 鹏飞已确认的 5 点（勿再猜）

详见同级目录 `../相机需要确定的事情/00_鹏飞确认结论.md`：

1. Topic **一律绝对名** `/camera/...`
2. 权威 `/camera/cam_front/info` **仅 NUC**；Xavier 发 `driver_info`（可选）
3. transport 统一 `xavier_ros2` / `xavier_ros2_waiting`（禁止裸 `ros2`）
4. 图像无 seq；序号只在 heartbeat；第一版不改 msg
5. Basler IP / 网口名以现场实测为准，勿盲改启动参数

---

## 5. 建议你方工作步骤

1. 整包拷走本目录（或直接拉团队仓库对应路径）。  
2. Humble（Docker）下 `colcon build --packages-select delivery_interfaces camera_bridge`。  
3. `export ROS_DOMAIN_ID=30 ROS_LOCALHOST_ONLY=0`  
4. `ros2 run camera_bridge cam_front_ros_node --ros-args -p camera_id:=192.168.1.100`  
5. 自测：
   ```bash
   ros2 topic echo /camera/cam_front/heartbeat --once
   ros2 topic hz /camera/cam_front/image_raw/compressed
   ```
6. 通知系统侧 NUC `192.168.0.173` 验收。

完整契约见同目录 `25_相机ROS2工业契约.md`。
