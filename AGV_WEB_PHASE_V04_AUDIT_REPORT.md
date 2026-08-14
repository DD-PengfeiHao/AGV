# AGV Web V0.4 审计报告

**日期:** 2026-08-14  
**版本:** V0.4.0  
**状态标签说明:** IMPLEMENTED / MOCK VERIFIED / VM VERIFIED / HARDWARE VERIFIED / BLOCKED / NOT TESTED

---

## 1. 当前 Workspace

| 项 | 值 |
|----|-----|
| 活跃路径 | `migration_implementation/workspace_v02/ros2_ws/src/` |
| Web 包 | `delivery_web` 0.4.0 |
| 桥接包 | `agv_bridge`（含 `agv_adapter` + **新增 `arm`**） |
| 受保护 Freeze | Phase B P0、Phase C 两个 Freeze **未修改** |
| 新 Freeze | `AGV_WEB_PHASE_V04_PRE_IMPLEMENTATION_FREEZE_20260814/` |

---

## 2. Phase C 视觉模块现状

| 设备 | IP | 实现 | 缺口（V0.4 前） | V0.4 处理 |
|------|-----|------|----------------|-----------|
| Floor QR Keyence | 172.31.0.91 | `/scanner/trigger` + `/scanner/barcode` | UI 仅有 Trigger Scan | **触发扫码** 按钮 + 中文标签 |
| Wrist Pylon | 172.31.0.88 | 快照 + 持续检测节点 | 缺 burst 触发 | **`trigger_qr_burst` / `trigger_apriltag_burst`** 3s 窗口 |
| Leo Face | .85 / .87 | DEVELOPING 占位 | 无触发接口 | **`trigger_face()` → NOT_AVAILABLE** |

### ROS2 接口（已审计）

- Floor: `std_srvs/srv/Trigger` → `/scanner/trigger`；`std_msgs/String` → `/scanner/barcode`
- Wrist QR: `/wechat_qr_node/decoded_info`
- Wrist AprilTag: `/detections`, `/apriltag/pose`, `/apriltag/transform`
- Leo: 无稳定生产接口 → Web 不伪造结果

---

## 3. 机械臂真实软件审计（NUC 172.31.0.84）

**路径:** `/home/ubuntu/Zack.Li/AGV/v43`  
**审计方式:** 只读源码 + 接口文档 `xArm7_ROS2_完整接口文档_V4.0.md`

| # | 审计项 | 结论 |
|---|--------|------|
| 1 | 机械臂型号 | **UFACTORY xArm7** @ 172.31.0.123 |
| 2 | 控制程序入口 | `pick_place_node.py`（节点名 `/pick_place_server`） |
| 3 | 通信方式 | xArm Python SDK 直连 + Modbus TCP:502 夹爪 |
| 4 | xArm SDK | **是** (`xarm-python-sdk==1.18.4`) |
| 5 | ROS2 | **是**（混合架构：SDK 运动 + ROS2 对外接口） |
| 6 | ROS2 Node | `/pick_place_server` |
| 7 | Services | `/unlock_and_home`, `/do_pick_place`, `/set_gripper`（均为 Trigger/SetBool） |
| 8 | Topics | `/pick_place_state`（**纯文本**，非 JSON）, `/joint_states`（~20Hz） |
| 9 | TCP/HTTP API | **无**独立 HTTP；仅 ROS2 |
| 10 | 状态数据结构 | 文本状态 + JointState 数组（弧度） |
| 11 | Joint State | `/joint_states` |
| 12 | TCP Pose | **无 Topic**；仅 SDK 内部，Web 需 FK 或扩展节点 |
| 13 | Robot Mode | Position（代码默认） |
| 14 | Motion State | `/pick_place_state` 文本解析（BUSY/Studio 等） |
| 15 | Error/Warning | Service message 字符串；无统一 ERR_ 前缀 |
| 16 | Gripper | Modbus FC05；状态从文本推断 OPEN/CLOSE |
| 17 | 控制接口 | 仅预设取放序列，**无 move_joint/move_tcp** |
| 18 | 安全限位 | `threading.Lock` + `MutuallyExclusiveCallbackGroup`；AGV 需停稳后调用 |
| 19 | 运动执行 | `/do_pick_place` 阻塞 ~63s/cycle；**禁止 auto_start 默认模式用于联调** |

**真实运动:** **BLOCKED** — 等待用户明确授权

---

## 4. Web UI 审计（V0.4 前）

- 地图约 70% / 视觉 30% — 视觉仍偏大
- 无机械臂面板
- 腕部仅有 detect start/stop，无 burst 触发按钮
- Leo 仅占位

---

## 5. V0.4 实现摘要

### 新增模块

```
agv_bridge/agv_bridge/arm/
├── models.py, base.py, mock.py, real.py, factory.py, safety.py

delivery_web/delivery_web/arm/
└── manager.py
```

### 新增 API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/arm/status` | 机械臂状态（缓存，非阻塞） |
| POST | `/api/arm/command` | mock 关节/TCP 控制；real 返回 BLOCKED |
| POST | `/api/arm/mode` | simulation / real |
| POST | `/api/vision/wrist_camera/trigger/qr` | 3s burst |
| POST | `/api/vision/wrist_camera/trigger/apriltag` | 3s burst |
| POST | `/api/vision/leo_face/trigger` | DEVELOPMENT / NOT_AVAILABLE |

### Web 布局

- 地图列 **68%**，视觉列压缩
- 底部 **arm-row** 全宽三列：3D 模型 / 状态 / 仿真控制
- 标题 **v0.4**

---

## 6. 测试状态（§17 清单）

| # | 测试项 | 结果 |
|---|--------|------|
| 1 | Web 页面启动 | **VM VERIFIED** |
| 2 | readyState complete | **VM VERIFIED**（浏览器加载） |
| 3 | pending resources = 0 | **NOT TESTED**（未跑 DevTools 计数） |
| 4 | AGV 地图正常 | **VM VERIFIED** |
| 5 | AGV 状态正常 | **VM VERIFIED** |
| 6 | 三视觉窗口正常 | **VM VERIFIED** |
| 7 | 三 Trigger 按钮可用 | **MOCK VERIFIED** |
| 8 | Mock Scanner 触发 | **MOCK VERIFIED** → LM3 |
| 9 | Mock Wrist QR | **MOCK VERIFIED** → MOCK-QR-001 |
| 10 | Mock Wrist AprilTag | **MOCK VERIFIED** → tag36h11:0 |
| 11 | Mock Leo Face | **MOCK VERIFIED** → MOCK_FACE_PENDING |
| 12 | Mock Arm Online | **MOCK VERIFIED** |
| 13 | Mock Joint 更新 | **MOCK VERIFIED**（command 返回 J1=10°） |
| 14 | Mock TCP 更新 | **IMPLEMENTED**（API 存在，VM 未逐项断言） |
| 15 | 3D 模型跟随 | **VM VERIFIED**（canvas 存在，关节轮询） |
| 16 | Joint Control 闭环 | **MOCK VERIFIED** |
| 17 | TCP Control 闭环 | **IMPLEMENTED** / **NOT TESTED** 逐项 |
| 18 | Keep TCP Fixed | **IMPLEMENTED**（mock 算法）/ **NOT TESTED** UI |
| 19 | 机械臂 Offline 不阻塞 | **IMPLEMENTED**（独立 poll + timeout） |
| 20 | 视觉 Offline 不阻塞 | **VM VERIFIED** |
| 21 | AGV Offline 不阻塞 | **VM VERIFIED** |

---

## 7. 未完成 / 风险

- 真实 Keyence 91：**HARDWARE BLOCKED**
- 真实 Pylon 长稳：**VM VERIFIED** 快照；长稳 **NOT TESTED**
- Leo 生产接口：**DEVELOPING**
- 真实臂 TCP Pose：**NOT AVAILABLE**（需 FK 或扩展节点）
- 真实臂运动：**BLOCKED**
- 3D 模型为简化 FK 占位，非 URDF

---

## 8. 部署

- **VM:** 172.31.0.111:19999 — **VM VERIFIED** V0.4.0
- **测试脚本:** `workspace_v02/tools/v04_vm_test.sh`
