# AGV Web v0.5 — Widget UI + xArm7 Bridge 集成报告

**日期:** 2026-08-14  
**版本:** dashboard `0.5.0` / Web `v0.5`

---

## 新增 / 修改文件

| 文件 | 状态 | 说明 |
|------|------|------|
| `agv_bridge/agv_bridge/arm_bridge.py` | **新增** | xArm7 ROS2 桥接（Service + Topic + 心跳） |
| `delivery_web/delivery_web/arm/manager.py` | **修改** | 集成 ArmBridge，新增 unlock/pick_place/gripper API |
| `delivery_web/delivery_web/dashboard_node.py` | **修改** | v0.5.0 + 7 个机械臂 HTTP 端点 + AGV 联动检查 |
| `delivery_web/www/widgets.js` | **新增** | WidgetManager（拖拽/缩放/关闭/localStorage） |
| `delivery_web/www/arm_widget.js` | **新增** | 机械臂控制卡片（状态/进度/关节/按钮/日志） |
| `delivery_web/www/index.html` | **大改** | 地图全屏 + 悬浮毛玻璃组件 +「添加组件」 |

---

## arm_bridge.py 接口

### ROS2 订阅
- `/pick_place_state` (`std_msgs/String`) — 纯文本状态
- `/joint_states` (`sensor_msgs/JointState`) — 7 关节

### ROS2 Service 客户端
- `/unlock_and_home` (`std_srvs/Trigger`)
- `/do_pick_place` (`std_srvs/Trigger`)
- `/set_gripper` (`std_srvs/SetBool`)

### Python API
| 方法 | 说明 |
|------|------|
| `get_status()` | 综合状态（online/state/block/joints/gripper/history） |
| `get_pose()` | 关节角度 |
| `call_unlock(timeout=30)` | 解锁归位 |
| `call_pick_place(cycles, timeout=120)` | 触发抓取 |
| `call_gripper(open_command, timeout=5)` | 夹爪开/合 |
| `set_cycles(n)` | 设置 cycles 参数 |
| `call_stop()` | 预留（当前返回未实现） |
| `parse_pick_place_state(msg)` | B01–B11 文本解析 |

### 在线检测
- 收到 Topic 数据 → 在线
- **5 秒**无数据 → 离线
- 离线时 Service 调用立即失败，不阻塞

---

## HTTP API（新增）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/arm/status` | GET | 综合状态（含 uptime） |
| `/api/arm/pose` | GET | 关节角度 |
| `/api/arm/unlock` | POST | 解锁归位（30s 超时） |
| `/api/arm/pick_place` | POST | `{"cycles":1}` 抓取（120s） |
| `/api/arm/gripper` | GET | 夹爪状态推断 |
| `/api/arm/gripper` | POST | `{"open":true}` 控制夹爪 |
| `/api/arm/cycles` | POST | 设置 cycles |
| `/api/arm/stop` | POST | 停止（预留） |

**AGV 联动安全：** `pick_place` / `unlock` / `gripper` 前检查：
- `_route_task.running` 或 `task_status in (2,3,5)` 或速度 > 0.05 → 拒绝

**真实运动门控：** 需 `ARM_REAL_MOTION=1` 且 `ARM_MODE=real`

---

## Web Widget 系统

### 可用组件
| ID | 标题 |
|----|------|
| `floor_qr` | Floor QR |
| `wrist_camera` | Wrist Camera |
| `leo_camera` | Leo Face |
| `arm_control` | 机械臂控制 |
| `agv_status` | AGV 状态 |
| `nav_control` | 导航控制 |
| `pointcloud_settings` | 点云设置 |
| `operation_log` | 操作日志 |

### 交互
- 标题栏拖拽移动
- 右下角调整大小
- `—` 最小化 / `×` 关闭
- 双击标题栏切换透明度
- 布局保存至 `localStorage` (`agv_widget_layout_v05`)
- 右上角 **「+ 添加组件」**

---

## 测试状态

| 项目 | 状态 |
|------|------|
| arm_bridge 代码 | **CODE VERIFIED** |
| HTTP 端点接线 | **CODE VERIFIED** |
| Widget UI 框架 | **CODE VERIFIED** |
| Mock 模式 Web | **NOT TESTED**（本机未跑 dashboard） |
| VM 部署 | **NOT TESTED** |
| NUC 跨机 DDS | **NOT TESTED** |
| 真实 pick_place/unlock | **BLOCKED**（需 ARM_REAL_MOTION=1 + NUC 节点） |

---

## VM 部署步骤

```bash
# 同步代码到 VM 后
docker exec delivery_gazebo_soft bash -lc '
  cd /path/to/workspace_v02/ros2_ws
  source /opt/ros/humble/setup.bash
  colcon build --packages-select agv_bridge delivery_web --symlink-install
  source install/setup.bash
  pkill -9 -f delivery_web/dashboard_node; sleep 2
  export ROS_DOMAIN_ID=30 DELIVERY_ENV=mock ARM_MODE=simulation
  nohup ros2 run delivery_web dashboard_node >> /var/log/delivery/dashboard_node.log 2>&1 &
'
```

### 跨机验证（NUC 机械臂）
```bash
export ROS_DOMAIN_ID=30
ros2 node list          # 预期 /pick_place_server
ros2 topic echo /joint_states --once
ros2 service call /set_gripper std_srvs/srv/SetBool "{data: true}"
```

### 真实机械臂联调
```bash
export ARM_MODE=real ARM_REAL_MOTION=1 ROS_DOMAIN_ID=30
```

---

## 已知问题 / 后续建议

1. **机械臂软停止** — Zack 侧无 Service，`/api/arm/stop` 仅返回提示
2. **夹爪 success 陷阱** — `pick_place` 成功不代表夹爪成功，前端已警告
3. **导航 Widget** — 克隆 ops 面板，部分控件与隐藏原面板 ID 同步，复杂操作仍可用页头/原逻辑
4. **相机 B / Leo** — Leo 仍为 DEVELOPING；Camera-B 端点待确认
5. **性能** — 多 Widget 同时轮询时注意 HTTP backlog；机械臂执行中 500ms 轮询
6. **Stitch 设计稿** — API 网络失败，UI 按 TRAE spec 手工实现

---

## 致命坑点提醒

> `do_pick_place` 返回 `success=True` **不代表夹爪抓取成功**。  
> Web 抓取完成后必须人工确认物体是否已抓取。
