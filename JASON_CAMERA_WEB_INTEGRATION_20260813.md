# Jason Camera Web Integration Report

> **日期**：2026-08-13  
> **阶段**：Phase 2 — Camera Web Smoke / Integration Test  
> **访问地址**：http://192.168.18.240:19999/camera.html

---

## 最终分级

| 检查项 | 结果 |
|--------|------|
| Docker | **PASS** |
| Pylon | **PASS** |
| Basler | **ONLINE** |
| Camera ROS2 | **PASS** |
| image_raw | **PASS** |
| Web Server | **PASS** |
| Browser | **PASS** |
| Live Camera | **PASS** |
| Camera Status | **PARTIAL** |
| FPS | **~1.2–1.7 Hz**（实时计算） |
| QR Control | **PASS** |
| QR Recognition | **NOT TESTED**（现场无 QR 码） |
| Offline Detection | **PARTIAL** |
| Recovery | **PASS** |

### **FINAL RESULT: CAMERA WEB PARTIAL**

核心链路已打通：**Basler → Pylon → ROS2 image_raw → dashboard MJPEG/snapshot → 浏览器实时画面**。  
QR 按钮 ON/OFF 已验证；实际 QR 解码未测（无二维码）。

---

## 架构（复用现有 delivery_web）

```
/my_camera/pylon_ros2_camera_node/image_raw  (mono8 1294×970)
        ↓
JasonCameraWebBridge (dashboard_node 内)
        ↓ JPEG encode
/api/jason/camera/snapshot  +  /api/jason/camera/status
        ↓
www/camera.html  (700ms 轮询)
        ↓
Browser 实时画面

QR（独立控制）:
POST /api/jason/qr/start|stop → subprocess 启动/停止 wechat_qr_node
/wechat_qr_node/decoded_info → Web Last QR Result
```

**未改动**：Gazebo 三相机、导航、arm、face。Jason 原工程只读。

---

## 修改文件

| 文件 | 变更 |
|------|------|
| `delivery_web/delivery_web/jason_camera_web.py` | **新增** — Jason image 订阅、FPS/状态、QR 启停 |
| `delivery_web/delivery_web/dashboard_node.py` | **扩展** — Jason HTTP API + camera.html 路由 |
| `delivery_web/www/camera.html` | **新增** — Camera 页面（画面/状态/FPS/QR 按钮） |
| `delivery_web/patch_dashboard.py` | **新增** — dashboard 补丁脚本（VM 已执行） |
| `docker/boot_gazebo_lite.sh` | 启动时 `ros2 launch delivery_bringup jason_camera.launch.py`（Camera 常开，QR 默认 OFF） |
| `docker/boot_jason_camera.sh` | CRLF 修复（LF） |

---

## 浏览器验证（已实测）

访问：**http://192.168.18.240:19999/camera.html**

已确认：

1. **真实 Basler 灰度画面**（非 Gazebo / mock / 静态图）
2. **Source: REAL**，**1294 × 970**，**FPS ~1.2–1.7 Hz**
3. **「开始二维码识别」** → 按钮变为 **「停止二维码识别」**，`/wechat_qr_node` 出现
4. **「停止二维码识别」** → QR OFF，**相机画面继续**
5. 断流时显示 *Camera stream unavailable*，非无限 loading

---

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/camera.html` | Camera 页面 |
| GET | `/api/jason/camera/status` | ONLINE/OFFLINE、FPS、分辨率、QR 状态 |
| GET | `/api/jason/camera/snapshot` | JPEG 单帧 |
| GET | `/api/jason/camera/stream` | MJPEG（可选） |
| POST | `/api/jason/qr/start` | 启动 QR（不影响 Camera） |
| POST | `/api/jason/qr/stop` | 停止 QR |

---

## 已知限制 / 后续

1. **Camera Status 偶发 OFFLINE**：实际 FPS ~1.5 Hz，但帧间隔有时 5–7s，超过离线阈值时状态变红；**画面仍可通过 snapshot 显示**。可调 GigE 参数或放宽 `JASON_OFFLINE_SEC`。
2. **容器 recreate 后**需执行一次：`colcon build --packages-select delivery_web`（`camera.html` 安装到 share）。
3. **QR 实际识别**：需现场放置二维码复测 `Last QR Result`。
4. **镜像内 `/boot_jason_camera.sh`** 仍有旧 CRLF 副本；boot 已改为直接 `ros2 launch`，不依赖该脚本。

---

## 复现命令

```bash
# 容器内
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
colcon build --packages-select delivery_web --symlink-install

# 浏览器
http://192.168.18.240:19999/camera.html
```
