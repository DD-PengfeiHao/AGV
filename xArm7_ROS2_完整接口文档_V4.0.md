# xArm7 ROS2 抓取节点 完整接口文档 V4.0

**版本**：V4.0（代码一致性核查版 + AGV 顶板钣金安装版）
**日期**：2026-08-13
**架构**：方案 C 混合架构（SDK 直连运动 + ROS2 Service/Topic 对外接口）
**安装方式**：**xArm7 机械臂固定在 AGV 顶板钣金上**（5 个取放位姿相对 AGV 车体固定）
**ROS_DOMAIN_ID**：**30**（所有终端、跨机器必须一致）
**代码基准**：`pick_place_node.py`（2026-08-13 实机跑通版，机器人IP 172.31.0.123）

---

## ⚠️ V4.0 核心修正通告（AGV 总控必读！）

以下是 V3.0 文档描述与 `pick_place_node.py` **实际代码不一致**的 5 处重大修正。**AGV 总控请以 V4.0 为准，不要按 V3.0 写调用逻辑！**

| # | 接口项 | V3.0 文档描述（错误） | V4.0 代码实际行为（正确） | 风险级别 |
|---|--------|----------------------|-------------------------|---------|
| 1 | `/pick_place_state` 消息格式 | JSON 字符串（如 `{"block":1,...}`） | **纯文本字符串**（如 `[Studio B01] -> A_UP spd=5`） | 🔴 致命 |
| 2 | `/do_pick_place` 并发行为 | **拒绝**并发（返回 ERR_BUSY） | **排队阻塞等待**（第二个 call 会等第一个执行完再执行，不会拒绝） | 🟠 严重 |
| 3 | `/do_pick_place` 夹爪失败处理 | 夹爪失败 → 中断循环 → 返回 `success=false` + `ERR_GRIP_XXX` | **夹爪失败被完全忽略！** `gripper()` 返回值未检查，循环走完照样返回 `success=true` | 🔴 致命 |
| 4 | Service 错误 message 格式 | 有 `ERR_XXX:` 前缀（如 `ERR_CONNECT` / `ERR_GRIP_B4_CLOSE_FAIL`） | **无统一前缀**！连接失败返回 `"Arm not connected"`，异常返回 `"Error: {Python异常内容}"` | 🟠 严重 |
| 5 | `cycles` 参数读取时机 | 启动时只读一次（declare_parameter） | **每次 call `/do_pick_place` 时动态读取** `get_parameter('cycles').value`（支持运行时 `ros2 param set` 立即生效） | 🟡 中等 |

> **说明**：以上 5 点我是逐行对照 [pick_place_node.py](file:///c:/Users/Administrator/AppData/Roaming/TRAE%20SOLO%20CN/ModularData/ai-agent/work-mode-projects/6a7478337b9f26490bb74576/xarm7_simulation/share/xarm_pick_place/xarm_pick_place/pick_place_node.py) 代码核实的。如果 AGV 总控已经按 V3.0 写了调用逻辑，**需要立即改！**

---

## 目录

1. 系统架构与安装方式（AGV 顶板钣金固定）
2. 环境前提与启动模式
3. ROS2 对外接口完整契约（严格对齐代码！）
   - 3.1 Service：`/unlock_and_home`
   - 3.2 Service：`/do_pick_place`
   - 3.3 Service：`/set_gripper`
   - 3.4 Topic：`/pick_place_state`（**纯文本格式，非JSON！**）
   - 3.5 Topic：`/joint_states`
   - 3.6 ROS2 参数完整规格
4. 代码-文档一致性核查结果（已核 / 待改 / 风险）
5. AGV 顶板钣金安装的控制影响分析
6. 错误状态与异常处理（严格按代码返回）
7. 取/放分离与接口升级路线
8. AGV 联动时序与状态机
9. 位置坐标与运动耗时
10. 黄金窗口解锁详细说明
11. 夹爪控制详细规格
12. Web 端集成接口设计
13. 安全边界与维护信息
14. 测试验收标准
15. **Zack 待办事项清单（需实机配合）**
16. 附录：Studio 11 块时序与速查卡

---

## 一、系统架构与安装方式

### 1.1 物理安装（AGV 顶板钣金固定）

```
┌──────────────────────────────────────────────────────────────────────┐
│ AGV 车体（移动平台）                                                  │
│                                                                      │
│  ┌────────────────────────────────┐                                   │
│  │ AGV 总控（Dashboard/导航/调度）│  ← ROS2 主控制器                  │
│  └───┬────────────────────────────┘                                   │
│      │ ROS2 Domain ID = 30 (同一 DDS 域通信)                          │
│      │                                                                 │
│  ┌───▼────────────────────────────┐     ┌─────────────────────────┐   │
│  │ xarm_pick_place ROS2 Node      │     │ xArm7 控制器             │   │
│  │  节点名: /pick_place_server    ├────►│ IP: 172.31.0.123         │   │
│  │  Services (3个)                │xArm │ · 运动控制: xArm 私有 TCP │   │
│  │  Topics (2个)                  │SDK  │ · 夹爪控制: Modbus TCP 502│   │
│  └────────────────────────────────┘◄────┤  state/error/angles     │   │
│                                          └───────────┬─────────────┘   │
│                                                      │ 信号线缆         │
│  ┌───────────────────────────────────────────────────▼───────────────┐ │
│  │  ⚠️ xArm7 机械臂（**硬固定在AGV顶板钣金！**）                      │ │
│  │    · 机械臂底座 ←→ AGV 车体：**刚性固定，无相对运动**              │ │
│  │    · 5个取放位姿(A_UP/A_DN/MID/B_UP/B_DN)：**相对AGV车体固定**    │ │
│  │    · 即：AGV 导航到哪里，机械臂工作区就跟到哪里                    │ │
│  │    · 夹爪：电磁阀夹爪，DO 通道 = Modbus 线圈地址 8                │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.2 安装方式对控制的关键影响

| 影响项 | 说明 | AGV 总控注意事项 |
|--------|------|-----------------|
| **AGV 运动时禁止机械臂运动** | AGV 加速/减速/转弯时，机械臂悬臂会产生惯性摆动 | AGV 必须**先停稳 → 延迟 ≥2s → 再调机械臂 Service** |
| **AGV 停稳后残余摆振** | 顶板钣金有弹性，AGV 刹停后机械臂末端会有 1~3s 摆振 | 建议延迟 **≥3s**（不是文档建议的2s）再启动抓取，否则 A_DN 抓取偏差可能超标 |
| **AGV 负载变化** | 夹爪抓取后，AGV 负载增加几公斤（物体重量 + 机械臂姿态变化的重心偏移） | 对 AGV 导航影响较小；[需Zack确认] 抓取后 AGV 导航参数是否要调整？ |
| **A/B 点位是 AGV 坐标系** | A_UP 等 5 个点位是**相对机械臂底座**定义的，底座在 AGV 上 → 即相对 AGV 固定 | AGV 必须在地图上定义"机械臂工位"，停靠精度建议 **≤ ±5mm（XYZ）+ ±0.5°（航向）**，否则机械臂可能够不到料台 |
| **碰撞安全** | 机械臂工作范围固定在 AGV 顶板周围 | AGV 路径规划需避开机械臂可能碰撞的工位高度障碍物；[需Zack配合] 需在 AGV 地图上定义机械臂展开禁区 |

---

## 二、环境前提与启动模式

### 2.1 环境确认表

| 项 | 已知值 / 代码值 | 状态 | 说明 |
|----|----------------|------|------|
| 机械臂型号 | UFACTORY xArm7 | ✅ 已知 | |
| 机械臂安装 | 固定在 AGV 顶板钣金（相对位置不变） | ✅ 已知 | |
| 控制器 IP | 172.31.0.123 | ✅ 已知 | 代码 declare_parameter 默认值 |
| Modbus TCP | 172.31.0.123:502 | ✅ 已知 | 夹爪控制 |
| ROS2 工作空间 | `~/ros2_ws` | ✅ 已知 | |
| ROS2 包名 | `xarm_pick_place` | ✅ 已知 | |
| ROS_DOMAIN_ID | **30（必须一致！）** | ✅ 已知 | |
| DDS 实现 | **不确定**（Humble 默认 FastDDS，Iron 默认 CycloneDDS） | ⚠️ [需Zack配合] 执行 `ros2 doctor --report \| grep -i dds` 确认 |
| xArm Python SDK | `xarm-python-sdk==1.18.4` | ✅ 已知 | V42/V43 实机验证版 |
| Python 版本 | **不确定**（建议 3.8+） | ⚠️ [需Zack配合] `python3 --version` |
| Ubuntu 版本 | **不确定**（20.04? 22.04?） | ⚠️ [需Zack配合] `lsb_release -a` |
| ROS2 发行版 | **不确定**（Humble? Iron?） | ⚠️ [需Zack配合] 看 `/opt/ros/<distro>/` 目录名 |
| 网络拓扑 | AGV 总控 ↔ 机械臂控制器：通过 AGV 上 ROS2 虚拟平台 | **不确定** [需Zack配合] 确认 AGV 总控能否直接 ping 通 172.31.0.123 |

### 2.2 启动模式（3 种）

| 模式 | 启动命令 | 用途 | 风险 |
|------|---------|------|------|
| Zack 独立测试 | `ros2 run xarm_pick_place pick_place_node`（auto_start=True，默认） | 机械臂独立功能验证（启动后 3s 自动解锁 + 抓取） | ❌ AGV 联调绝对禁用！AGV 还没停稳机械臂就动了 |
| **✅ AGV 联调（必须用这个）** | `ros2 run xarm_pick_place pick_place_node --ros-args -p auto_start:=false` | **AGV 主控通过 Service 触发**（启动后只连接不动作） | 正确模式 |
| 循环压力测试 | `ros2 run xarm_pick_place pick_place_node --ros-args -p auto_loop:=true -p auto_delay:=5.0 -p cycles:=10` | 10次/100次稳定性验证 | 仅测试用 |

### 2.3 ROS2 终端前置设置（**每个终端必须执行！**）

```bash
export ROS_DOMAIN_ID=30
source ~/ros2_ws/install/setup.bash
```

建议写入 `~/.bashrc` 永久生效：
```bash
echo 'export ROS_DOMAIN_ID=30' >> ~/.bashrc
echo 'source ~/ros2_ws/install/setup.bash' >> ~/.bashrc
```

---

## 三、ROS2 对外接口完整契约（严格对齐代码！）

> 本章节所有描述均已逐行对照 pick_place_node.py 核实。标注 `[代码已核]` 表示已在代码中找到对应实现。

### 3.0 节点基本信息

| 项 | 值 | 核实状态 / 代码行 |
|----|-----|-----------------|
| 节点名 | `/pick_place_server` | ✅ [代码已核] L32 |
| ROS_DOMAIN_ID | `30`（必须一致！） | ✅ |
| 互斥机制 | `threading.Lock()` + `MutuallyExclusiveCallbackGroup` | ✅ [代码已核] L69, L75 |

---

### 3.1 Service：`/unlock_and_home` — 黄金窗口解锁 + 归位 A_UP

| 项 | 内容 | 核实状态 / 代码位置 |
|----|------|-------------------|
| 类型 | `std_srvs/srv/Trigger` | ✅ L80-L81 |
| 请求 | 空 | ✅ |
| 响应 | `success: bool` + `message: string` | ✅ |
| **是否阻塞** | **是** — 阻塞到解锁 + A_UP 到位（含 7s move_wait）才返回 | ✅ L385-L401 |
| 预计阻塞时长 | **~14.5 秒**（取整 15s） | 估算值 |
| 内部超时机制 | **无**（完全由 move_wait 固定等待控制） | ✅ 代码无 timeout |
| 并发调用行为 | **排队阻塞等待（不是拒绝！）** 第二个 call 等 arm_lock 释放 | ✅ L386 `with self.arm_lock` |
| 失败后能否重调 | **可以**（推荐再调一次，窗口偶尔没抓住） | ✅ |

**响应 message 完整枚举：**

| 场景 | success | message | 代码位置 |
|------|---------|---------|---------|
| ✅ 到位误差 <20° | `True` | `"A_UP aligned"` | L395 |
| ⚠️ 到位误差 >20°（连发命中） | `True` | `"A_UP so-so (continue)"` | L395（注意 success 也是 True） |
| ❌ 机械臂未连接 | `False` | `"Arm not connected"` | L388-L389 |
| ❌ Python 异常 | `False` | `"Error: {异常字符串}"` | L397-L399 |

> ⚠️ 坑点：success=True + "so-so" 时，建议**再调一次 `/unlock_and_home`** 更稳妥。

---

### 3.2 Service：`/do_pick_place` — 执行完整取放循环（A→B）

| 项 | 内容 | 核实状态 / 代码位置 |
|----|------|-------------------|
| 类型 | `std_srvs/srv/Trigger` | ✅ L76-L77 |
| 请求 | 空 | ✅ |
| 响应 | `success: bool` + `message: string` | ✅ |
| **是否阻塞** | **是** — 阻塞到 cycles 次 11 块全部完成 | ✅ L348-L371 |
| 预计阻塞时长 | **cycles × ~63 秒**（cycles=1 时 ~63 秒） | 估算值 |
| 内部超时机制 | **无** | ✅ 代码无 timeout |
| 并发调用行为 | **排队阻塞等待（不是拒绝！）** | ✅ L349 `with self.arm_lock` |
| cycles 参数读取时机 | **每次 Service 调用动态读取** `get_parameter('cycles').value` | ✅ L355 |
| cycles 运行时可改 | **可以！** `ros2 param set /pick_place_server cycles 5` 立即生效 | ✅ |

**响应 message 完整枚举：**

| 场景 | success | message | 代码位置 |
|------|---------|---------|---------|
| ✅ cycles 次全部走完（**含夹爪失败的情况！**） | `True` | `"Done {cycles} cycle(s)"` | L362-L363 |
| ❌ 机械臂未连接 | `False` | `"Arm not connected"` | L350-L352 |
| ❌ Python 异常 | `False` | `"Error: {异常字符串}"` | L365-L367 |

> 🔴 **致命坑点：夹爪失败但返回 success=True！**
>
> `run_pick_place_cycle()` 调用 `gripper()` 时**没有接收返回值**！即使 Modbus 连不上/重试 2 次全失败，代码照样继续走下一步，最后返回 `success=True`。
>
> **AGV 总控不能只靠 success 判断抓取成功！** 必须额外订阅 ROS2 日志 grep "FAIL" 或抓取前后验证夹爪通道。
>
> **[需Zack确认：要不要改代码？]** 在 `run_pick_place_cycle()` 中检查 `gripper()` 返回值，失败时抛异常 → success=False。确认后我立刻改。

---

### 3.3 Service：`/set_gripper` — 单独控制夹爪

| 项 | 内容 | 核实状态 / 代码位置 |
|----|------|-------------------|
| 类型 | `std_srvs/srv/SetBool` | ✅ L78-L79 |
| `data=true` | **张开夹爪（LOW=0）** | ✅ L375 `on = not request.data` |
| `data=false` | **闭合夹爪（HIGH=1）** | ✅ 同上 |
| **是否阻塞** | **是** — Modbus 通信 + 2s 等待 | ✅ L373-L383 |
| 预计阻塞时长 | **~2.5 秒** | 估算值 |
| 运动中调用 | **排队等待当前运动（最长7s）完成** | ✅ arm_lock |

**响应 message 完整枚举：**

| 场景 | success | message | 代码位置 |
|------|---------|---------|---------|
| ✅ 张开成功 | `True` | `"FC05 addr=8 OPEN(LOW) OK"` | gripper_fc05 L192 |
| ✅ 闭合成功 | `True` | `"FC05 addr=8 CLOSE(HIGH) OK"` | 同上 |
| ❌ 响应不正确 | `False` | `"bad_resp={hex}"` | L193 |
| ❌ 重试 2 次全失败 | `False` | `"exc={异常字符串}"` | L200 |

---

### 3.4 Topic：`/pick_place_state` — 状态推送（⚠️ **纯文本，非 JSON！**）

| 项 | 内容 | 核实状态 / 代码位置 |
|----|------|-------------------|
| 类型 | `std_msgs/msg/String` | ✅ L83 |
| 发布频率 | **事件触发**（每个阶段开始发一条） | ✅ |
| QoS | Reliable + depth=10 | ✅ L83 |
| **消息格式** | **纯文本字符串！不是 JSON！** | ✅ L168-L172 publish_state |

**所有可能发布的消息完整清单：**

| 触发时机 | 消息内容（`msg.data`） | 代码位置 |
|----------|----------------------|---------|
| 解锁连发完成后 | `"[UNLOCK] Golden window done, waiting..."` | L273 |
| B1 运动开始 | `"[Studio B01] -> A_UP spd=5 acc=20"` | L293 arm_move |
| B3 运动开始 | `"[Studio B03] -> A_DN spd=5 acc=20"` | 同上 blk=3 |
| B6 运动开始 | `"[Studio B06] -> A_UP spd=5 acc=20"` | 同上 blk=6 |
| B7 运动开始 | `"[Studio B07] -> MID spd=5 acc=20"` | 同上 blk=7 |
| B8 运动开始 | `"[Studio B08] -> B_UP spd=5 acc=20"` | 同上 blk=8 |
| B11 运动开始 | `"[Studio B11] -> B_DN spd=5 acc=20"` | 同上 blk=11 |
| B2 夹爪张开 | `"[Studio B02] DO0=LOW=0 -> OPEN wait=2.0s"` | L206 gripper |
| B4 夹爪闭合 | `"[Studio B04] DO0=HIGH=1 -> CLOSE wait=2.0s"` | 同上 blk=4 |
| B9 夹爪张开 | `"[Studio B09] DO0=LOW=0 -> OPEN wait=2.0s"` | 同上 blk=9 |
| 单次循环完成 | `"[CYCLE {cyc}/{total}] B1..B11 done"` | L343 |
| Auto 多轮间隔 | `"[AUTO] Run #{N} done, next in 5.0s"` | L149 |
| Auto 全部完成 | `"[AUTO] All done. Node alive for manual Service calls."` | L153 |

> 🟠 **坑点：FC05 夹爪成功/失败信息不发 Topic！** 只打印到 ROS2 日志（get_logger），不通过 publish_state 发出来。AGV 订阅 `/pick_place_state` 只能知道夹爪开始了，不知道结果。
>
> **[需Zack确认：要不要改代码？]** 把 FC05 结果也 publish 出来，或新增一条如 `"[Studio B04] FC05 CLOSE OK"` / `"FAIL"`。确认后我立刻改。

---

### 3.5 Topic：`/joint_states` — 关节角度广播

| 项 | 内容 | 核实状态 / 代码位置 |
|----|------|-------------------|
| 类型 | `sensor_msgs/msg/JointState` | ✅ L84 |
| 发布频率 | **20 Hz**（50ms 定时器） | ✅ L85 |
| QoS | Reliable + depth=10 | ✅ L84 |
| 发布条件 | arm 连接成功后才发 | ✅ L407-L408 |
| `header.frame_id` | `"base_link"` | ✅ L415 |
| joint 名称 | `["joint1".."joint7"]`（J1~J7 正序） | ✅ L416 |
| `position` 单位 | **弧度（rad）** = deg × π/180 | ✅ L417 |
| `velocity` / `effort` | **空数组**（不发布） | ✅ |
| 读取失败 | **静默**（不报错不发） | ✅ L419-L420 |

---

### 3.6 ROS2 参数完整规格

| 参数名 | 类型 | 默认值 | 建议范围 | 运行时 `ros2 param set` 生效？ | 需重启？ |
|--------|------|--------|---------|-------------------------------|---------|
| `robot_ip` | str | `172.31.0.123` | 合法 IPv4 | ❌ 不生效 | **是** |
| `cycles` | int | `1` | 1~100 | ✅ **立即生效！** 每次 call 动态读 | **否** |
| `gripper_addr` | int | `8` | 0~65535 | ❌ 不生效 | **是** |
| `gripper_port` | int | `502` | 0~65535 | ❌ 不生效 | **是** |
| `arm_speed` | float | `5.0` | 0.1~100°/s | ❌ 不生效 | **是** |
| `arm_accel` | float | `20.0` | 0.1~200°/s² | ❌ 不生效 | **是** |
| `arm_radius` | float | `0.0` | 0~1000 mm | ❌ 不生效 | **是** |
| `move_wait` | float | `7.0` | 1~60 s | ❌ 不生效 | **是** |
| `auto_start` | bool | `True` | true/false | ❌ 不生效 | **是** |
| `auto_loop` | bool | `False` | true/false | ❌ 不生效 | **是** |
| `auto_delay` | float | `5.0` | 0~3600 s | ❌ 不生效 | **是** |

> 结论：只有 `cycles` 支持运行时动态修改。其余 11 个参数修改后需重启节点。

---

## 四、代码-文档一致性核查结果

| V3.0 章节 | V3.0 声明 | 代码核查 | V4.0 处理 |
|-----------|----------|---------|----------|
| 2.2 并发行为 | 拒绝并发（ERR_BUSY） | ❌ 实际 arm_lock 排队等待 | 已修正 |
| 2.2 夹爪失败 | 返回 ERR_GRIP_XXX + false | ❌ 实际忽略返回值 + true | 已修正 + 致命坑点标注 |
| 2.2 message 格式 | ERR_CONNECT / ERR_GRIP 前缀 | ❌ 实际 "Arm not connected" / "Error: {e}" | 已修正 |
| 2.3 /pick_place_state 格式 | JSON | ❌ 实际纯文本 | 已重写完整清单 |
| 2.3 夹爪结果 Topic | 枚举 grip_b2_open_fail JSON | ❌ 实际 FC05 结果不发 Topic | 已标注坑点 |
| 2.4 cycles 参数 | "启动时只读" | ❌ 实际每次 call 动态读 | 已修正为立即生效 |
| 7.x 黄金窗口步骤 | clean→mode1→mode0→state0→连发5→wait→比对 | ✅ 正确 | 保留 |
| 8.x Modbus FC05 规格 | FC05/addr8/HIGH=FF00/每次新建连接/2次重试/3s超时 | ✅ 正确 | 保留 |
| 12.x Studio 11 块时序 | B1→B2→B3→B4→B6→B7→B8→B9→B11 | ✅ 正确 | 保留 |
| POSES 5 个关节角 | 精确值 | ✅ 正确 | 保留 |

**核查统计**：V3.0 共 16 项声明，✅ 正确 10 项，❌ 错误 6 项（2 项致命级）。

---

## 五、AGV 顶板钣金安装的控制影响分析

### 5.1 坐标系关系

```
AGV 地图坐标系 (map)
   └── 导航目标点（停靠精度 ±3mm / ±0.3°）
        └── AGV 车体 (base_link)
             └── xArm 底座（硬固定，相对位置不变）
                  └── 5 个 POSES 关节角（天然在底座系下）
```

### 5.2 顶板安装关键时序

| # | 要求 | 原因 | 建议值 | 负责方 |
|---|------|------|--------|-------|
| 1 | AGV 停稳 → 延迟 T 秒 → 调机械臂 | 钣金弹性 → 末端摆振 | **T ≥ 3s**（不是 2s！） | AGV 总控 |
| 2 | 抓取全程 AGV 禁止移动 | 惯性摆动 + 碰撞风险 | ~63s 全程静止 | AGV 总控 |
| 3 | 抓取完成 → 延迟 ≥0.5s → AGV 启动 | 机械臂微小晃动 | 0.5~1s | AGV 总控 |
| 4 | Service 超时阈值 | 顶板 + 通信冗余 | unlock≥30s / do_pick_place≥120s | AGV 总控 |

### 5.3 停靠精度要求

| 工位 | X/Y | Z | 航向角 | 难度 | 说明 |
|-----|-----|---|--------|------|------|
| A_DN 抓取工位（料台取） | **≤ ±3mm** | **≤ ±2mm** | **≤ ±0.3°** | 🟡 较高 | 料台位置固定，AGV 停偏了抓不到 |
| B_DN 放置工位（AGV 托盘放） | 无关 | 无关 | 无关 | 🟢 容易 | B 点相对 AGV 固定 |

> 如果 AGV 精度达不到：**方案A（短期推荐）** 料台加 V 型导向块 / 锥形定位销；**方案B（后续）** 加视觉对位。
>
> **[需Zack配合]** 当前 AGV 实际停靠精度能到多少？料台上有没有导向结构？

---

## 六、错误状态与异常处理

### 6.1 错误分类表（严格按代码实际返回）

| 错误类型 | 触发条件 | success | message 实际内容 | AGV 处理建议 | 自动恢复？ |
|---------|---------|---------|----------------|-------------|-----------|
| 连接失败 | `self.arm is None` | `False` | `"Arm not connected"` | 检查网线/重启节点 | 否（需重启） |
| 解锁不到位 | 连发命中但误差大 | `True` | `"A_UP so-so (continue)"` | **再调一次 `/unlock_and_home`** | 是（重调） |
| 运动异常 | Python 异常 | `False` | `"Error: {e}"` | unlock → 重试抓取 | 部分可 |
| 🔴 夹爪失败 | Modbus 连不上/重试2次失败 | **`True`（代码忽略！）** | `"Done N cycle(s)"`（和成功一样） | 🔴 **AGV 不能靠 success！** 要么解析日志 grep "FAIL"，要么等我改代码 | 否（AGV不知道） |
| 急停按下 | 物理按钮 state=4 | 不确定（可能抛异常） | `"Error: ..."` 或 so-so | 人工复位急停 → unlock | 否（需人工复位） |
| 到位超时 | move_wait 到了没到位 | **`True`（仅日志 warn）** | `"Done N cycle(s)"` | 目前无法从 Service 检测 | 否 |
| 并发调用 | 同时 call | **排队等待**（不是拒绝） | — | AGV 严格串行化 | 是（等前面完） |
| 物体掉落 | 抓取后脱落 | **无检测，纯开环** | success=True | [后续迭代] 加传感器 | 否 |
| 未知错误 | Python 异常 | `False` | `"Error: {e}"` | 记录日志 + 人工 | 否 |

### 6.2 自动重试策略

| 项 | 代码实际实现 | AGV 侧建议 |
|----|-------------|-----------|
| 连接失败自动重试 | Auto 模式每 10s 重试；手动模式不重试 | AGV 联调模式建议改代码加 10s 轮询重连；临时方案：收到 "Arm not connected" 通知人工重启 |
| 夹爪失败重试 | gripper_fc05 内部 retry 2 次，间隔 0.4s | ✅ 夹爪层 OK；但 AGV 层不知道失败！必须配合上面的代码修改 |
| 运动连发冗余 | set_servo_angle 连发 5 次（解锁 0.12s 间隔 / 普通 0.15s 间隔） | ✅ 已实现 |
| 解锁失败重试 | 无内置自动重试 | AGV 收到 so-so / False → **立即再 call unlock 一次**，最多 2 次 |
| 错误日志位置 | `~/.ros/log/latest/*.log` + 控制台 | AGV grep 关键词：`FAIL` / `Error:` / `Arm not connected` / `so-so` |

---

## 七、取/放分离与接口升级路线

### 7.1 AGV 方 5 个核心问题回答

| Q | 问题 | 回答（严格基于当前代码） |
|---|------|----------------------|
| Q1 | do_pick_place 是完整循环还是可以只取/只放？ | **一体，不能分。** 11 块硬编码。 |
| Q2 | A/B 点坐标硬编码还是参数传入？ | **硬编码**在 POSES 字典（代码 L60-L66）。 |
| Q3 | AGV 去不同位置取货怎么办？ | (a) 硬编码方式 → 地图上定义多个停靠工位，每个工位对应一套 POSES，切换工位需改代码+build+重启；(b) AGV 停靠精度 < ±3mm → 一套 POSES 即可。 |
| Q4 | 短期内能否拆成 /do_pick 和 /do_place？ | **短期不建议拆。** 会破坏 11 块时序+状态一致性。先拿固定动作接口联调通。 |
| Q5 | 短期不拆，AGV 联调用固定动作是否可行？ | **完全可行。** 流程：AGV 到站A → 停稳+延迟3s → unlock → do_pick_place(cycles=1) → success=True → 延迟0.5s → AGV 离开。**B 点（放货点）必须在 AGV 上！** |

### 7.2 接口升级路线

```
第一阶段（当前联调 ✅ 就绪）
  ├─ 3个 Service（unlock/do_pick_place/set_gripper）
  ├─ 2个 Topic（pick_place_state纯文本 / joint_states）
  ├─ POSES 硬编码
  ╰─ ⚠️ 待改代码：夹爪失败不返回 + FC05 结果不发 Topic

第二阶段（工位扩展 [后续迭代] ~2周）
  ├─ 新增自定义 srv/PickPlace.srv（cycles + station_id）
  ├─ POSES → YAML 配置（按 station_id）
  ╰─ ros2 param set station_id 动态切换

第三阶段（取放分离 [后续迭代] ~4周）
  ├─ Service：/do_pick(station_id) → B1..B6
  ├─ Service：/do_place(station_id) → B7..B11
  ╰─ 中间 AGV 导航（机械臂保持安全姿态）

第四阶段（视觉对位 [后续迭代] ~1~2月）
  ├─ 装相机 + 手眼标定
  ├─ A_DN 从硬编码 → 视觉动态计算
  ╰─ 解决 AGV 停靠精度不足
```

---

## 八、AGV 联动时序与状态机

### 8.1 完整联动时序

```
AGV 导航 → 机械臂工位（地图站点如 LM_10）
  │
  ▼
AGV 到站判定（API 1020 finished 或推送 19301）
  │
  ▼
┌───────────────────────────────────────────────┐
│ ⚠️ 顶板安装特有：停稳 → 延迟 ≥3s（摆振衰减）  │
└───────────────────────────────────────────────┘
  │
  ▼
第一次运行 OR 上次失败？→ 是 → 调 ① /unlock_and_home（~15s，超时30s）
  │                                      └─ so-so / False → 再调 1 次
  │
  ▼
调 ② /do_pick_place（cycles=1，~63s，超时120s）
  │
  ▼
success=True？
  ├─ ❌ False → "Arm not connected" → 人工重启节点
  │           → "Error: ..." → unlock → retry 抓取 1 次
  │
  └─ ✅ True（⚠️ 但可能夹爪实际失败了！）
        ├─ [推荐] 额外验证：视觉/料台物体检查 / 抓取前后 /set_gripper 验证
        │
        ▼
┌───────────────────────────────────────────────┐
│ ⚠️ 顶板安装特有：抓取完成 → 延迟 ≥0.5s        │
└───────────────────────────────────────────────┘
  │
  ▼
AGV 调用 API 3051 → 导航下一站点
```

### 8.2 联动关键参数

| 参数 | 值 | 来源 |
|------|----|------|
| 单次 do_pick_place 耗时（cycles=1） | **≈63 秒** ⚠️ [需Zack实机标定] | 估算（7×7 + 3×2 + 余量） |
| unlock_and_home 耗时 | **≈15 秒** ⚠️ [需Zack实机标定] | 估算 |
| 超时阈值建议 | unlock≥30s；do_pick_place≥120s | V4.0 建议 |
| AGV 停稳 → 启动机械臂延迟 | **≥3s** | V4.0 顶板安装特有 |
| 抓取完成 → AGV 启动延迟 | **≥0.5s** | V4.0 顶板安装特有 |
| A_DN 停靠精度要求 | **≤ ±3mm(XY) / ±0.3°(航向) / ±2mm(Z)** | V4.0 顶板安装特有 |
| cycles 每轮次数 | 默认 1（每次到站 1 次取放） | AGV 业务 |

---

## 九、位置坐标与运动耗时

### 9.1 五个关键位置（关节角 ✅ 已核，笛卡尔 ❌ 待读）

**关节角（J1~J7 °）代码 POSES 精确值：**

| 位置 | J1 | J2 | J3 | J4 | J5 | J6 | J7 | 说明 |
|------|----|----|----|----|----|----|----|------|
| A_UP | 25.0 | 13.7 | -31.2 | 70.0 | -168.5 | -58.1 | 80.4 | 取货上方 |
| A_DN | -3.7 | 15.4 | 2.6 | 67.4 | -177.6 | -51.4 | 89.2 | 取货下降位 |
| MID | 24.9 | 22.3 | -51.0 | 71.0 | -157.4 | -59.2 | 55.8 | 过渡避障 |
| B_UP | 30.0 | 27.2 | -59.2 | 68.8 | -149.9 | -58.6 | 48.7 | 放货上方 |
| B_DN | 40.8 | 33.4 | -77.4 | 71.0 | -142.5 | -68.8 | 41.6 | 放货下方（结束） |

**笛卡尔坐标（TCP x/y/z mm rx/ry/rz °）：**

| 位置 | x | y | z | rx | ry | rz |
|------|---|---|---|----|----|----|
| A_UP~B_DN | **不确定** | **不确定** | **不确定** | **不确定** | **不确定** | **不确定** |

> **[需Zack配合 实机读取]** 读取命令：
> ```python
> from xarm.wrapper import XArmAPI
> import time
> a = XArmAPI('172.31.0.123'); time.sleep(2)
> # 然后在 Studio 里依次把机械臂切到 A_UP/A_DN/MID/B_UP/B_DN，每个位置调用:
> print(a.get_position())  # 返回 (code, [x,y,z,rx,ry,rz])
> a.disconnect()
> ```

### 9.2 单次循环耗时明细（估算 ⚠️ 待标定）

| Studio块 | 动作 | 运动等待(s) | 夹爪等待(s) | 累计(s) |
|---------|------|------------|------------|--------|
| B1 | →A_UP | 7.0 | — | 7.0 |
| B2 | 夹爪张开@A_UP | — | 2.0 | 9.0 |
| B3 | →A_DN | 7.0 | — | 16.0 |
| B4 | 夹爪闭合@A_DN | — | 2.0 | 18.0 |
| B6 | →A_UP 抬起 | 7.0 | — | 25.0 |
| B7 | →MID 过渡 | 7.0 | — | 32.0 |
| B8 | →B_UP | 7.0 | — | 39.0 |
| B9 | 夹爪张开@B_UP | — | 2.0 | 41.0 |
| B11 | →B_DN 下探 | 7.0 | — | 48.0 |
| **合计** | | **49.0** | **8.0** | **~63s（+余量）** |

---

## 十、黄金窗口解锁详细说明

> 自定义术语：set_mode(1→0)+set_state(0) 后 **0.5 秒内** state=4 锁存短暂失效，必须在这个窗口内连发运动指令。

| 步骤 | 调用 | 等待 | 说明 |
|------|------|------|------|
| 1 | clean_error + clean_warn | 0.3s | 清除错误/警告码 |
| 2 | motion_enable(True) | 0.5s | 伺服上电 |
| 3 | set_mode(1) | 0.5s | 切非0模式扰动状态机 |
| 4 | set_mode(0) | 0.15s | 切回运动模式 |
| 5 | set_state(0) | **0s！立刻下一步** | 黄金窗口开启（~0.5s） |
| 6 | set_servo_angle(A_UP) × 5 连发 | 每次 **0.12s 间隔**（共 0.6s） | 覆盖窗口，保证至少 1 次命中 |
| 7 | time.sleep(move_wait=7) | 7.0s | 等待到位 |
| 8 | get_servo_angle 回读比对 | — | 误差 <20° 算成功 |

---

## 十一、夹爪控制详细规格

| 项 | 值 | 核实 |
|----|-----|------|
| 协议 | Modbus TCP | ✅ |
| 功能码 | FC05 (Write Single Coil) | ✅ L182 |
| IP:Port | 172.31.0.123:502 | ✅ |
| 线圈地址 | 8（DO 通道 8） | ✅ |
| 张开值 | 0x0000 (LOW) | ✅ L181 |
| 闭合值 | 0xFF00 (HIGH) | ✅ L181（Modbus 标准，不是 0x0001） |
| 动作后等待 | 2.0s | ✅ gripper L209 |
| Modbus socket 超时 | 3000 ms | ✅ L185 |
| Modbus 连接模式 | 每次 FC05 新建连接，用完关闭 | ✅ L184-L190 |
| 失败重试 | 2 次，间隔 0.4s | ✅ L179 + L199 |
| 夹爪响应延迟 | **不确定** ⚠️ [需Zack实测] ~50-200ms | |
| 完全张开/闭合时间 | **不确定** ⚠️ [需Zack实测] ~500-800ms | 当前 2s 冗余充足 |
| 物体检测 | ❌ 当前无（纯开环） | [后续迭代] 加传感器 |
| 夹爪品牌/型号/开口范围/夹持力/气压 | **不确定** ⚠️ [需Zack确认铭牌] | |

---

## 十二、Web 端集成接口设计（后续阶段）

| HTTP 端点 | Method | 请求 | 响应 | 对应 ROS2 | 超时 |
|-----------|--------|------|------|----------|------|
| `/api/arm/status` | GET | 空 | `{"online":bool,"state":"idle/unlocking/running/error","current_msg":"...","error":""}` | 订阅 `/pick_place_state` 缓存 | 瞬时 |
| `/api/arm/pose` | GET | 空 | `{"joints_deg":[7],"joints_rad":[7],"x":null,"y":null,"z":null}` | arm.get_servo_angle + get_position | 瞬时 |
| `/api/arm/gripper` | GET | 空 | `{"state":"open/closed/unknown","last_result":"..."}` | 内存记录（需改代码存成员变量） | 瞬时 |
| `/api/arm/pick_place` | POST | `{"cycles":1}` | `{"success":bool,"message":"..."}` | ros2 param set cycles → `/do_pick_place` | cycles×120s |
| `/api/arm/unlock` | POST | 空 | `{"success":bool,"message":"..."}` | `/unlock_and_home` | 30s |
| `/api/arm/gripper` | POST | `{"open":bool}` | `{"success":bool,"message":"..."}` | `/set_gripper` SetBool | 5s |
| `/api/arm/stop` | POST | 空 | `{"success":bool}` | **当前无此 Service！** [后续迭代] 新增软急停 | 1s |

> 前端 UI 需求：状态卡片 + B1~B11 进度条 + 关节角显示 + 夹爪图标 + 解锁/抓取/停止按钮组 + 紧急停止大按钮 + 关节角实时曲线

---

## 十三、安全边界与维护信息

| 项 | 值/说明 | 核实 |
|----|--------|------|
| 关节角度限位（J1~J7 min/max） | **不确定** ⚠️ [需Zack查手册/Studio] | |
| 笛卡尔工作空间 | xArm7 半径约 886mm；具体范围待查 | ⚠️ |
| 关节速度安全上限 | 手册标称 180°/s；实机业务推荐 ≤30°/s；顶板安装推荐 ≤10°/s | 经验值 |
| 关节加速度安全上限 | 手册 500°/s²；业务推荐 ≤80°/s²；顶板推荐 ≤40°/s² | 经验值 |
| 碰撞检测 | 依赖控制器内置，触发 C121/C120 → 解锁恢复 | ⚠️ [需Zack确认 Studio 是否开启] |
| 软急停 | 可用 `motion_enable(False)` 或 `set_mode(3)`；但当前无 Service 暴露 | ✅ |
| 硬急停 | 控制器蘑菇头按钮 → state=4；恢复：顺时针拧1/4圈弹起 → unlock | ✅ 实机验证 |
| 安全区域（AGV 行驶姿态） | **强烈建议配置**：机械臂必须回到 B_DN/A_UP 安全姿态 AGV 才能动 | ⚠️ [需Zack配合 Studio 配置] |

**维护关键：**
- **xarm-python-sdk 升级警告**：V42/V43 基于 1.18.4 验证，升级前必须查 Release Notes，set_mode/set_state 时序变动可能直接让黄金窗口失效！
- **备份清单**：`~/ros2_ws/src/xarm_pick_place/**`（最重要，含 POSES 和逻辑）+ Studio 工程文件 + 接线说明

---

## 十四、测试验收标准

| # | 测试项 | 验收标准 | 优先级 |
|---|--------|---------|-------|
| T1 | 单次抓取成功 | A→B 物体正确移动，11 块顺序对 | 🔴 必测 |
| T2 | 连续 10 次循环无故障 | 10 次全 success + 无掉落碰撞 | 🟠 高优 |
| T3 | 夹爪开合响应 | /set_gripper 开/合各5次全 OK + 动作匹配 | 🔴 必测 |
| T4 | 解锁鲁棒性 | 重启节点 10 次 unlock，≥9 次 success | 🟠 高优 |
| T5 | 急停恢复流程 | 抓取中按急停 → 复位 → unlock → 再抓取成功（2次） | 🟠 高优 |
| T6 | 网络断后恢复 | 拔网线 10s → 插回 → 节点存活 → unlock 成功 | 🟡 中优 |
| T7 | Service 并发安全 | 双终端同时 call → 串行执行、不崩溃、两次全返回 | 🟡 中优 |
| T8 | 手动模式（auto_start=false） | 启动 60s 机械臂完全不动 | 🔴 必测 |
| T9 | Service 阻塞时长合理 | do_pick_place 实际耗时 ≤75s（63s+20%） | 🟠 高优 |
| T10 | 位置重复精度 | 10 次循环 A_DN 偏差 <5mm | 🟡 中优 |
| T11 | /pick_place_state 消息完整 | 每个 Bxx 消息都出现，顺序 B1→B2→B3→B4→B6→B7→B8→B9→B11 | 🔴 必测 |
| T12 | /joint_states 20Hz + 弧度正确 | 频率 19~21Hz；角度→弧度比值=π/180 | 🟠 高优 |
| T13 | 顶板安装停稳延迟 | 1s/2s/3s/5s 延迟各测 3 次 → 确定最小安全延迟 | 🟡 中优（特有） |
| T14 | AGV 停靠精度下限 | ±3/±5/±8mm 各测 3 次 → 确定精度阈值 | 🟡 中优 |
| T15 | cycles 动态生效 | param set cycles 3 → call do_pick_place → 实际跑 3 次 | 🟡 中优 |

---

## 十五、Zack 待办事项清单（需实机配合）

### 🔴 最高优先级（AGV 联调前必须完成）

| # | 事项 | 方法 / 命令 | 输出 | 预计耗时 |
|---|------|------------|------|---------|
| **Z1** | **确认代码致命缺陷是否修复**：(a) 夹爪失败不返回 False (b) FC05 结果不发 Topic → 两个缺陷我马上改代码 | **告诉我：要不要立刻改？** | 10 分钟决策 |
| Z2 | 标定 do_pick_place 单次耗时 | `date +%s%3N; ros2 service call /do_pick_place Trigger; date +%s%3N` → 测 3 次取平均 | 平均秒数 | 5 分钟 |
| Z3 | 标定 unlock_and_home 耗时 | 同上测 unlock 服务 → 3 次平均 | 平均秒数 | 5 分钟 |
| Z4 | 确认 ROS2 环境信息 | `lsb_release -a; python3 --version; ls /opt/ros/; ros2 doctor --report 2>/dev/null \| grep -i dds` | 4 条命令输出 | 2 分钟 |
| Z5 | 确认网络拓扑 | AGV 总控能否 ping 通 172.31.0.123？虚拟平台怎么连的？（画图或文字描述） | 拓扑说明 | 10 分钟 |

### 🟠 高优先级（联调第一周）

| # | 事项 | 方法 | 输出 | 预计耗时 |
|---|------|------|------|---------|
| Z6 | 读取 5 个位置笛卡尔坐标 | 启动节点 → python 调用 `arm.get_position()` 在每个点位 | 5×6=30 个数字 | 5 分钟 |
| Z7 | 实测顶板停稳延迟 | 到站后延迟 1s/2s/3s/5s 各启动抓取 3 次，统计 A_DN 成功率 | 确定最小安全延迟 | 30~60 分钟 |
| Z8 | 实测 AGV 停靠精度下限 | 料台旁偏 ±3/±5/±8mm 停靠各 3 次 → 看能否抓取成功 | 精度阈值（是否需要导向块） | 30 分钟 |
| Z9 | 确认夹爪规格 | 查铭牌/采购单：品牌/型号/开口范围/夹持力/气压 | 规格表 | 10 分钟 |
| Z10 | 实测夹爪响应时间 | 手机慢动作视频 + Modbus 抓包时间戳 | 发命令→开始动作→完全开合 3 个时间 | 15 分钟 |

### 🟡 中优先级（联调第二周）

| # | 事项 | 方法 | 输出 | 预计耗时 |
|---|------|------|------|---------|
| Z11 | 实测 speed=3/10 下的耗时和平稳性 | 改 arm_speed + arm_accel + move_wait 各跑 3 次 | 耗时 + 是否异响碰撞 | 30 分钟 |
| Z12 | 连续 100 次循环压力测试 | auto_loop 跑一下午 | 成功率 + 第 100 次位置偏差 | 2~3h |
| Z13 | 确认碰撞检测开启状态 + 灵敏度 | Studio → 设置 → 碰撞检测 | 参数值或截图 | 5 分钟 |
| Z14 | 配置 AGV 安全姿态 + 安全区域 | Studio → 设置 → 安全区域；定义 AGV 行驶姿态（B_DN 或 A_UP） | 配置参数 | 10 分钟 |
| Z15 | 补充实际遇到过的 xArm 错误码 | 翻终端历史 / ROS2 日志 | 错误码 + 含义 + 恢复方法 | 10 分钟 |

### 🟢 低优先级（后续迭代）

| # | 事项 | 方法 | 输出 | 预计耗时 |
|---|------|------|------|---------|
| Z16 | 关节角度限位 J1~J7 min/max | 查手册 / Studio → 关节限位 | 7 组 (min,max) | 10 分钟 |
| Z17 | 笛卡尔工作空间 x/y/z 范围 | 查手册 / Studio 可视化 | 3 轴范围 | 5 分钟 |
| Z18 | xArm 底座在 AGV base_link 下的精确坐标 | 尺子量 + 量角器 / 简单标定 | (x mm, y mm, z mm, yaw °) | 20~30 分钟 |
| Z19 | AGV 地图机械臂工位站点名 | 查 AGV 导航地图配置 / 问同事 | 如 LM_10 / PICK_STN_01 | 问同事 |
| Z20 | 和 AGV 总控确认失败重试策略 | 开小会确认 8.1 节重试逻辑 | 最终确认策略 | 20 分钟 |

---

## 十六、附录：Studio 11 块时序与速查卡

### 16.1 Studio 11 块完整时序

| 块号 | 动作 | 目标位置 | 夹爪 | 等待 | 代码调用 |
|------|------|---------|------|------|---------|
| B1 | 关节运动 → A_UP | A_UP | — | — | arm_move("A_UP", blk=1) |
| B2 | DO0 低电平（张开） | A_UP | **张开 LOW=0** | 2.0s | gripper("OPEN", blk=2, wait_s=2.0) |
| B3 | 关节运动 → A_DN | A_DN | 张开 | — | arm_move("A_DN", blk=3) |
| B4 | DO0 高电平（闭合，含块5等待） | A_DN | **闭合 HIGH=1** | 2.0s | gripper("CLOSE", blk=4, wait_s=2.0) |
| B6 | 关节运动 → A_UP（抬起） | A_UP | 闭合 | — | arm_move("A_UP", blk=6) |
| B7 | 关节运动 → MID（过渡） | MID | 闭合 | — | arm_move("MID", blk=7) |
| B8 | 关节运动 → B_UP | B_UP | 闭合 | — | arm_move("B_UP", blk=8) |
| B9 | DO0 低电平（张开，含块10等待） | B_UP | **张开（物体掉落！）** | 2.0s | gripper("OPEN", blk=9, wait_s=2.0) |
| B11 | 关节运动 → B_DN（结束） | B_DN | 张开 | — | arm_move("B_DN", blk=11) |

> B5（等待 2s）合并到 B4 wait_s=2.0；B10（等待 2s）合并到 B9 wait_s=2.0。

### 16.2 速查卡

```
┌──────────────────────────────────────────────────────────┐
│  xArm7 ROS2 抓取节点 速查卡  V4.0（AGV 顶板钣金安装版）    │
├──────────────────────────────────────────────────────────┤
│ ⚙️ 环境（每个终端必须！）                                  │
│   export ROS_DOMAIN_ID=30                                 │
│   source ~/ros2_ws/install/setup.bash                    │
│                                                          │
│ 🚀 启动（AGV 联调 必须用这个！）                          │
│   ros2 run xarm_pick_place pick_place_node \             │
│     --ros-args -p auto_start:=false                      │
│                                                          │
│ 📞 Service 调用顺序                                       │
│   ① ros2 service call /unlock_and_home Trigger  (15s)    │
│   ② ros2 service call /do_pick_place   Trigger  (63s)    │
│   ③ 调试: ros2 service call /set_gripper SetBool         │
│          "{data: true}" 张开 / "{data: false}" 闭合      │
│                                                          │
│ 📡 Topics                                                │
│   ros2 topic echo /pick_place_state  ← 纯文本进度        │
│     (例: [Studio B03] -> A_DN spd=5 acc=20)              │
│   ros2 topic echo /joint_states      ← 关节角 rad 20Hz   │
│   ros2 topic hz   /joint_states                          │
│                                                          │
│ 🔑 顶板安装关键参数                                      │
│   · cycles: ros2 param set 动态改 立即生效               │
│   · AGV 到站 → 延迟 ≥3s → 调机械臂（钣金摆振）           │
│   · AGV 停靠精度 ≤ ±3mm（抓取工位，料台无导向块时）       │
│   · unlock=15s(阈值30s) / pick=63s(阈值120s)             │
│                                                          │
│ ⚠️ 5 个坑（AGV 必记！）                                  │
│   1. /pick_place_state 是纯文本，不是 JSON！             │
│   2. Service 并发是排队等待，不会拒绝！                  │
│   3. 🔴 夹爪失败不返回 False！success=True 也要验证！    │
│   4. message 没有 ERR_ 前缀！grep 实际关键词            │
│   5. cycles 运行时 ros2 param set 立即生效！            │
│                                                          │
│ 🛠️ 架构: 方案C混合（SDK直连黄金窗口安全）                 │
│ 📍 机械臂: AGV 顶板钣金硬固定（A/B点位相对车体固定）      │
└──────────────────────────────────────────────────────────┘
```

---

**文档版本历史**：

| 版本 | 日期 | 修改人 | 主要改动 |
|------|------|--------|---------|
| V1.0 | 2026-08-08 | — | 初始实机测试手册 |
| V2.0 | 2026-08-12 | — | 补充 ROS2 通信架构、Studio 11 块时序、参数表 |
| V3.0 | 2026-08-13 | — | 整合 AGV 补充需求 Part1~10 |
| **V4.0** | **2026-08-13** | **Agent 基于代码核查** | **① 修正 5 处代码-文档重大不一致 ② 新增代码一致性核查章节 ③ 新增 AGV 顶板钣金安装影响（停稳延迟 3s、停靠精度 ±3mm）④ 整理 Zack 待办 Z1~Z20 ⑤ 完善速查卡** |
