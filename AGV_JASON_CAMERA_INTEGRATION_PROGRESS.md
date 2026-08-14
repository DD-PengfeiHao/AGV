# AGV × Jason 工业相机集成 — 进度留痕

> 与 `AGV_JASON_CAMERA_INTEGRATION_AUDIT.md`（Phase 1，勿覆盖）配合使用。  
> 本文件只追加阶段记录，不删除历史。

---

## 记录格式说明

| 字段 | 含义 |
|------|------|
| Phase | 阶段编号 |
| 检查内容 | 做了什么 |
| 发现 | 关键事实 |
| 修改文件 | 改动的路径（无则写「无」） |
| 测试 | 命令与结果 |
| 限制 | 当前无法验证的内容 |

---

## 2026-08-13 — Phase 1（只读审计）

| 项 | 内容 |
|----|------|
| **Phase** | 1 — 项目审计 |
| **检查内容** | AGV workspace_v02、Jason.Chen/ros2_ws、网络 ping、ROS2 运行态 |
| **发现** | Jason=Basler Pylon；AGV adapter 缺失；251/249 不可达；接口不对齐 |
| **修改文件** | 新增 `AGV_JASON_CAMERA_INTEGRATION_AUDIT.md` |
| **测试** | VM SSH 实测 ping、docker ros2 node list |
| **限制** | 无真实取图/QR；Jason Domain 未查（Phase 2 补查） |
| **测试结果声明** | **非 Real PASS** |

---

## 2026-08-13 — Phase 2（设计-only）

| 项 | 内容 |
|----|------|
| **Phase** | 2 — Camera Adapter 设计 |
| **检查内容** | 复核审计报告；读 VM 上 `camera_bridge`、`camera_ingress_node`、`delivery_interfaces`、`dashboard_node` camera/mask/mode；Jason Domain grep；251/249 ping 复测 |
| **发现** | ① `camera_adapter_node.py` 仍缺失（setup.py 已注册） ② Jason 仓库 **无 ROS_DOMAIN_ID 配置** ③ Dashboard **已实现** mask/status API，缺 adapter 数据源 ④ `set_env` 有 `adapter_mode` 但未 publish 到 ROS ⑤ Jason grep **无 192.168.18.251** ⑥ 251/249 **仍 ping/SSH 失败** ⑦ `delivery_interfaces` 现有 Camera/QR 类型足够，**无需新增 msg/srv** |
| **修改文件** | 新增 `AGV_JASON_CAMERA_INTEGRATION_PHASE2_DESIGN.md`；新增本 PROGRESS 文件 |
| **测试命令** | `ping 192.168.18.251`；`ping 192.168.18.249`；VM grep ROS_DOMAIN_ID |
| **测试结果** | cam251_FAIL；jason249_FAIL；Jason domain grep 空 |
| **限制** | 跨 VM DDS 清单仅静态设计；Real Camera/QR/Recognition **均未验证** |
| **测试结果声明** | 本阶段输出为 **设计文档 only**，**非 Real PASS**，**非联调 PASS** |

### Phase 2 源码复核文件清单

| 文件 | 路径（VM） |
|------|------------|
| setup 注册 | `.../camera_bridge/setup.py` |
| ingress | `.../camera_bridge/camera_bridge/camera_ingress_node.py` |
| devices | `.../delivery_bringup/config/devices.yaml` |
| interfaces | `.../delivery_interfaces/msg/*.msg`, `srv/*.srv` |
| dashboard | `.../delivery_web/delivery_web/dashboard_node.py` |
| Jason QR | `Jason.Chen/ros2_ws/src/qrcode_detector/...` |
| Jason Pylon launch | `Jason.Chen/ros2_ws/src/pylon_ros2_camera_wrapper/launch/...` |

### 未验证项（等设备/网络恢复）

- [ ] Jason VM 实际 `ROS_DOMAIN_ID`
- [ ] 相机 251 Pylon 连接
- [ ] `ros2 topic hz .../image_raw`
- [ ] `/wechat_qr_node/decoded_info` 真实 payload
- [ ] 跨 VM DDS discovery（240 ↔ 249）
- [ ] Adapter 端到端（Phase 4 后）

---

## 2026-08-13 — Phase 4 Plan v1（源码审计 + 计划，未改代码）

| 项 | 内容 |
|----|------|
| **Phase** | 4 — Implementation Plan v1（STEP 1–2） |
| **检查内容** | VM 复核 camera_bridge、devices.yaml、boot_gazebo_lite、dashboard、仿真冲突 |
| **发现** | adapter 缺失；mode_cmd 缺失；gazebo 假 QR 冲突 |
| **修改文件** | 新增 `AGV_JASON_CAMERA_INTEGRATION_PHASE4_PLAN.md` v1 |
| **测试** | 未执行 |
| **限制** | Real BLOCKED |

---

## 2026-08-13 — Phase 4 Plan v2 校核（Jason 备份 + 用户约束，未改业务代码）

| 项 | 内容 |
|----|------|
| **Phase** | 4 — Plan v2 校核（STEP 1–5） |
| **模型/模式** | cursor-grok-4.5-high-fast · **Plan only** |
| **新增审计源** | VM Jason 备份 `Jason.Chen/ros2_ws`；Jason 交接文档对照 |
| **硬件复测** | 251 FAIL · 249 FAIL（VM ping 2026-08-13） |
| **Plan v1 问题修正** | ① 不再把 `basler_106611_18`/251 当确定事实 → PENDING ② Adapter 不硬编码 domain/IP ③ `CAM_FRONT_SOURCE=jason` 降为可选；Phase 4 首选 **独立 launch** ④ 新增 **JASON CONFIRMATION REQUIRED J1–J12** |
| **Jason 备份确认** | deploy 默认 `basler_106611_18`；launch 默认 `my_camera`；QR=`/wechat_qr_node/decoded_info` String；device_user_id YAML=`106611-18`；**无 ROS_DOMAIN_ID 配置** |
| **VM AGV 确认** | dashboard 已有 status/mask；**mode_cmd 仍 0 命中**；boot `CAM_FRONT_SOURCE=ros2\|xavier\|mjpeg` 无 jason |
| **修改文件** | 更新 `AGV_JASON_CAMERA_INTEGRATION_PHASE4_PLAN.md` → **v2**；本 PROGRESS 条目 |
| **业务代码** | **零修改**（禁止 stub） |
| **测试** | 未执行 |
| **STEP 4 条件** | AGV 侧最小实现 **可准备**；Real 联调 **不可** |

### Jason 待确认（摘要）

J1 Domain · J2 RMW · J3 Node · J4 image topic · J5 camera_info · J6 QR topic · J7 QR payload · J8 encoding · J9 FPS · J10 Basler IP · J11 device_user_id · J12 namespace

→ 详见 `AGV_JASON_CAMERA_INTEGRATION_PHASE4_PLAN.md` §5

---

## 2026-08-13 — Phase 4 Plan v3 实机重审（Jason 到岗；零业务代码修改）

| 项 | 内容 |
|----|------|
| **Phase** | 4 — Plan v3 实机重审 + Jason 完整源码审计 |
| **事件** | Jason 已到岗；用户报告 249/251 网络恢复 |
| **ICMP（本审计站）** | 249 **OK** · 251 **OK** · 240 **FAIL** |
| **SSH/ROS（本审计站）** | 249 Permission denied · 240 timeout → **J1–J12 ros2 命令 BLOCKED** |
| **Jason 源码** | 完整审计 pylon/qrcode/apriltag/deploy/handover |
| **J4/J12** | **CONFLICT** — launch `my_camera` vs deploy `basler_106611_18` |
| **249↔240 DDS** | **BLOCKED** |
| **camera_gazebo_qr 例外** | v3 **不默认批准** — 优先独立 launch 隔离 |
| **修改文件** | `AGV_JASON_CAMERA_INTEGRATION_PHASE4_PLAN.md` → **v3** |
| **声明** | ping OK **≠ Real PASS** |

---

## 下一阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| 4 Plan v3 | 实机重审完成 | 待 Jason J1–J12 回填 + 用户批准 |
| 4 实现 | adapter + launch + mode_cmd | **NOT READY** |
| Real 联调 | R1–R7 | **NOT READY** |

---

*最后更新：2026-08-13*
