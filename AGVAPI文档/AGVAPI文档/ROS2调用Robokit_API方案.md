# ROS2 调用 Robokit TCP API 方案（双域控桥接）

> 适用场景：你是 ROS 开发方，**没有机器人的操作系统用户名/密码，进不去机器**，只能通过 Robokit 开放的 **TCP API** 与机器人交互。
> 你的域控（运行 ROS2）与机器人自身的域控（运行 Robokit）是**两台独立域控**，你的 ROS2 节点作为 **TCP 客户端** 去连机器人开放的 API 端口。
> 本文档结合《Robokit API 通信协议》知识库，给出架构、协议编解码、ROS2 接口映射与可运行骨架。

---

## 一、总体架构与拓扑（双域控）

```
┌─────────────────────────────┐         TCP (Robokit API)        ┌─────────────────────────────┐
│   你的域控 (Domain Controller A) │  ───────────────────────────►  │  机器人自身域控 (Domain Controller B) │
│   - ROS2 (rclpy / rclcpp)         │   host=机器人IP               │   - Robokit 运行时                 │
│   - robokit_bridge 节点           │   port=API端口(如模型文件配置) │   - 作为 TCP Server 接收请求         │
│     · TCP Client ───────────────┼── 请求/响应(request/response) ──┼─> 控制/查询机器人本体               │
│     · 翻译 ROS2 ↔ Robokit        │                                │                                 │
└─────────────────────────────┘                                    └─────────────────────────────┘
```

要点：
- 机器人（Robokit）是 **TCP Server**；你的 ROS2 节点是 **TCP Client**。
- 两者是两台独立域控，网络互通即可。**你不需要机器人的系统账号**，API 本身是基于 TCP 的问答式接口（见"为什么不需要密码"）。
- ROS2 这边只认 DDS（话题/服务/动作）；机器人那边只认自己的 TCP 协议。中间的 `robokit_bridge` 节点负责**双向翻译**。

---

## 二、为什么不需要机器用户名/密码

- Robokit API 是 **TCP request/response** 协议：客户端连上 API 端口后，按报文头 + JSON 数据区发请求，机器人返回响应（见知识库《API简介》）。
- 知识库《TCP client 模式》说明：机器人在模型文件里配置 `TCPClient`（ip/端口/超时/重连），连接成功后**主动发一个 JSON 握手**，之后服务端（此处指对端）即可主动发请求。反过来说，你的域控作为客户端连上后，直接发 API 请求即可，**全程不涉及操作系统登录**。
- 所以你的"没有用户名/密码进不去"恰好被 API 路径绕开了：你根本不需要进系统，只要网络能到 API 端口，就能控制/查询机器人。
- ⚠️ 安全提醒：这意味着 API 端口一旦暴露在不信任网络就可能被任意调用。生产环境应通过**网络隔离 / 防火墙 / VLAN** 限制可连 IP，而不是靠系统密码。

---

## 三、通信协议回顾（桥接必须实现）

### 3.1 报文头（ProtocolHeader，共 16 字节）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| 报文同步头 `m_sync` | uint8 | 固定 `0x5A`，标识头部开始 |
| 协议版本 `m_version` | uint8 | RBK3.4=0x01，RBK3.5=0x02 |
| 序号 `m_number` | uint16 | 请求/响应一致（0~65535），由调用方自填 |
| 数据总长度 `m_length` | uint32 | 数据区(JSON)字节长度 |
| 报文类型/编号 `m_type` | uint16 | API 编号 |
| 内部使用区域 `m_reserved[6]` | uint8[6] | 基础用法填 0；第3、4字节为路由区长度，第5字节为压缩类型 |

对应 C 结构：
```c
struct ProtocolHeader {
    uint8_t  m_sync;        // 0x5A
    uint8_t  m_version;     // 0x01 / 0x02
    uint16_t m_number;      // 序号
    uint32_t m_length;      // 数据总长度
    uint16_t m_type;        // 报文类型/API 编号
    uint8_t  m_reserved[6]; // 内部使用区域
};
```

### 3.2 请求 / 响应规律（来自《注意事项》）
- **响应编号 = 请求编号 + 10000（0x2710）**，请求与响应一一对应。
- 所有未说明数值用国际单位（m / rad / m/s）。
- **不要发送非 ASCII 字符**：尤其地图名含中文会被视为非法。
- 响应 JSON 的 key 顺序不保证；出现 API 未提及的 key 可直接忽略。

### 3.3 已知导航相关 API 编号（来自《API使用教程》）
| 编号 | 含义 |
| --- | --- |
| 2002 | 重定位 |
| 1021 | 查询定位状态 |
| 2003 | 确认定位（RBK ≥ 3.4.6.18 可省略） |
| 3051 | 执行路径导航 |
| 1020 | 查询导航状态 |

> 注意：每个具体 API 的**精确编号、请求/响应字段**在知识库的「多维表格 / 各命令页」中（如《API概览》总索引、《机器人控制API》《机器人状态API》等）。本桥接方案用 `api_type` 参数化，实际填表时从那些页面取编号与字段即可。

---

## 四、ROS2 桥接节点设计

### 4.1 节点职责（`robokit_bridge`）
1. 启动时建立并保活到机器人的 TCP 长连接。
2. 实现 `ProtocolHeader` 的打包 / 解包（见第五节代码）。
3. 发送请求时自增 `seq`，响应回来后按 `seq` + `type(=req+10000)` 配对。
4. 把 Robokit 能力翻译成 ROS2 接口（话题/服务/动作）。

### 4.2 接口映射：能实现什么功能

| Robokit 分类 | 代表命令 | ROS2 接口 | 实现功能 |
| --- | --- | --- | --- |
| 机器人状态API（查询） | 查询位置/速度/电池/IO/IMU/超声/PGV/急停/编码器/电机/点云…（共 19 条） | **Topic**（定时轮询后发布） | 实时监控位姿、速度、电量、IO、IMU、急停等 |
| 机器人控制API | 运动 / 停止 / 急停等 | **Service** 或 **Topic**(cmd) | 运动控制、急停 |
| 机器人导航API | 3051 执行路径导航 / 1020 查导航状态 / 2002 重定位 / 1021 查定位 / 2003 确认定位 | **Action**（NavigateToPose 风格） | 自主导航、重定位、确认定位 |
| 机器人配置API | 文件/脚本/机械臂/标定/参数 | **Service** | 配置下发、脚本执行、机械臂控制、标定 |
| 其他API | 透传 / 代价地图等 | **Service / Topic** | 高级功能 |
| 机器人推送API | 机器人主动推送 | **Topic**（订阅推送） | 实时接收机器人推送数据 |
| ModbusTcp API | 寄存器读写 [0x/1x/3x/4x] | **Service** | 读写 Modbus 寄存器 |

### 4.3 推荐 ROS2 接口清单（示例）
- 发布（Topics，周期查询后发布）：
  - `/robokit/pose`（位姿 x,y,r）、`/robokit/speed`、`/robokit/battery`、`/robokit/io`、`/robokit/imu`、`/robokit/status`（含急停/阻挡）
- 服务（Services，按需调用）：
  - `/robokit/control`（自定义 srv：控制指令）
  - `/robokit/query`（通用查询：输入 api_type + json，返回 json）
  - `/robokit/modbus_read` / `/robokit/modbus_write`
  - `/robokit/script_run` / `/robokit/arm_control`
- 动作（Action，长任务）：
  - `/robokit/navigate`（目标=路径/站点；反馈=导航状态；结果=完成/失败）

---

## 五、协议编解码实现（Python 示例）

> ⚠️ 字节序（大端 `>` 还是小端 `<`）需对照官方开源测试工具（Qt 源码）或示例确认。下面以 `<` 为占位，请实测后修正 `ENDIAN`。

```python
import socket, struct, json, threading, time

SYNC = 0x5A
ENDIAN = '<'                       # TODO: 对照官方示例确认字节序
HEADER_FMT = ENDIAN + 'BBHIB6s'    # sync, version, number, length, type, reserved
HEADER_SIZE = 16

class RobokitClient:
    def __init__(self, host, port, version=0x01, timeout=5.0):
        self.sock = socket.create_connection((host, port), timeout=timeout)
        self.seq = 0
        self.version = version
        self._lock = threading.Lock()
        self._pending = {}           # api_type -> (result_dict, Event)
        threading.Thread(target=self._recv_loop, daemon=True).start()

    # ---- 收 ----
    def _recv_exact(self, n):
        buf = b''
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError('robokit disconnected')
            buf += chunk
        return buf

    def _recv_loop(self):
        while True:
            try:
                hdr = self._recv_exact(HEADER_SIZE)
                sync, ver, num, length, mtype, reserved = struct.unpack(HEADER_FMT, hdr)
                body = self._recv_exact(length) if length else b''
                payload = json.loads(body.decode('utf-8')) if body else {}
                req_type = mtype - 10000          # 响应编号 = 请求编号 + 10000
                with self._lock:
                    item = self._pending.pop(req_type, None)
                if item:
                    result, evt = item
                    result.update(payload)
                    evt.set()
            except Exception:
                time.sleep(0.1)

    # ---- 发 ----
    def request(self, api_type, payload, timeout=5.0):
        with self._lock:
            self.seq = (self.seq + 1) % 65536
            seq = self.seq
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        # 保留区基础用法填 0；路由/压缩用到时再置位
        hdr = struct.pack(HEADER_FMT, SYNC, self.version, seq, len(data), api_type, b'\x00'*6)
        evt = threading.Event(); result = {}
        with self._lock:
            self._pending[api_type] = (result, evt)
            self.sock.sendall(hdr + data)
        if not evt.wait(timeout):
            raise TimeoutError(f'robokit api {api_type} timeout')
        return dict(result)
```

---

## 六、ROS2 节点骨架（rclpy）

```python
import rclpy
from rclpy.node import Node
from rclpy.action import ActionServer
from std_msgs.msg import String
# 按需 import 自定义 srv/msg/action

from robokit_bridge.robokit_client import RobokitClient  # 见第五节

class RobokitBridge(Node):
    def __init__(self):
        super().__init__('robokit_bridge')
        # 参数：机器人 IP / 端口 / 版本
        self.declare_parameter('host', '192.168.1.10')
        self.declare_parameter('port', 19204)            # 以模型文件实际配置为准
        self.declare_parameter('version', 1)
        host = self.get_parameter('host').value
        port = self.get_parameter('port').value
        ver  = self.get_parameter('version').value

        self.client = RobokitClient(host, port, version=ver)
        self.get_logger().info(f'connected to robokit {host}:{port}')

        # 示例：发布位姿话题（定时查询"查询机器人位置"API，编号见对应命令页）
        self.pose_pub = self.create_publisher(String, '/robokit/pose', 10)
        self.create_timer(0.5, self._pub_pose)

        # 示例：通用查询服务
        # self.srv = self.create_service(Query, '/robokit/query', self._on_query)

    def _pub_pose(self):
        # 这里的 API 编号需替换为"查询机器人位置"的真实编号
        try:
            resp = self.client.request(API_QUERY_POSITION, {})
            msg = String(); msg.data = str(resp); self.pose_pub.publish(msg)
        except Exception as e:
            self.get_logger().warn(f'query pose failed: {e}')

    # def _on_query(self, req, resp):
    #     resp.json = json.dumps(self.client.request(req.api_type, json.loads(req.json)))
    #     return resp

def main(args=None):
    rclpy.init(args=args)
    rclpy.spin(RobokitBridge())
    rclpy.shutdown()

if __name__ == '__main__':
    main()
```

### 导航 Action 思路（对应 2002→1021→2003→3051→1020 流程）
把《API使用教程》的连续路径导航流程封装成一个 ROS2 Action：
1. 收到目标（路径/站点）→ 调用 **2002 重定位**；
2. 周期性调用 **1021 查询定位状态**，反馈"定位中/完成"；
3. 定位完成 → 调用 **2003 确认定位**（≥3.4.6.18 可省）；
4. 调用 **3051 执行路径导航**；
5. 周期性调用 **1020 查询导航状态** 作为 Action 反馈，直到完成 → Action 返回结果。

---

## 七、部署与注意事项

1. **ROS_DOMAIN_ID**：你的域控与机器人域控是独立的；若机器人域控也跑 ROS，请确保两台机器的 `ROS_DOMAIN_ID` 不冲突（或网络隔离），避免 DDS 互相发现。你的桥接节点用你自己的域 ID。
2. **网络**：你的域控必须能 TCP 直连机器人 API 端口（防火墙放行、同网段或路由可达）。
3. **字节序**：`ENDIAN` 必须对照官方示例确认（见第五节 TODO），否则头部解析错位。
4. **序号与配对**：响应按 `seq` + `type(req+10000)` 配对；并发请求要加锁（示例已处理）。
5. **非 ASCII 禁用**：地图名等字段不要传中文（《注意事项》第 3 条）。
6. **JSON key 顺序无关**：解析时按 key 取值，不要依赖顺序；未知 key 忽略。
7. **线程模型**：TCP 收包放在独立守护线程，`rclpy.spin` 在主线程；服务/动作回调里调用 `client.request` 是阻塞的，长任务建议放到 `executor` / 线程，避免阻塞回调。

---

## 八、落地步骤建议
1. 在飞书里把《API概览》及各命令页（多维表格）导出/复制，得到**每个 API 的精确编号 + 请求/响应字段**，填进桥接层的查表结构。
2. 先用官方 Qt 测试工具或 Python 脚本**直连机器人**验证一条查询（如查询位置），确认字节序与报文格式。
3. 实现 `RobokitClient`（第五节），单元自测请求/响应配对。
4. 在 ROS2 包里封装话题/服务/动作（第四节、第六节）。
5. 先做"状态上云"（位置/电量/IO 上话题），再做"控制/导航"，最后接机械臂/脚本/Modbus。

> 本方案仅依赖知识库中可读取的协议框架（《API简介》《API报文结构》《坐标系》《注意事项》《TCP client 模式》《API使用教程》）。各命令的精确字段以飞书多维表格为准。
