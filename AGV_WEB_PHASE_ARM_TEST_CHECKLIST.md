# AGV Web 机械臂现场测试检查表

**版本:** V0.4  
**日期:** 2026-08-14  
**适用人员:** 现场机械臂操作员 + 开发人员

---

## 测试前检查

- [ ] ROS_DOMAIN_ID = **30**（所有终端、NUC、VM）
- [ ] xArm7 控制器 172.31.0.123 可 ping
- [ ] `pick_place_node` 启动命令含 **`auto_start:=false`**
- [ ] AGV 已停稳 **≥3 秒**，无导航运动
- [ ] 现场急停可用
- [ ] Web: http://172.31.0.111:19999/ 显示 **v0.4**
- [ ] **已获得负责人「开始真实机械臂运动测试」书面/口头授权**

---

## Phase A — 只读状态（无需运动授权）

| # | 步骤 | 期望 | 结果 | 测试人/时间 |
|---|------|------|------|-------------|
| A1 | Web 切 **REAL (read-only)** | 模式显示 REAL，无自动运动 | ☐ PASS ☐ FAIL | |
| A2 | 观察 Joint 1–6 | 与 `ros2 topic echo /joint_states` 一致（±1°） | ☐ PASS ☐ FAIL | |
| A3 | 观察 Motion 状态 | IDLE/MOVING 与 `/pick_place_state` 文本一致 | ☐ PASS ☐ FAIL | |
| A4 | 手动转动臂（慢） | Web Joint 数值跟随更新 | ☐ PASS ☐ FAIL | |
| A5 | 断开 pick_place_node | Web 显示 OFFLINE，**页面不卡死** | ☐ PASS ☐ FAIL | |

---

## Phase B — 仿真闭环（VM / Mock，无真实臂）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| B1 | Mock 模式 + J1 **+** | J1 增加，3D canvas 变化 | ☐ PASS ☐ FAIL |
| B2 | TCP Z **+** | TCP Z 变化 | ☐ PASS ☐ FAIL |
| B3 | ☑ Keep TCP Fixed + J2 **+** | TCP 变化小于未勾选时 | ☐ PASS ☐ FAIL |
| B4 | Stop | motion → IDLE | ☐ PASS ☐ FAIL |

---

## Phase C — 视觉触发（Mock / 实机）

| # | 步骤 | 期望 | 结果 |
|---|------|------|------|
| C1 | **触发扫码** (91) | 返回 QR 或 NOT_FOUND；UI 更新 | ☐ PASS ☐ FAIL |
| C2 | **触发二维码** (88) | 2–3s 内返回或 NOT_FOUND | ☐ PASS ☐ FAIL |
| C3 | **触发 AprilTag** (88) | tag_id + pose 或 NOT_FOUND | ☐ PASS ☐ FAIL |
| C4 | **触发人脸识别** Leo | DEVELOPMENT / NOT_AVAILABLE | ☐ PASS ☐ FAIL |

---

## Phase D — 真实运动（**仅授权后**）

| # | 步骤 | 命令/操作 | 安全注意 | 结果 |
|---|------|-----------|----------|------|
| D1 | 解锁归位 | `/unlock_and_home` | ~15s 阻塞；臂会运动 | ☐ PASS ☐ FAIL ☐ SKIP |
| D2 | 单次取放 | `/do_pick_place` | ~63s；AGV 必须静止 | ☐ PASS ☐ FAIL ☐ SKIP |
| D3 | 夹爪开/关 | `/set_gripper` | 确认无夹手 | ☐ PASS ☐ FAIL ☐ SKIP |
| D4 | Web move_joint | POST /api/arm/command | **当前应 BLOCKED** | ☐ BLOCKED 符合预期 |
| D5 | 急停 | 现场急停按钮 | 立即停止 | ☐ PASS ☐ FAIL |

---

## 签字

| 角色 | 姓名 | 日期 | 备注 |
|------|------|------|------|
| 现场操作 | | | |
| 开发 | | | |
| 负责人 | | | |

---

## 结果归档

- 通过项标注: MOCK VERIFIED / VM VERIFIED / HARDWARE VERIFIED
- 未测项标注: NOT TESTED
- 禁止标注 CODE VERIFIED 代替实测
