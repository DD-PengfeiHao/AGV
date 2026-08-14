# ROS2（Humble, Python）技术路线与接口规划

> 角色：项目负责人 → 负责 **ROS2 环境搭建 / 模块通信集成 / 网络安全脚本开发**。
> 约束：Python；ROS2 Humble（LTS，Python 3.10）；你的域控通过 **Robokit TCP API** 调机器人（无机器系统账号）。
> 目标：给出完整技术路线 + 一周内可落地的 Topic/Service/Action 接口定义深度。

---

## 一、总体技术路线（三大职责 → 交付物）

```
[你的域控 ROS2 Humble]                         [机器人域控 Robokit]
 robokit_bridge 节点 (TCP Client)  ──API──►   TCP Server (机器人)
   │ 翻译 ROS2 ↔ Robokit
   ├─ 状态上报 (Topic)         ← 查询/推送命令
   ├─ 控制/配置 (Service)      ← 控制/配置命令
   └─ 导航 (Action)            ← 3051/1020/2002/1021/2003
        │
   与其它业务模块通过 Topic/Service/Action 互联（你负责定义与集成）
        │
   网络安全脚本：域控间只放行 API 端口 + DDS 端口（你负责）
```

| 职责 | 交付物 |
| --- | --- |
| ROS2 搭建 | colcon 工作空间、功能包、launch、参数文件、构建脚本 |
| 模块通信集成 | 全套 `.msg/.srv/.action` 接口 + 接口契约文档 + bridge 与各模块接线 |
| 网络安全脚本 | 域控间端口白名单（API + DDS）、VLAN/隔离说明、连通性自检脚本 |

---

## 二、系统架构与模块划分

建议把 bridge 再拆成内部子模块（单包多节点 / 单节点多职责均可，先按"一个 bridge 节点 + 一个协议层"起步）：

```
robokit_bridge/
 ├─ robokit_client.py      # 协议层：TCP 连接、报文头编解码、请求/响应配对
 ├─ mock_robokit_server.py # 离线自测：模拟机器人 TCP Server
 ├─ bridge_node.py         # ROS2 节点：把 API 翻译成 Topic/Service/Action
 ├─ replan_monitor.py      # 导航监控：轮询1020/被阻挡 → 触发重规划(可选)
 └─ interfaces/            # .msg / .srv / .action 定义
```

对外（与其它业务模块）只暴露 ROS2 接口，不直接暴露 TCP。

---

## 三、colcon 工作空间结构

```
~/agv_ws/
 ├─ src/
 │   ├─ robokit_bridge/          # 机器人接口桥接包
 │   │   ├─ robokit_bridge/
 │   │   │   ├─ robokit_client.py
 │   │   │   ├─ bridge_node.py
 │   │   │   └─ mock_robokit_server.py
 │   │   ├─ launch/bridge.launch.py
 │   │   ├─ config/bridge.params.yaml
 │   │   ├─ interfaces/           # .msg/.srv/.action
 │   │   ├─ package.xml
 │   │   └─ setup.py
 │   ├─ agv_interfaces/          # 跨模块公共接口包（你统一维护）
 │   └─ netsec/                  # 网络安全脚本包（或独立脚本目录）
 └─ install/ build/ log/          # colcon 产物
```

---

## 四、接口定义草案（Topic / Service / Action）

> 下面字段为**草案**，外壳（接口名/方向/频率/QoS）一周内可定稿；内部 payload 映射（如 3051 吃站点还是坐标）等飞书命令页字段确认后再定。

### 4.1 Topic（bridge 发布，其它模块订阅）
| 话题 | 类型 | 频率 | 说明 |
| --- | --- | --- | --- |
| `/robokit/state/pose` | `RobokitPose` | 5~10 Hz | 世界坐标 x,y,yaw |
| `/robokit/state/speed` | `Speed` | 10 Hz | 线/角速度 |
| `/robokit/state/battery` | `BatteryState` | 1 Hz | 电量/电压/充电 |
| `/robokit/state/io` | `IoState` | 5 Hz | 数字量 IO |
| `/robokit/state/imu` | `sensor_msgs/Imu` | 50 Hz | IMU（如有） |
| `/robokit/state/status` | `RobokitStatus` | 5 Hz | 急停/被阻挡/模式/故障码 |
| `/robokit/push/*` | 按推送内容定 | 事件 | 机器人推送 API → 对应话题 |

### 4.2 Service（按需调用）
| 服务 | 类型 | 说明 |
| --- | --- | --- |
| `/robokit/query` | `Query` | 通用查询：api_type + json → json（最灵活，先有它就能调任何读命令） |
| `/robokit/control` | `Control` | 控制指令：运动/停止/急停/解除急停 |
| `/robokit/relocate` | `Relocate` | 重定位 2002 |
| `/robokit/modbus/read` | `ModbusRead` | 读寄存器 [0x/1x/3x/4x] |
| `/robokit/modbus/write` | `ModbusWrite` | 写寄存器 |
| `/robokit/script/run` | `ScriptRun` | 执行脚本（配置类 API） |
| `/robokit/arm/control` | `ArmControl` | 机械臂控制（配置类 API） |

### 4.3 Action（长任务）
| 动作 | 类型 | 说明 |
| --- | --- | --- |
| `/robokit/navigate` | `Navigate` | 目标=站点/坐标 → 反馈=重定位/定位/导航/到达/受阻 → 结果=成功/失败 |

### 4.4 IDL 草案
```msg
# RobokitPose.msg
std_msgs/Header header
float64 x
float64 y
float64 yaw
float64 stamp_ms
```
```msg
# RobokitStatus.msg
std_msgs/Header header
bool e_stop
bool blocked
uint8 mode          # 0未知 1空闲 2运行 3导航中 4故障
string fault_code
```
```msg
# BatteryState.msg
std_msgs/Header header
float64 percentage
float64 voltage
bool charging
```
```srv
# Query.srv
uint16 api_type
string request_json
---
bool success
string response_json
string error
```
```srv
# Control.srv
uint8 cmd            # 1运动 2停止 3急停 4解除急停
string params_json
---
bool success
string error
```
```srv
# ModbusRead.srv
uint16 register_type   # 0/1/3/4
uint16 address
uint16 count
---
bool success
int32[] values
string error
```
```action
# Navigate.action
# goal
string target_id
RobokitPose target_pose
bool use_pose
---
# result
bool success
string error
---
# feedback
uint8 state     # 0未开始 1重定位 2定位中 3导航中 4到达 5受阻 6失败
float32 progress
string message
```

---

## 五、一周实施计划（日级）

| 天 | 任务 | 产出 |
| --- | --- | --- |
| D1 | ROS2 Humble 环境（裸机/VM/Docker）、colcon 工作空间、建 `robokit_bridge` + `agv_interfaces` 空包、定义全部 `.msg/.srv/.action` 并 `colcon build` 通过 | 可编译的接口包 |
| D2 | 实现 `robokit_client.py`（报文头 pack/unpack、seq 配对、响应=请求+10000）；写 `mock_robokit_server.py` 模拟机器人 | 协议层 + 离线 Mock |
| D3 | `bridge_node.py`：连 Mock，把查询命令跑成 Topic；`/robokit/query` 服务打通 | 离线可跑的 bridge |
| D4 | `/robokit/navigate` Action（封装 2002→1021→2003→3051→1020）；`/robokit/control`、`/robokit/relocate` 服务 | 控制/导航闭环（对 Mock） |
| D5 | 模块通信集成：定义其它业务模块需要的接口契约（谁发谁收、频率、QoS、命名空间 `/robokit`、ROS_DOMAIN_ID 隔离）；写 launch 把节点拉起 | 接口契约文档 + launch |
| D6 | 网络安全脚本：域控间只放行 API 端口 + DDS 端口（nftables/iptables 白名单）、VLAN/隔离说明、连通性自检脚本 | netsec 脚本 + 说明 |
| D7 | 集成联调（对 Mock）、写《接口规范 v0.1》、评审；若已具备机器人+网络+飞书 API 表，则做真机冒烟 | 评审稿 + 演示 |

---

## 六、一周内能把接口定义到什么程度（直接回答）

**结论：一周内可以把"接口外壳 + 契约"完全定稿并可离线验证；但"payload 业务正确性"要等飞书命令页字段。**

具体边界：

✅ **一周内能做到（确定）**
- 全部 `.msg/.srv/.action` 的**字段、类型、命名空间、QoS、频率、发布/订阅方向**全部定死并 `colcon build` 通过。
- 每个接口的**语义契约文档**：谁调用、谁实现、成功/失败语义、错误码。
- 用 `mock_robokit_server` 把 bridge 跑通，**Topic/Service/Action 三层接口在离线环境端到端联通**（发请求→Mock 回响应→ROS2 侧正确转成话题/服务结果/动作反馈）。
- 模块间通信的**接线与 launch**完成，其它业务模块可以用桩节点对接你的接口。
- 网络安全脚本（端口白名单 + 自检）完成。

⚠️ **一周内做不到（依赖外部）**
- 真机端到端验证：需要 (a) 你的域控能 TCP 连到机器人 API 端口；(b) 飞书里各命令页（多维表格）的**精确编号 + 请求/响应字段**。
- 接口内部"payload 怎么填"的最终定稿：例如 `3051` 入参是站点 ID 还是世界坐标、`Navigate.action` 的 goal 到底用 `target_id` 还是 `target_pose`、状态码枚举值——这些要等 API 字段确认。
- 因此：**接口"外壳"一周定稿可测；"业务映射"留待飞书表格到位后 1~2 天补齐**。

> 实操建议：D1 就把 `Query.srv`（api_type + json 透传）作为"万能通道"先立起来。这样即使具体 srv 还没定细，你也能在真机一联通就先调通所有读命令，再逐步把常用命令固化成专用 Service/Action。

---

## 七、前置条件 / 阻塞项
1. **飞书 API 字段表**：各命令页多维表格（含《API概览》总索引）。这是补齐 payload 映射的唯一来源——建议本周内先导出/复制。
2. **网络与机器人访问**：你的域控到机器人 API 端口的可达性（IP/端口/防火墙）。
3. **协议细节待确认**：字节序（大端/小端）、保留区路由/压缩用法——对照官方 Qt 测试工具源码确认。

---

## 八、网络安全脚本范围（你的职责）
- 域控 A（你的 ROS2）↔ 域控 B（机器人 Robokit）之间：仅放行
  - 机器人 **API TCP 端口**（如模型文件配置值）；
  - ROS2 **DDS  discovery/数据端口**（默认 UDP 7400/7401 或 FastDDS 配置端口，按你用的 RMW 定）。
- 默认拒绝其它一切入站；出方向按需。
- 提供 `check_connectivity.sh`：测 API 端口可达 + DDS 组播/单播通。
- 文档说明：两台域控 `ROS_DOMAIN_ID` 如何设置以避免与机器人侧 ROS（若有）冲突。

---

## 九、交付物清单（一周末）
- [ ] `agv_interfaces`（全部 .msg/.srv/.action，build 通过）
- [ ] `robokit_bridge`（client + bridge_node + mock + navigate action）
- [ ] 《AGV ROS2 接口规范 v0.1》（含本文件第四节内容）
- [ ] launch / params 配置
- [ ] 网络安全脚本 + 连通性自检 + 隔离说明
- [ ] （可选）真机冒烟测试报告
