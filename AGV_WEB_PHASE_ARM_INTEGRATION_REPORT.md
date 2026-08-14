# AGV Web 机械臂集成报告（Phase Arm / V0.4）

**日期:** 2026-08-14  
**版本:** V0.4.0

---

## 1. 机械臂软件架构

```
Web (index.html)
    ↓ HTTP
dashboard_node.py
    ↓
ArmManager (delivery_web/arm/manager.py)
    ↓
create_arm_adapter(mode)
    ├── MockArmAdapter  (simulation — 默认)
    └── RealArmAdapter  (read-only — /joint_states + /pick_place_state)
            ↓ ROS2 Domain 30
    pick_place_node.py @ NUC/v43
            ↓ xArm SDK
    xArm7 @ 172.31.0.123
```

---

## 2. 通信方式

| 层级 | 协议 |
|------|------|
| Web ↔ Dashboard | HTTP JSON |
| Dashboard ↔ 真实臂 | ROS2 Topics（只读） |
| pick_place_node ↔ 臂 | xArm SDK TCP + Modbus:502 |

---

## 3. ROS2 接口（真实）

| 类型 | 名称 | 说明 |
|------|------|------|
| Service | `/unlock_and_home` | Trigger，~15s 阻塞 |
| Service | `/do_pick_place` | Trigger，完整取放循环 |
| Service | `/set_gripper` | SetBool |
| Topic | `/pick_place_state` | **纯文本**状态 |
| Topic | `/joint_states` | 7 关节弧度 |

**无:** `/tcp_pose`, `move_joint`, `move_tcp` 服务

---

## 4. SDK 接口

- `xarm-python-sdk` 在 `pick_place_node` 内部调用
- Web **不直连 SDK**；运动必须通过 ROS2 Service（当前 Web **未接入**）

---

## 5. Joint State 来源

| 模式 | 来源 |
|------|------|
| Simulation | `MockArmAdapter` 内存状态 |
| Real | 订阅 `/joint_states`，转 degrees |

---

## 6. TCP Pose 来源

| 模式 | 来源 |
|------|------|
| Simulation | `_fk_tcp_deg()` 轻量占位 FK |
| Real | **不可用** — `RealArmAdapter` 返回零/空 TCP |

---

## 7. 控制接口

### Web API

```json
POST /api/arm/command
{ "kind": "move_joint", "joint_index": 0, "delta_deg": 5, "keep_tcp_fixed": false }
POST /api/arm/command
{ "kind": "move_tcp", "tcp_axis": "z", "delta_mm": 5 }
POST /api/arm/mode
{ "mode": "simulation" | "real" }
```

### 真实臂

所有 `move_*` / `stop` / `enable` / `disable` → **`blocked: true`**

环境变量 `ARM_REAL_MOTION=1` 仍返回 blocked（等待现场授权流程）

---

## 8. 安全机制

| 机制 | 实现 |
|------|------|
| 默认 SIMULATION | `ARM_MODE=simulation` |
| Real 切换确认 | Web confirm 对话框 |
| 运动权限 | `check_motion_allowed()` + `ArmSafetyLimits` |
| 真实运动门控 | `ARM_REAL_MOTION` + 用户授权 |
| 复用现场安全 | pick_place_node `arm_lock` — **不重复实现冲突控制** |

---

## 9. Web Adapter 设计

- DTO: `ArmState`, `JointState`, `TcpPose`, `GripperState`, `ArmError`, `ArmCommand`, `ArmMode`
- 缓存: `_arm_cache` 定时刷新，HTTP 不阻塞
- 超时: 前端 `FETCH_TIMEOUT_MS=5000`

---

## 10. Mock 测试结果

**环境:** VM 172.31.0.111，Mock 模式  
**状态:** **MOCK VERIFIED**

| 操作 | 结果 |
|------|------|
| GET /api/arm/status | online=true, mode=simulation |
| move_joint J1 +10° | success, J1=10.0 in response state |
| floor/wrist/leo triggers | 见审计报告 |

---

## 11. VM 测试结果

**状态:** **VM VERIFIED**

- 页面标题 `AGV Console v0.4`
- Robot Arm ONLINE，Joint 面板，仿真控制 J1–J6
- `/api/version` → 0.4.0

---

## 12. 真实机械臂测试准备条件

1. `pick_place_node` 以 `auto_start:=false` 启动
2. ROS_DOMAIN_ID=30 全网一致
3. `delivery_gazebo_soft` 可收到 `/joint_states`
4. 现场人员就位
5. 用户明确发出 **「开始真实机械臂运动测试」**

---

## 13. 现场测试步骤（概要）

1. 只读：Web 切 REAL，确认 Joint 与 `/joint_states` 一致
2. 确认 TCP 显示为 N/A 或 FK 扩展后再显示
3. 授权后：单次 `/unlock_and_home`（需现场确认 AGV 已停稳 ≥3s）
4. 授权后：`/do_pick_place` 单次循环
5. 急停与 `/set_gripper` 由现场人员操作

详见 `AGV_WEB_PHASE_ARM_TEST_CHECKLIST.md`

---

## 14. 风险点

| 风险 | 级别 |
|------|------|
| `/pick_place_state` 非 JSON 解析错误 | 中 |
| `/do_pick_place` 排队阻塞非拒绝 | 高 |
| 夹爪失败仍可能 success=true | 高 |
| AGV 未停稳调用 Service | 高 |
| Web 误开 REAL MOTION | 高 — 当前已 BLOCKED |

---

## 15. 未完成项

| 项 | 状态 |
|----|------|
| 真实臂 TCP Pose | NOT AVAILABLE |
| URDF + robot_state_publisher Web 3D | NOT IMPLEMENTED |
| TCP Drag / IK | Simulation 占位 only |
| Level 3 真实控制 | **BLOCKED** |
| 视觉→臂业务联动 | IMPLEMENTED 数据通路，逻辑 **NOT TESTED** |

---

## 状态总表

| 能力 | Mock | VM | 真实硬件 |
|------|------|-----|----------|
| 状态读取 | MOCK VERIFIED | VM VERIFIED | NOT TESTED |
| Joint 控制 | MOCK VERIFIED | MOCK VERIFIED | **BLOCKED** |
| TCP 控制 | IMPLEMENTED | NOT TESTED | **BLOCKED** |
| 取放序列 | N/A | N/A | **BLOCKED** |

**绝不能写「机械臂控制完成」— 真实运动未测试。**
