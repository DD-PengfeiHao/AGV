# AGV 实车 Web V2 — 最终完整提示词

> **使用方法**：将本文档完整发给 Cursor AI 执行。
> **参考概念图**：
> - [总览界面草图 V2 (AMB-150)](computer://c:\Users\Administrator\Cursor\AGV\AGVAPI文档\项目材料\concept_overview_v2.jpg)
> - [BEV界面草图 V2 (AMB-150)](computer://c:\Users\Administrator\Cursor\AGV\AGVAPI文档\项目材料\concept_bev_v2.jpg)
> - [组件详细清单](computer://c:\Users\Administrator\Cursor\AGV\AGVAPI文档\项目材料\AGV_Web_V2_组件详细清单.md)
>
> **API 文档目录**：`C:\Users\Administrator\Cursor\AGV\AGVAPI文档\AGVAPI文档`（211 个 API 文件）
>
> **车辆模型文件**：`C:\Users\Administrator\Desktop\DD部门AGV项目\AGV_Delivery_v0.2.0_20260807_0921\agv_downloaded\models\robot.model`（795KB）

---

## 零、设计风格规范（不可违反）

### 0.1 设计令牌

```css
:root {
  --font-primary: 'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;

  --bg: #FFFFFF;
  --surface: #F7F8FA;
  --gradient-bg: linear-gradient(180deg, #F7F8FA 0%, #FFFFFF 100%);

  --text: #2D2D2D;
  --muted: #6B7280;
  --brand-black: #111111;
  --line: #E5E7EB;

  --accent: #E5364A;        /* 品牌红 */
  --accent2: #C42B3D;
  --accent-light: #FF6B7A;
  --agv: #E5364A;

  --ok: #10B981;             /* 绿 — 正常 */
  --warn: #F59E0B;           /* 黄 — 警告 */
  --bad: #EF4444;            /* 红 — 严重 */
  --info: #3B82F6;           /* 蓝 — 提示 */

  --glass-bg: rgba(255, 255, 255, 0.3);   /* 卡片30%不透明 */
  --glass-border: rgba(255, 255, 255, 0.5);
  --shadow-glass: 0 4px 24px rgba(0, 0, 0, 0.06);

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --header-h: 56px;
}
```

### 0.2 字体

| 用途 | 字体 | 回退 |
|------|------|------|
| 全局正文/标题 | Inter (400/500/600/700) | -apple-system, PingFang SC, Microsoft YaHei |
| 数字/坐标/错误码 | JetBrains Mono | Fira Code, Cascadia Code, Consolas |
| **禁止使用** | Arial、Helvetica、宋体、SimSun | — |

Google Fonts CDN：
```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
```

### 0.3 颜色规则

- **背景**：亮色主题，白色/浅灰 `#F7F8FA`，**禁止暗色主题**
- **AGV 图标**：品牌红 `#E5364A`
- **规划路径**：红色虚线
- **历史轨迹**：灰色半透明
- **目标点**：红色圆环
- **站点标注**：黑色文字
- **网格线**：`rgba(0,0,0,0.04)` 极淡
- **Camera FOV**：蓝色半透明扇形

### 0.4 点云颜色（关键）

| 元素 | 颜色 | 说明 |
|------|------|------|
| 地图点云 | 灰色 `#8a8a8a` ~ `#b0b0b0` | 静态地图数据 |
| LiDAR 近距离 | **红色** `#EF4444` | 离 AGV 最近，最危险 |
| LiDAR 中距离 | **黄色** `#F59E0B` | 中等距离 |
| LiDAR 远距离 | **黑色** `#000000` | 最远，最不危险 |
| 渐变 | 红→黄→黑 | 按距离平滑过渡，不是硬切换 |

**绝对禁止**：BEV/Overview 使用暗色背景。点云必须渲染在亮色背景上。

### 0.5 车辆模型（AMB-150）

**模型文件**：`C:\Users\Administrator\Desktop\DD部门AGV项目\AGV_Delivery_v0.2.0_20260807_0921\agv_downloaded\models\robot.model`

| 属性 | 值 |
|------|-----|
| 车型 | AMB-150 |
| 外形 | 矩形 (rectangle) |
| 宽度 | 0.572 m |
| 驱动方式 | 差速驱动 (differential drive) |
| 轮径 | 0.0797 m |
| CAN 总线 | CAN1 (250K), CAN2 (250K) |
| 顶升机构 | 有 (jack) |
| 货叉机构 | 有 (fork) |
| 辊筒机构 | 有 (roller) |

**AGV 图标渲染规则**：
- 总览界面：俯视图，红色矩形 `#E5364A`，前部有朝向箭头，两侧有两个小黑色矩形（驱动轮）
- BEV 界面：第三人称视角，红色矩形车身 + 货叉前伸 + 驱动轮可见
- 尺寸比例：宽:长 ≈ 0.572:1.0（按实际比例渲染）
- 颜色：品牌红 `#E5364A`，边框 `#C42B3D`

同目录其他模型文件：
- `safe.model` — 安全模型
- `action.model` — 动作模型
- `robot.cp` — 成本参数
- `joystick_keymap.json` — 摇杆键映射

### 0.6 卡片透明度

**所有卡片半透明，不透明度 30%**。实现方式：
```css
.widget-card {
  background: rgba(255, 255, 255, 0.3);   /* 背景30% */
  backdrop-filter: blur(8px);
  /* 文字保持完全不透明，确保可读 */
}
.widget-card .card-title,
.widget-card .card-body,
.widget-card .card-value {
  opacity: 1;  /* 文字不受整体透明度影响 */
}
```

---

## 一、两个独立界面

Web 端有 **两个独立的全屏主界面**：总览界面 和 BEV 界面。

### 1.1 界面切换

- 打开 Web 端默认进入 **总览界面**，不要求登录
- Header 右侧、「重启关联件」按钮左边，有切换按钮：
  - 在总览界面时，按钮显示 **「BEV」**，点击切换到 BEV
  - 在 BEV 界面时，按钮显示 **「总览」**，点击切换到总览
- **只有登录管理员后可以切换到 BEV 界面**
- 未登录或非管理员：不显示 BEV 切换按钮
- 切换时：隐藏一个界面，显示另一个，不销毁组件状态

### 1.2 总览界面

- **全屏俯视地图**，与之前一样的风格
- **组件悬浮在地图上方**，半透明(30%)，可拖拽移动，可点 × 关闭
- 地图可缩放、平移
- 不做固定布局，不做分区，保持自由拖拽
- 地图元素：墙壁深灰 `#333`，站点黑色标注，路径红色虚线，AGV 红色

### 1.3 BEV 界面（第三人称视角）

BEV = 第三人称视角看车，**也是全屏画面**，组件悬浮在 BEV 画面上方（与总览一致的布局方式）。

**视觉效果**：
- 全屏 BEV Canvas，AGV 在视图中心，第三人称视角
- 如果有地图数据，BEV 中也会加载地图
- 地图点云：灰色
- LiDAR 实时扫描：近→**红**，中→**黄**，远→**黑**，渐变过渡
- AGV 图标红色，带朝向指示
- 规划路径：红色虚线
- Camera FOV：蓝色半透明扇形
- 网格线：`rgba(0,0,0,0.04)` 极淡

**鼠标交互**：
- **鼠标左键按住拖动**：左右、上下、左上、左下、右上、右下不同方向拖动，视角跟着变（轨道旋转）
- **3 秒无鼠标操作**：自动恢复到默认视角（setTimeout + clearTimeout）
- **鼠标滚轮**：逆时针滚动 = 缩小（看更广），顺时针滚动 = 放大
- **缩放有上下限**：不能无限放大或无限缩小
- **鼠标右键**：Pan（平移），需 preventDefault 浏览器默认行为
- **双击 AGV**：回到车辆中心 + 默认视角

**视角绑定**：
- 有「视角绑定」开关
- 绑定：相机跟随 AGV 移动
- 解绑：相机固定，车辆移动但视角不跟随

**BEV 图层开关**（可折叠面板，作为悬浮卡片）：
- AGV（默认开）
- 地图点云（默认开）
- LiDAR 实时扫描（默认开）
- 规划路径（默认开）
- 历史轨迹（默认关）
- 目标点（默认开）
- Camera FOV（默认关）
- 超声波（默认关，有数据才显示）

**关键隔离**：BEV 鼠标操作只修改 Camera state，**绝对不能向 `/cmd_vel` 发送任何指令**。

---

## 二、登录与权限体系

### 2.1 登录入口

- **不要独立的登录/注册/退出按钮**
- 点击左上角 **LOGO** = 弹出登录面板
- 登录面板从 **左侧滑入**（不是居中），类似组件列表
- 打开 Web 端直接进入总览界面，不要求登录
- **只有使用功能时才需要登录**（如切换 BEV、执行控制操作、访问 Debug）
- 输入不同用户名进入不同用户之前保存的布局（组件摆放位置跨电脑同步）
- 输入管理员直接进入管理员模式，**不要弹"是否管理员"提示**

### 2.2 三个用户分组

| 分组 | 权限 |
|------|------|
| **管理员** | 全部功能，包括 BEV、Debug 组件、用户管理、重启系统/关联件 |
| **开发** | 可单独调用组件（除 Debug），三级提示（error/warning/info）可用，可重启系统/关联件 |
| **用户** | 只能使用基本组件，三级提示改为友好措辞（不显示技术错误码），不可重启，不可 BEV |

### 2.3 非管理员隐藏

- 非管理员：Debug 组件 **直接不显示**（不是灰掉，是完全不存在）
- 非管理员：BEV 切换按钮 **不显示**
- 非管理员：重启系统/重启关联件按钮 **不显示**
- 不能让人知道有这些隐藏功能的存在

### 2.4 管理员左侧面板

点击 LOGO 后，左侧滑入面板内容（管理员视角）：

```
┌─────────────────────┐
│ 用户管理             │
│ ├─ 注册新用户        │
│ ├─ 删除用户          │
│ ├─ 退出登录          │
│                     │
│ 分组管理             │
│ ├─ 管理员 [3]        │
│ ├─ 开发    [5]       │
│ ├─ 用户    [8]       │
│ （拖动用户到不同分组） │
│                     │
│ 系统操作             │
│ ├─ 重启系统          │
│ ├─ 重启关联件        │
└─────────────────────┘
```

- 三个分组预设：管理员、开发、用户
- 管理员可以拖动用户到不同分组来修改分组
- 只有管理员能看到这个管理面板

### 2.5 布局持久化

- 每个用户的组件摆放位置（哪些组件打开、位置坐标）保存到后端
- 用户在 A 电脑摆放好组件，换 B 电脑登录后布局一致
- 后端 API：`POST /api/user/layout` 保存，`GET /api/user/layout` 读取

---

## 三、组件系统（卡片）

### 3.1 核心原则

- **所有卡片半透明（30% 不透明度）**，文字保持可读
- **卡片可移动**（拖拽）
- **卡片可关闭**（右上角 × 按钮）
- **没有缩小按钮**（已废弃，删除所有 minimize 相关代码）
- 组件越来越多，需要 **分类**

### 3.2 组件分类（11 个分组，72+ 个组件）

| 分组 | 组件数 | 权限 |
|------|--------|------|
| AGV | 7 | 全部可见 |
| 导航 | 8 | 全部可见 |
| 运动 | 7 | 全部可见 |
| 感知 | 6 | 全部可见 |
| 相机 | 3 | 全部可见 |
| 视觉识别 | 4 | 全部可见 |
| 机械臂 | 8 | 全部可见 |
| 底盘机构 | 4 | 按车型显示 |
| 系统 | 7 | 全部可见 |
| 警报事件 | 3 | 全部可见 |
| Debug | 15+ | 仅管理员 |

**完整组件清单见**：[AGV_Web_V2_组件详细清单.md](computer://c:\Users\Administrator\Cursor\AGV\AGVAPI文档\项目材料\AGV_Web_V2_组件详细清单.md)

以下列出每个分组的组件（含 API 数据源）：

#### AGV 分组（7个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| AGV 状态 | `/api/state` → `agv` | task_status, target_id, x, y, angle, confidence, current_station |
| AGV 电池 | `/api/state` → `agv` | battery_level, charging, battery_temp, battery_cycle |
| AGV 安全 | `/api/state` → `agv` | blocked, emergency, soft_emc, brake, driver_emc |
| AGV 任务状态 | `/api/state` → `agv` | task_status, task_type, target_id, finished_path[], unfinished_path[], move_status_info |
| AGV I/O | Robokit: 查询IO数据 | DI[0-5], DO[0-8], source, status, valid |
| AGV IMU | Robokit: 查询IMU数据 | acc_x, acc_y, acc_z, angular_velocity |
| AGV 速度 | Robokit: 1005 查询速度 | vx, vy, angular_velocity, r_vx, r_vy, r_w |

#### 导航分组（8个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 导航控制 | `POST /api/navigate`, `POST /api/cancel` | target_id 选择, 导航/取消/暂停/继续 |
| 路径状态 | `/api/state` → `agv` + `/api/route/status` | unfinished_path, finished_path, route |
| 定位状态 | Robokit: 1021 | reloc_status, confidence, reloc_length |
| 站点管理 | `GET /api/stations`, `POST /api/stations/*` | 站点列表(x,y,yaw), 添加/删除/重命名/连接 |
| 地图管理 | `GET /api/maps/robot`, `POST /api/maps/switch` | 当前地图, 可用列表, 切换/刷新/上传/下载 |
| 任务链管理 | Robokit: 查询/执行任务链 | 任务链列表, 执行, 查询, 清除 |
| 跟踪状态 | Robokit: 1100 | tracking_status, tracking_error, running_status |
| 路径规划 | Robokit: 1303, 1301 | global_path, local_path, replanning |

#### 运动分组（7个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 速度曲线 | `/api/state` → `telemetry` | vx, vy, angular_velocity 实时曲线 |
| 纵向加速度 | `/api/state` → `telemetry` | a_longitudinal 曲线 + 阈值区间 |
| 横向加速度 | `/api/state` → `telemetry` | a_lateral 曲线 + 阈值区间 |
| 纵向 Jerk | `/api/state` → `telemetry` | jerk_longitudinal 曲线 |
| 横向 Jerk | `/api/state` → `telemetry` | jerk_lateral 曲线 |
| 角运动 | `/api/state` → `telemetry` | yaw_rate, yaw_acceleration 曲线 |
| 跟踪误差 | `/api/state` → `telemetry` | tracking_error 曲线 |

#### 感知分组（6个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| LiDAR 点云 | `/api/state` → `laser` | points[], beam_count, live_lidar |
| 超声波传感器 | Robokit: 查询超声数据 | ultrasonic[], distance, valid |
| 障碍物检测 | `/api/state` → `obstacles` + Robokit | obstacle_list[], id, x, y, w, h |
| 代价地图 | Robokit: 查询代价地图 | cost_map_grid, inflation_radius |
| 库位检测 | Robokit: 库位检测 | slot_status, slot_id, slot_position |
| RFID 数据 | Robokit: 查询RFID | rfid_data, rfid_valid |

#### 相机分组（3个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| Jason Camera-A | `/api/vision/wrist_camera/snapshot` | JPEG 快照, QR 结果, FPS |
| Jason Camera-B (腕部) | `/api/vision/wrist_camera/snapshot` | JPEG 快照, QR/AprilTag, FPS |
| Leo Camera (人脸) | `/api/vision/leo_face/status` | JPEG 快照, person_name, confidence, FPS |

#### 视觉识别分组（4个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 人脸识别 | `POST /api/vision/leo_face/trigger` | trigger, continuous, person_name, confidence |
| 二维码(QR) | `POST /api/vision/wrist_camera/trigger/qr` | trigger, last_qr_result |
| AprilTag | `POST /api/vision/wrist_camera/trigger/apriltag` | trigger, last_detections |
| 地面 QR | `POST /api/vision/floor_qr/trigger` | trigger, localization_data |

#### 机械臂分组（8个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 机械臂控制 | `POST /api/arm/*` | mode, unlock, pick_place, gripper, stop, cycles |
| 机械臂状态 | `/api/arm/status` | connected, is_moving, error, mode_name |
| 关节状态 | `/api/state` → `arms` | J1-J7 角度, joint_positions[] |
| TCP 位姿 | `/api/arm/pose` | X/Y/Z/Rx/Ry/Rz |
| 夹爪状态 | `/api/arm/gripper` | gripper_state, open/close |
| 抓取任务 | `POST /api/arm/pick_place` | cycles, pick_place_status |
| 机械臂错误 | `/api/state` → `arms` | error, error_msg, error_code |
| 机械臂运动控制 | Robokit: 机械臂运动控制 | arm_motion_cmd, bintask_status |

#### 底盘机构分组（4个，按车型显示）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 顶升机构 | Robokit: 1100 | jack_height, jack_state, jack_speed, jack_isFull |
| 辊筒/皮带 | Robokit: 查询辊筒状态 | roller_state, roller_direction |
| 货叉 | Robokit: 查询货叉状态 | fork_height, fork_state |
| 牵引 | Robokit: 1100 | hook_angle, hook_clamping_state |

**注意**：只显示当前车型具备的机构。

#### 系统分组（7个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 系统监控 | `/api/state` → `nodes_health`, `agv_link` | CPU, MEM, node health, uptime |
| ROS2 节点 | `/api/state` → `nodes_health` | arm_left, arm_right, vision |
| ROS2 Topic 频率 | `/api/state` → `hz` | topic → Hz 列表 |
| API 延迟 | 前端测量 fetch 耗时 | /api/state 响应时间(ms) |
| Docker 状态 | `GET /api/health` | container_name, status |
| 软件版本 | `/api/version` | version, project, stack, ports |
| 控制权管理 | `/api/state` → `env` + Robokit 1060 | current_lock, control_locked, lock_nick |

#### 警报事件分组（3个）
| 组件 | API 数据源 | 显示字段 |
|------|-----------|----------|
| 实时弹窗 | `/api/state` → `alerts` | level, source, code, message, raw |
| 事件时间线 | `/api/state` → `events` | kind, level, event, msg, ts |
| 报警码查询 | 附录: 报警码.docx + API错误码.docx | code → description 映射表 |

#### Debug 分组（15+个，仅管理员）
| 组件 | API 数据源 |
|------|-----------|
| 日志控制台 | `/api/log/recent`, `/api/log/toggle` |
| AGV 诊断快照(1100) | Robokit 1100 批量数据1 |
| ROS2 诊断 | `/api/diag/snapshot` |
| Topic 消息年龄 | 前端计算 |
| 服务状态 | `GET /api/debug` |
| Modbus 读写 | Robokit: 查询/写入modbus |
| 透传数据 | Robokit: 查询/更新透传 |
| 机器人参数 | Robokit: 查询/修改参数 |
| 标定管理 | Robokit: 查询标定状态/列表/文件 |
| 脚本管理 | Robokit: 上传/下载/删除脚本 |
| 文件管理 | Robokit: 上传/下载文件 |
| 地图MD5 | Robokit: 查询地图MD5 |
| 驱动器参数 | Robokit: 查询驱动器参数 |
| 控制权历史 | Robokit: 查询历史控制权 |
| 3D二维码建图 | Robokit: 查询建图3D二维码 |

### 3.3 Debug 是组件内的小卡片

**Debug 不是单独界面**。Debug 是某些组件内部展开后显示的小卡片。

例如：
- AGV 状态组件 → 展开后有 Debug 小卡片显示 `r_vx`、`manualBlock`、`tracking_status`、`dispatch_mode`、`reloc_status`、`fatals[]`、`current_lock`
- 相机组件 → 展开后有 Debug 小卡片显示 `FPS`、`topic Hz`、`frame age`、`cameras_meta`、`detections[]`
- 机械臂组件 → 展开后有 Debug 小卡片显示 `joint_velocity[]`、`joint_torque[]`、`arm_coordinate_transform`、`teach_pendant_status`
- 运动组件 → 展开后有 Debug 小卡片显示 `r_vx vs vx`（导航层 vs 实际速度）、`block_x/block_y/block_reason`、`open_loop_status`
- 系统组件 → 展开后有 Debug 小卡片显示 `tcp_client_info[]`、`controller_temp/humi/voltage`、`script_list[]`、`file_list[]`、`robot_params[]`、`modbus_data[]`

Debug 小卡片 **仅管理员可见**，其他角色完全不显示。

### 3.4 组件列表交互

- 点击 Header 中的「组件」按钮，弹出组件列表
- 组件列表 **中上方有搜索框**，输入关键词即时过滤
- 组件按分组折叠展示（▾ 展开 / ▸ 折叠）
- 每个分组右侧显示组件总数
- **使用 +/- 按钮**（不是对号/空白）：
  - **+**（灰色）= 组件未打开，点击添加到界面
  - **-**（红色）= 组件已打开，点击从界面移除
- 列表宽度适中，不显示"已有"等冗余列

```
┌──────────────────────────┐
│ 🔍 搜索组件...            │
├──────────────────────────┤
│ ▾ AGV               [7]   │
│   [−] AGV 状态            │
│   [+] AGV 电池             │
│   [+] AGV 安全             │
│   ...                     │
│ ▾ 导航               [8]   │
│   [−] 导航控制             │
│   [+] 路径状态             │
│   ...                     │
│ ▸ 运动               [7]   │
│ ▸ 感知               [6]   │
│ ▸ 相机               [3]   │
│ ▸ 视觉识别           [4]   │
│ ▸ 机械臂             [8]   │
│ ▸ 底盘机构           [4]   │
│ ▸ 系统               [7]   │
│ ▸ 警报事件           [3]   │
│ ▸ Debug (仅管理员)  [15+] │
└──────────────────────────┘
```

---

## 四、弹窗系统（故障码）

### 4.1 弹窗样式

- 半透明毛玻璃（`backdrop-filter: blur(8px)`），字体清晰可读
- 位于页面 **居中顶部**，从上到下纵向排列
- 最多 6 个，6 个弹窗总高度不超过屏幕一半
- 右上角 **无关闭按钮**

### 4.2 三级颜色

| 级别 | 边框色 | 文字色 | 背景半透明 | 自动消失 |
|------|--------|--------|-----------|----------|
| info（蓝） | `#3B82F6` | `#93c5fd` | `rgba(30,42,62,0.75)` | 3秒 |
| warning（黄） | `#F59E0B` | `#f0d680` | `rgba(42,37,21,0.75)` | 3秒 |
| error（红） | `#EF4444` | `#f0a0a0` | `rgba(46,21,21,0.80)` | **不消失** |

### 4.3 两行内容

- 第一行：中文解释（基于 code 映射）
- 第二行：原始错误码原文 `code: raw_message`（monospace 字体）

### 4.4 动画

- 淡入：从上往下滑入（`translateY(-12px) → translateY(0)`，0.3s）
- 淡出：向上淡出（`translateY(0) → translateY(-8px) + opacity:0`，0.2s）

### 4.5 FIFO 顶替逻辑（关键）

**当 6 行未满时**：新弹窗直接填空位，不顶替任何弹窗。

**当 6 行满了后**：新弹窗顶替 **优先级 ≤ 自身** 的最老弹窗。

优先级：error(红) > warning(黄) > info(蓝)

| 新弹窗 | 顶替目标 |
|---------|----------|
| 新蓝(info) | 最老的蓝(info) |
| 新黄(warning) | 先找最老的蓝 → 蓝全没了 → 顶替最老的黄 |
| 新红(error) | 先找最老的蓝 → 再找最老的黄 → 最后顶替最老的红 |

**举例**：
```
初始: [红, 黄, 蓝, 蓝, 蓝, 蓝]   ← 6行已满

新蓝 → 顶替第3行(最老蓝) → [红, 黄, 蓝ⁿ, 蓝, 蓝, 蓝]  ✗旧的③消失
新黄 → 顶替第3行(最老蓝) → 不碰第2行黄 ✓
新黄 → 继续顶替最老蓝...
4行全变黄: [红, 黄, 黄, 黄, 黄, 黄]
新黄 → 蓝没了 → 顶替第2行(最老黄) ✓
新红 → 先蓝(没了) → 再黄 → 顶替最老黄
```

- error 级不自动消失，但可以被新的 error 顶替（FIFO 内同级）
- error 级被关联件恢复/重启后，后端不再返回该错误 → 前端自动移除

### 4.6 层级遮挡（z-index）

error(100) > warning(95) > info(90)

- warning 出现时遮挡 info（info 不消失，只是被挡住）
- error 出现时遮挡所有

### 4.7 用户级提示措辞

对于 **用户分组**，三级提示改为友好措辞，不显示第二行原始错误码：

| 原始 | 用户级措辞 |
|------|-----------|
| `50106: map format invalid` | "地图需要更新，请联系技术人员" |
| `manualBlock=true` | "车辆处于维护模式，暂不可自动运行" |
| `AGV_NOT_MOVING` | "车辆正在等待，稍后将继续" |
| `ARM_TIMEOUT` | "机械臂需要休息一下，请稍等" |

开发级和管理员级显示完整的两行。

---

## 五、重启功能

### 5.1 重命名

- 「重启 Docker」改名为 **「重启系统」**
- 「重启关联件」保持不变

### 5.2 权限

- **重启系统**：需要 **开发及以上权限**（开发、管理员）
- **重启关联件**：需要 **开发及以上权限**

### 5.3 重启系统

- 语义：重启我们自己的 Docker 容器
- 白名单容器：`delivery_gazebo_soft`、`delivery_gazebo_soft_full`、`delivery_gazebo_gpu`
- 操作：确认弹窗 → 执行 `docker restart` → 显示"正在重启..." → 重启后自动重连
- 不允许重启其他人的容器（如 `xarm7_real`）

### 5.4 重启关联件

- 语义：重启某个功能模块
- 可选关联件（来自后端 `GET /api/restart/components`）：

| name | label | group |
|------|-------|-------|
| keyence | Keyence 地面扫码 | stack |
| jason_camera | Jason 腕部相机 | stack |
| wrist_qr | 腕部二维码检测 | stack |
| wrist_apriltag | 腕部 AprilTag | stack |
| leo_face | Leo 人脸识别 | leo |
| pick_place | 机械臂抓取服务 | shell |

- 操作：弹出选择列表 → 选择关联件 → 确认 → 执行 `POST /api/restart/component` → 显示结果

### 5.5 按钮位置

Header 右侧，从左到右：
```
[BEV/总览切换] [重启关联件] [重启系统]
```

---

## 六、Header 布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│ IndustrialNext v0.52  ●AGV ●ARM ●CAM  BAT 56.8%  [REAL|SIM]  [BEV] [重启关联件] [重启系统]  17:45 │
└──────────────────────────────────────────────────────────────────────────┘
```

- 左上角：Logo（点击 = 登录面板左侧滑入）
- 状态芯片：AGV/ARM/CAM 在线状态（绿点 + 文字）
- 电池：百分比 + 充电图标
- 模式切换：REAL / SIMULATION
- 右侧按钮组：BEV/总览切换 → 重启关联件 → 重启系统
- 时间：当前时间

Header 样式：
```css
header.header {
  position: fixed; top: 0; left: 0; right: 0;
  height: var(--header-h);  /* 56px */
  z-index: 1000;
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
```

---

## 七、现有 API 对照（保持兼容，不破坏）

### 7.1 现有 API 端点（47个）

**GET（25个）**：
`/api/auth/session`, `/api/version`, `/api/health`, `/api/heartbeat`, `/api/jason/camera/status`, `/api/jason/camera/snapshot`, `/api/jason/camera/stream`, `/api/vision/floor_qr/status`, `/api/vision/floor_qr/localization`, `/api/vision/wrist_camera/status`, `/api/vision/wrist_camera/snapshot`, `/api/vision/leo_face/status`, `/api/stack/status`, `/api/blackbox/status`, `/api/blackbox/list`, `/api/blackbox/record`, `/api/restart/components`, `/api/arm/status`, `/api/arm/pose`, `/api/arm/gripper`, `/api/maps/robot`, `/api/config/devices`, `/api/status`, `/api/stations`, `/api/route/status`, `/api/state`, `/api/debug`, `/api/face/status`, `/api/face/logs`, `/api/system/logs`, `/api/log/status`, `/api/log/recent`, `/api/diag/cameras`, `/api/diag/snapshot`, `/api/sim/maps`, `/api/sim/obstacles`, `/api/route`, `/api/env`, `/api/camera/{name}/stream`, `/api/camera/{name}/snapshot`

**POST（22个）**：
`/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/change_password`, `/api/agv/lock`, `/api/navigate`, `/api/cancel`, `/api/arm_sequence`, `/api/jason/qr/start`, `/api/jason/qr/stop`, `/api/vision/wrist_camera/detect/start`, `/api/vision/wrist_camera/detect/stop`, `/api/vision/floor_qr/trigger`, `/api/vision/wrist_camera/trigger/qr`, `/api/vision/wrist_camera/trigger/apriltag`, `/api/vision/leo_face/trigger`, `/api/vision/leo_face/continuous/start`, `/api/vision/leo_face/continuous/stop`, `/api/stack/status`, `/api/stack/ensure`, `/api/blackbox/trigger`, `/api/restart/component`, `/api/restart/docker`, `/api/arm/command`, `/api/arm/mode`, `/api/arm/motion`, `/api/arm/unlock`, `/api/arm/pick_place`, `/api/arm/gripper`, `/api/arm/cycles`, `/api/arm/stop`, `/api/maps/switch`, `/api/maps/refresh`, `/api/stations/add`, `/api/stations/connect`, `/api/stations/rename`, `/api/stations/delete`, `/api/env`, `/api/log/toggle`, `/api/log/toggle_all`, `/api/sim/map`, `/api/sim/obstacles`, `/api/sim/route`

### 7.2 需要新增的 API

| API | 用途 |
|-----|------|
| `GET /api/user/layout` | 读取用户布局 |
| `POST /api/user/layout` | 保存用户布局 |
| `GET /api/users` | 用户列表(管理员) |
| `POST /api/users/group` | 修改用户分组(管理员) |
| `DELETE /api/users/{name}` | 删除用户(管理员) |

### 7.3 需要扩展暴露的字段

在 `/api/state` 的 `snapshot()` 中增加从 Robokit 1100 获取的：
- `manualBlock`, `is_stop`, `joystick_state`
- `r_vx`, `r_vy`, `r_w`（导航层输出速度）
- `tracking_status`, `running_status`
- `move_status_info`（解析后）
- `dispatch_mode`, `connectFleet`, `fleetControl`
- `reloc_status`, `reloc_length`, `reloc_timeout`
- `block_x`, `block_y`, `block_reason`
- `battery_temp`, `battery_cycle`
- `jack_height`, `jack_state`, `jack_speed`
- `hook_angle`, `hook_clamping_state`
- `controller_temp`, `controller_humi`, `controller_voltage`
- `fatals[]`（完整数组，含 code, desc, dateTime）

### 7.4 扩展 alerts

在 `_collect_system_alerts()` 中新增 `raw` 字段和以下检测：

```python
FATAL_CODE_MAP = {
    50106: "地图格式无效，导航无法规划路径",
    50103: "定位丢失，请重新定位",
    50104: "急停被按下",
}

# manualBlock=true → error 级
# task_status=2 + r_vx=0 → warning 级
# fatals[] 逐条映射 → error 级，带 raw
# move_status_info 解析 → info 级
# tracking_status=1 → info 级
```

---

## 八、关键文件路径

```
# Dashboard 后端
c:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\delivery_web\dashboard_node.py

# 前端 HTML
c:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\index.html

# Widget 管理器
c:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\delivery_web\www\widgets.js

# AGV Bridge
c:\Users\Administrator\Cursor\AGV\migration_implementation\workspace_v02\ros2_ws\src\agv_bridge\agv_bridge\robokit_client.py

# API 文档目录（211个文件）
C:\Users\Administrator\Cursor\AGV\AGVAPI文档\AGVAPI文档

# 车辆模型文件（AMB-150）
C:\Users\Administrator\Desktop\DD部门AGV项目\AGV_Delivery_v0.2.0_20260807_0921\agv_downloaded\models\robot.model
# 同目录: safe.model, action.model, robot.cp, joystick_keymap.json

# 组件详细清单
c:\Users\Administrator\Cursor\AGV\AGVAPI文档\项目材料\AGV_Web_V2_组件详细清单.md
```

---

## 九、前端改动清单

### 9.1 两个全屏界面切换

- 总览界面：保持现有 `#map` Canvas + WidgetManager
- BEV 界面：新建 BEV Canvas（第三人称视角），**也是全屏**
- 两个界面都：组件悬浮在画面上方，半透明，可拖拽，可关闭
- 切换时：隐藏一个，显示另一个，不销毁组件状态

### 9.2 BEV Canvas 实现

- 使用 Canvas 2D 或 WebGL
- CameraController：yaw, pitch, distance, target, binding
- 鼠标左键拖动 → 轨道旋转
- 3 秒无操作 → 回默认视角（setTimeout + clearTimeout）
- 滚轮 → zoom（有 min/max 限制）
- 右键 → pan
- 双击 AGV → reset
- 点云渲染：
  - 地图点云：灰色 `#8a8a8a`
  - LiDAR 实时扫描：近→红 `#EF4444`，中→黄 `#F59E0B`，远→黑 `#000000`，渐变过渡

### 9.3 组件列表

- 搜索框在列表中上方
- 分组折叠（▾/▸）
- **+/- 按钮**（不是对号/空白）：灰色 + = 添加，红色 - = 移除
- 右侧仅显示数字（组件总数）
- 不显示"已有"等冗余列

### 9.4 登录面板左侧滑入

- 点击 LOGO → 左侧滑入面板
- 面板样式与组件列表一致（左侧滑入）
- 不居中

### 9.5 去掉缩小按钮

- `widgets.js` 中删除 `.widget-minimize` 按钮 HTML
- 删除缩小事件绑定
- 删除 layout 中 minimized 字段
- 删除 CSS 中 `.widget-card.minimized` 规则
- 删除双击标题栏缩小行为

---

## 十、开发阶段

### PHASE 1：代码审计
输出 `REAL_WEB_V2_ARCHITECTURE.md`，标记现有代码 KEEP/REFACTOR/REMOVE/NEW

### PHASE 2：后端扩展
- 扩展 `/api/state` 暴露 `manualBlock`、`r_vx`、`tracking_status`、`fatals[]` 等字段
- 扩展 `_collect_system_alerts()` 增加 `raw` 字段和新检测
- 新增用户布局 API（`GET/POST /api/user/layout`）
- 新增用户管理 API（`GET /api/users`, `POST /api/users/group`, `DELETE /api/users/{name}`）
- `POST /api/auth/login` 返回 `role` 字段（admin/dev/user）

### PHASE 3：双全屏界面
- 总览界面保持现有
- 新建 BEV 全屏界面（第三人称 Canvas + 鼠标交互 + 3秒回正 + zoom 限制 + 点云颜色渐变）
- BEV/总览切换按钮
- 登录/权限控制

### PHASE 4：组件分类与搜索
- 组件列表按 11 个分组折叠
- 搜索框
- +/- 按钮
- 30% 透明度
- 去掉缩小按钮

### PHASE 5：弹窗系统
- 三级颜色弹窗（蓝/黄/红）
- FIFO 顶替逻辑（6行满后按优先级顶替）
- info/warning 3秒消失
- error 不消失
- 层级遮挡
- 用户级友好措辞

### PHASE 6：重启功能
- 「重启系统」（原重启 Docker）
- 「重启关联件」
- 权限控制（开发及以上）

### PHASE 7：验证
- 总览界面：组件可移动、可关闭、30%透明
- BEV 界面：全屏、鼠标交互正确、3秒回正、zoom限制、点云近红远黑
- 权限：三个分组各自看到不同内容
- 弹窗：FIFO顶替逻辑正确
- 布局：跨电脑持久化

---

## 十一、验收标准

### A. 界面
- [ ] 打开 Web = 总览界面，不要求登录
- [ ] 总览和 BEV 都是全屏，组件悬浮在画面上方
- [ ] 组件可移动、可关闭
- [ ] 没有 Widget 缩小按钮
- [ ] 卡片半透明（30%），文字可读
- [ ] BEV/总览切换按钮在重启关联件左边

### B. BEV
- [ ] 全屏第三人称视角
- [ ] 鼠标左键各方向拖动改变视角
- [ ] 3秒无操作回默认视角
- [ ] 滚轮缩放有上下限
- [ ] 地图点云灰色
- [ ] LiDAR 实时扫描：近→红，中→黄，远→黑，渐变
- [ ] 鼠标操作不发 cmd_vel

### C. 登录权限
- [ ] 点击 LOGO 左侧滑入
- [ ] 三个分组：管理员/开发/用户
- [ ] 用户级看不到 Debug
- [ ] 用户级提示友好措辞（无原始错误码）
- [ ] 只有管理员可切 BEV
- [ ] 布局跨电脑同步

### D. 组件
- [ ] 组件列表有搜索
- [ ] 组件按 11 分组折叠
- [ ] +/- 按钮（灰色+添加，红色-移除）
- [ ] 右侧仅显示数字
- [ ] Debug 是组件内小卡片（不是独立界面）
- [ ] Debug 仅管理员可见

### E. 弹窗
- [ ] 三级颜色（蓝/黄/红）
- [ ] info/warning 3秒消失
- [ ] error 不消失
- [ ] 6行未满：填空位
- [ ] 6行满后：新弹窗顶替优先级≤自身的最老弹窗
- [ ] 从上到下纵向排列
- [ ] 无关闭按钮
- [ ] 层级遮挡：error > warning > info

### F. 重启
- [ ] 「重启系统」（不是「重启 Docker」）
- [ ] 「重启关联件」
- [ ] 开发及以上权限
- [ ] 非管理员不显示

---

## 十二、最重要的原则

1. **总览和 BEV 都是全屏**：组件悬浮在画面上方，可移动可关闭，不是分栏布局
2. **BEV 是第三人称视角**：看车，鼠标左键轨道旋转，3秒回正，滚轮限幅
3. **点云颜色**：地图灰，LiDAR 近→红，中→黄，远→黑，渐变过渡
4. **Debug 是小卡片**：在组件内部展开，不是独立界面
5. **30% 透明度**：所有卡片背景半透明，文字保持可读
6. **弹窗 FIFO 顶替**：6行满后，新弹窗顶替优先级≤自身的最老弹窗
7. **不伪造数据**：没有的后端数据显示 NO DATA
8. **安全隔离**：BEV 鼠标操作绝对不发车辆控制指令
9. **权限隐身**：非管理员看不到的东西完全不存在，不是灰掉
10. **+/- 按钮**：组件列表用 +/- 而非对号，+ 添加，- 移除
