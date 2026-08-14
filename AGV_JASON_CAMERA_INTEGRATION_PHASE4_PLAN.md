# Phase 4 Implementation Plan

> **阶段**：Phase 4 — Camera Adapter 最小实现（**Plan-only · v3 实机重审版**）  
> **日期**：2026-08-13  
> **原则**：**AGV Camera Contract 是 Source of Truth**；Jason 仅提供 ROS2 数据源  
> **本版变更**：Jason 到岗后重审；ICMP 层恢复；**本审计站 SSH/ROS 实机命令仍 BLOCKED**

---

## 0. 审计站访问矩阵（2026-08-13 本轮）

| 目标 | ICMP ping | SSH | ros2 只读命令 | 说明 |
|------|-----------|-----|---------------|------|
| `192.168.18.249` Jason VM | **OK**（0% loss, ~1ms） | **FAIL** Permission denied (publickey) | **BLOCKED** | 主机可达；本审计站无 SSH 凭据 |
| `192.168.18.251` Basler | **OK**（0% loss, ~2–5ms） | N/A | N/A | ICMP 恢复；**≠ Pylon/ROS 在线** |
| `192.168.18.240` AGV VM | **FAIL** timeout | **FAIL** timeout | **BLOCKED** | 本审计站不可达；249↔240 DDS **未测** |

**重要声明：**

- 「网络恢复 / ping OK」**≠ Real Camera Integration PASS**
- 「Jason 源码完整可读」**≠ 实机 topic 已确认**
- 本轮 **未执行** `ros2 topic echo/hz` 于 249/240（SSH 阻断）
- Jason 侧需 **在岗执行 J1–J12** 或 **授予本审计站 SSH**，方可闭合实机项

---

## 1. Jason 完整源码审计（`Jason.Chen/ros2_ws` · VM 备份路径）

审计路径：`/home/ubuntu/Pengfei.Hao/.../Jason.Chen/ros2_ws`（2695 files；与交接文档 `/home/ubuntu/ros2_ws` 结构一致）

### 1.1 Pylon driver

| 项 | 源码事实 | 证据 |
|----|----------|------|
| 包 | `pylon_ros2_camera_component` / `wrapper` / `interfaces` | package.xml |
| Launch | `pylon_ros2_camera.launch.py` | `namespace=camera_id` |
| **`camera_id` 默认** | **`my_camera`** | launch L91 |
| Node 名 | `pylon_ros2_camera_node` | launch L85 |
| **Topic 构造** | `/{camera_id}/pylon_ros2_camera_node/image_raw` | launch namespace + node 名 |
| | `/{camera_id}/pylon_ros2_camera_node/camera_info` | 同上 |
| **device_user_id** | `"106611-18"` | `aca2500_106611_18*.yaml` |
| 型号 | acA2500-14GC S/N 22297681 | yaml 注释 |
| IP in repo | **无** `192.168.18.251` | grep 0 |
| ROS_DOMAIN_ID in repo | **无** | grep src+scripts 0 |
| Deploy 默认 namespace | **`basler_106611_18`** | `deploy_and_run_camera_qr.sh` |
| Deploy 默认 config | **`aca2500_106611_18.yaml`**（非 tuned_v3） | deploy script |
| 交接 SOP config | `aca2500_106611_18.tuned_v3.yaml` | handover 文档 | **CONFLICT** deploy vs SOP |

### 1.2 QR detector

| 项 | 源码事实 | 证据 |
|----|----------|------|
| Node | `wechat_qr_node` | qrcode_node.py L98 |
| 订阅 | 参数 `image_topic`（launch 传入） | qrcode_node.py L196+ |
| Launch 默认 image | `/my_camera/pylon_ros2_camera_node/image_raw` | qrcode_detector.launch.py |
| Deploy 传入 image | `/$CAMERA_ID/pylon_ros2_camera_node/image_raw` | deploy script |
| 发布 | **`~/decoded_info` → `/wechat_qr_node/decoded_info`** | qrcode_node.py L189 |
| 类型 | `std_msgs/String` | import + publish |
| Payload | 纯文本 QR 内容 | `_decode_qr` → `str_msg.data` |
| 无码行为 | **不 publish**（仅 `if decoded_info:` 分支） | qrcode_node.py L391+ |
| 缓存 | **无持久缓存**（逐帧检测） | 源码无 last_qr 字段 |
| Timeout | **无识别 timeout 参数** | 无 declare_parameter timeout |
| 其他 QR topic | **无**（仅 decoded_info） | grep |

### 1.3 AprilTag（Phase 4 不接入）

| Topic | 类型 | 包 |
|-------|------|-----|
| `/apriltag/pose` | PoseStamped | apriltag_pose_reader |
| `/apriltag/transform` | TransformStamped | apriltag_pose_reader |

---

## 2. J1–J12 验证状态（Phase 2 假设重审）

| ID | Phase 2 假设 | 源码事实 | Jason 实机（本轮） | AGV 事实 | 最终结论 | 状态 |
|----|--------------|----------|-------------------|----------|----------|------|
| J1 ROS_DOMAIN_ID | AGV 默认 30；Jason 未知 | Jason repo **无配置** | **未测**（SSH BLOCKED） | docker/boot 默认 **30** | 运行时必须 echo 确认；AGV 侧文档 30 **非 Jason 确认** | **PENDING** |
| J2 RMW_IMPLEMENTATION | 未知 | build 默认 fastrtps_cpp | **未测** | 未测 | 编译默认 ≠ 运行时 env | **PENDING** |
| J3 Camera Node | `{ns}/pylon_ros2_camera_node` | 确认 node 名固定 | **未测** ros2 node list | N/A | 结构 CONFIRMED；实机 **PENDING** | **PENDING** |
| J4 image_raw topic | deploy→basler_106611_18 | launch 默认 my_camera | **未测** echo/hz | N/A | **CONFLICT** my_camera vs basler_106611_18 | **CONFLICT** |
| J5 camera_info topic | 同前缀 + /camera_info | 同上 | **未测** | N/A | 随 J4 namespace | **CONFLICT** |
| J6 QR topic | /wechat_qr_node/decoded_info | 源码 CONFIRMED | **未测** topic info | N/A | 结构 CONFIRMED；实机可达 **PENDING** | **PENDING** |
| J7 QR payload | String 文本 | 源码 CONFIRMED | **未测** echo --once | N/A | 格式 CONFIRMED；样例 **PENDING** | **PENDING** |
| J8 encoding | rgb8/bgr8 可能 | Pylon 原生；tuned_v3 binning 2×2 | **未测** echo --once | ingress 输出 rgb8 | 实机 encoding **PENDING** | **PENDING** |
| J9 FPS | ~8 fps yaml | tuned_v3 frame_rate 8.0 | **未测** hz | N/A | **PENDING** | **PENDING** |
| J10 Basler IP | 部署事实 251 | repo 无 IP | ping 251 **OK**（审计站） | devices 写 192.168.1.100（Xavier 路径） | ICMP 251 可达；**Pylon 绑定 IP 未 ROS 验证** | **PENDING** |
| J11 device_user_id | 106611-18 | yaml CONFIRMED | **未测** Pylon 只读 | N/A | 配置 CONFIRMED；实机 **PENDING** | **PENDING** |
| J12 namespace | basler_106611_18 vs my_camera | deploy vs launch **CONFLICT** | 验收日志曾用 `/basler_106611_18` | N/A | **CONFLICT** — Jason 必须确认生产值 | **CONFLICT** |

**历史实机证据（非本轮）：** `log/acceptance/apriltag_acceptance_20260812_151433.md` — namespace `/basler_106611_18`；**camera_stream FAIL**（30s 无 image_raw）。→ 曾尝试 basler_106611_18，但 **不等于当前在线 PASS**。

---

## 3. 249 ↔ 240 DDS 测试

| 步骤 | 结果 | 证据 |
|------|------|------|
| 249 ping 240 | **未测** | 249 SSH BLOCKED |
| 240 ping 249 | **未测** | 240 不可达 |
| 两侧 ROS_DOMAIN_ID 对比 | **未测** | — |
| 240 `ros2 topic list` 见 Jason topic | **未测** | — |
| 240 `ros2 topic echo <Jason image>` | **未测** | — |

**结论：`249 ↔ 240 DDS` = `BLOCKED`（本审计站）**

可能子状态（均未发生）：`PASS` / `PARTIAL` / `DDS_DISCOVERY_OK_BUT_DATA_PATH_FAILED` / `FAIL`

**Jason 在岗需执行（闭合 DDS）：**

```bash
# 249 上
echo ROS_DOMAIN_ID=$ROS_DOMAIN_ID RMW=$RMW_IMPLEMENTATION
ros2 topic list | grep basler

# 240 上（AGV 容器内，同 Domain）
export ROS_DOMAIN_ID=<与249一致>
ros2 topic info -v <J4确认的实际image topic>
ros2 topic echo <J4确认的实际image topic> --once
# 仅记录 encoding/width/height/step/frame_id，勿 dump payload
```

---

## 4. AGV Authority Map（当前运行态 · 源码）

> **数据源**：VM `192.168.18.240` 实读（2026-08-13 早先 SSH）+ 本地 `_audit_extract`（**可能落后于 VM**）  
> **adapter 未实现**：以下「未来 adapter」为 Plan 设计，**非当前运行**

### 4.1 默认 `boot_gazebo_lite.sh`（`CAM_FRONT_SOURCE=ros2`）

| 资源 | 当前 Publisher / Server | 备注 |
|------|-------------------------|------|
| `/camera/cam_front/image_raw` | **`camera_ingress_node`**（等 Xavier compressed） | Jason 路径 **不适用** |
| `/camera/cam_left/right/image_raw` | **`gz_physics_proxy`** | 仿真合成 |
| `/camera/cam_front/info` | **`camera_ingress_node`** | |
| `/camera/cam_left/right/info` | **`camera_gazebo_qr`** | |
| `camera/cam_front/qr` | **`camera_gazebo_qr`**（假 STATION_LM2） | **REAL 污染风险** |
| `camera/cam_left/right/qr` | **`camera_gazebo_qr`** | 仿真 |
| `camera/detect_qr` | **`camera_gazebo_qr`**（lite boot 唯一 server） | sim_all 另可冲突 |
| `camera/status` | **无**（待 adapter） | VM dashboard **SUB** L447 |
| `camera/mask_cmd` | **Dashboard PUB** L449 | adapter 待 SUB |
| `camera/mode_cmd` | **无** | dashboard 待 PUB |
| `camera_adapter_node` | **不存在** | setup.py 已注册 entry |

### 4.2 Adapter 启动后预期冲突（设计态）

| 冲突 | 条件 | 最小解决（优先顺序） |
|------|------|----------------------|
| `cam_front/image_raw` 双 PUB | adapter + ingress 同启 | **互斥启动**（独立 launch 或 boot 分支） |
| `cam_front/qr` 假数据 | adapter + camera_gazebo_qr | **启动层**不启 gazebo_qr（Jason REAL profile）或 skip cam_front |
| `camera/detect_qr` 双 Server | adapter + camera_gazebo_qr | **启动层** Jason REAL 时不启 camera_gazebo_qr；或 adapter 独占 profile |
| REAL + STATION_LM2 | 当前 lite boot 默认 | Jason REAL 会话 **不得** 与默认 lite boot 同 graph 无隔离 |

### 4.3 `camera_gazebo_qr.py` 例外重评估（v3）

| 问题 | 当前答案 |
|------|----------|
| A. adapter 是否注册 detect_qr？ | **否**（文件不存在） |
| B. camera_gazebo_qr 是否注册？ | **是**（lite boot 始终启） |
| C. 同时启动是否冲突？ | **未来会**（adapter 实现后） |
| D. 是否 pub cam_front QR？ | **是**（`_tick` L96–98，假 AprilTag） |
| E. REAL 污染？ | **是**（若同 graph） |
| F. launch 不启 camera_gazebo_qr 可解？ | **是**（Jason REAL 专用 profile） |
| G. 比改源码更小？ | **对 Jason-only 联调是**；**代价** lose cam_left/right sim QR |

**v3 决策：**

- **Phase 4 首选不改 `camera_gazebo_qr.py`**
- Jason REAL 联调使用 **独立 launch profile**（`camera_adapter.launch.py`），**不并行** `boot_gazebo_lite.sh` 默认栈
- 若必须 Dev 容器内共存，再评估 boot 条件跳过 `camera_gazebo_qr` 或 **后提** `skip_qr_cameras` 参数（SCOPE CHANGE REQUIRED）

---

## 5. Boot 方案（v3）

| 方案 | 说明 | v3 推荐 |
|------|------|---------|
| **A 独立 launch** | `ros2 launch camera_bridge camera_adapter.launch.py` | **首选** — 不改 boot；Jason REAL 与 sim 栈隔离 |
| **B boot 扩展** | `CAM_FRONT_SOURCE=jason` 分支 | **OPTIONAL** — 仅当必须一键 Dev 容器内集成 |

**`mode=simulation|real` 不能替代 source 路由**；mode 经 `camera/mode_cmd` 进 adapter。

---

## 6. Phase 4 冻结范围（不变）

**做：** cam_front · image · camera_info · QR · heartbeat · status · mask · mode · DetectQr

**不做：** AprilTag · cam_left/right Jason · Pylon/Jason driver 修改 · AGV 控制器/IP · 新增 msg/srv · Dashboard 重构 · CameraCapture

---

## 7. 文件修改清单（STEP 4 · 待批准）

### MUST

| 文件 | 操作 |
|------|------|
| `camera_bridge/camera_bridge/camera_adapter_node.py` | 新增 |
| `camera_bridge/config/jason_basler.yaml` | 新增（**topic 必须 param 化；J4/J12 确认前留空/占位**） |
| `camera_bridge/launch/camera_adapter.launch.py` | 新增 |
| `delivery_web/.../dashboard_node.py` | **最小**：`camera/mode_cmd` publish in `set_env()` |
| `delivery_bringup/config/devices.yaml` | **最小**：jason 占位 + 注释 |
| `AGV_JASON_CAMERA_INTEGRATION_PROGRESS.md` | 留痕 |

### OPTIONAL

| 文件 | 操作 | 条件 |
|------|------|------|
| `boot_gazebo_lite.sh` | 条件分支 | 仅当拒绝独立 launch 且需容器内一键启 |
| `camera_gazebo_qr.py` | skip 参数 | **SCOPE CHANGE REQUIRED** — 仅当 launch 隔离不足 |

### DO NOT TOUCH

Jason Pylon/QR driver · `delivery_interfaces` · AGV 控制器/IP · Web UI 重构 · `camera_ingress_node` 重写

---

## 8. Adapter 配置（J4/J12 确认前）

```yaml
# jason_basler.yaml — 占位符；实机值由 Jason 执行 J1–J12 后填入 launch 参数
camera_adapter_node:
  ros__parameters:
    logical_name: cam_front
    device_user_id: ""           # J11 PENDING
    ip: ""                       # J10 diagnostic only
    pylon_namespace: ""          # J12 CONFLICT — 禁止写死
    image_topic: ""              # J4 — 空则 WARN + CAMERA_UNAVAILABLE
    camera_info_topic: ""
    qr_topic: "/wechat_qr_node/decoded_info"
    frame_timeout_sec: 2.0
    recognition_timeout_sec: 3.0
    default_mode: simulation
```

**候选值（非生产确定）：**

- deploy 脚本：`/basler_106611_18/pylon_ros2_camera_node/image_raw`
- launch 默认：`/my_camera/pylon_ros2_camera_node/image_raw`

→ **Jason 必须在岗确认 J12 后，方可写入生产 launch 参数。**

---

## 9. Real / Simulation 边界（不变）

| Mode | Jason 在线 | Jason 离线 |
|------|------------|------------|
| **real** | 转发；source=basler_pylon | CAMERA_UNAVAILABLE；**禁止 sim fallback** |
| **simulation** | 优先 Jason | 允许 simulation source；**禁止伪装 basler_pylon** |

---

## 10. 测试计划

| ID | 内容 | 本轮 | STEP 4 后 |
|----|------|------|-----------|
| T0–T1 | syntax / build | 未执行 | 可执行 |
| T2 | 无 Jason → UNAVAILABLE | 未执行 | 可执行 |
| T3–T6 | fixture / mask / mode / DetectQr | 未执行 | 可执行 |
| J1–J12 | Jason 实机命令 | **BLOCKED**（本审计站 SSH） | Jason 在岗执行 |
| DDS | 249↔240 echo | **BLOCKED** | 需 240 可达 + 同 Domain |
| Real Integration PASS | 全链路 | **禁止宣称** | Adapter+Web+真实帧后 |

---

## 11. 风险（v3）

| 风险 | 级别 | 缓解 |
|------|------|------|
| J4/J12 namespace CONFLICT | **高** | Jason 确认；adapter 全 param 化 |
| 本审计站无法 SSH 249/240 | **高** | Jason 在岗跑 J1–J12；结果回填 Plan |
| DDS 未测 | **高** | 240 恢复后 echo 验证 |
| 2026-08-12 acceptance FAIL 历史 | **中** | 实机 hz/echo 重新验收 |
| deploy vs tuned_v3 config | **中** | Jason 确认生产 config |
| lite boot 假 QR 污染 REAL | **高** | 独立 launch 隔离 |
| 本地 `_audit_extract` 落后于 VM | **中** | 以 VM 240 源码为准 |

---

## 12. STEP 4 开始条件

| 条件 | 状态 |
|------|------|
| Plan v3 用户批准 | 待批准 |
| Jason J4/J12 实机确认 | **NOT DONE** — CONFLICT 未解 |
| 249↔240 DDS echo | **NOT DONE** — BLOCKED |
| AGV adapter 源码骨架 | **可开始**（param 化、无写死 topic） |
| Real Integration PASS | **NOT READY** |

### 结论

**STEP 4 代码实现：NOT READY**

**原因：**

1. J4/J12 **CONFLICT**（`my_camera` vs `basler_106611_18`）无实机 `ros2 topic list` 闭合  
2. 249↔240 DDS **未验证**（240 本审计站不可达）  
3. J1/J2/J8/J9 实机 **PENDING**  
4. 在 namespace 未确认前写入 yaml 默认值会重复 v1 Plan 错误  

**可并行准备（Jason 确认前）：**

- adapter 框架 + param 加载 + REAL/SIM 状态机 + 错误码  
- **禁止**在 yaml 写死生产 topic/IP/domain  

**Jason 在岗最小闭合清单（闭合后可转 READY）：**

1. 执行 J1–J12，回填本文 §2  
2. 确认 J12 生产 namespace  
3. 240 容器内 `ros2 topic echo` Jason image **一次**（记录 metadata only）  
4. 回填 DDS 结果为 PASS 或 PARTIAL/FAIL  

---

## 13. 暂停点

**Plan v3 完成；零业务代码修改。**

等待：

1. Jason 执行 J1–J12 并回填结果（或授予 SSH）  
2. 240 网络/SSH 恢复后 DDS 实测  
3. 用户批准 STEP 4  

---

*Plan 版本：Phase4-Plan-v3 · 2026-08-13 · Jason 到岗实机重审（审计站 SSH BLOCKED）*
