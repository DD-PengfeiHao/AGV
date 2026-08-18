# AGV Web V2 — 组件详细清单（对照 211 个 Robokit API）

> 基于完整 API 文档审计，列出所有可用组件及其数据源。
> GPT 提示词中的组件描述 **不够详细**，缺少大量 API 能力。本文档是完整补充。

---

## 组件总览

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
| **合计** | **72+** | |

---

## 一、AGV 分组（7个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | AGV 状态 | `/api/state` → `agv` | task_status, target_id, x, y, angle, confidence, current_station, mode | ✅ 已有 |
| 2 | AGV 电池 | `/api/state` → `agv` | battery_level, charging, battery_temp, battery_cycle, battery_user_data | ✅ 已有(需补充temp/cycle) |
| 3 | AGV 安全 | `/api/state` → `agv` | blocked, emergency, soft_emc, brake, driver_emc, manual_charge | ✅ 已有 |
| 4 | AGV 任务状态 | `/api/state` → `agv` | task_status, task_type, target_id, finished_path[], unfinished_path[], move_status_info | ✅ 已有(需补充move_status_info) |
| 5 | AGV I/O | Robokit API: 查询IO数据 | DI[0-5], DO[0-8], source, status, valid | ⚠️ 后端需补充 |
| 6 | AGV IMU | Robokit API: 查询IMU数据 | acc_x, acc_y, acc_z, imu_header, angular_velocity | ⚠️ 后端需补充 |
| 7 | AGV 速度 | Robokit API: 查询机器人速度(1005) | vx, vy, angular_velocity, r_vx, r_vy, r_w | ⚠️ 需暴露r_vx等 |

### Debug 子卡片（AGV 组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 速度诊断 | r_vx, r_vy, r_w (导航层输出速度) | 1100 批量数据1 |
| 手动模式 | manualBlock, joystick_state, is_stop | 1100 |
| 调度模式 | dispatch_mode, connectFleet, fleetControl | 1100 |
| 定位诊断 | reloc_status, confidence, reloc_length, reloc_timeout | 1021/1100 |
| 控制权 | current_lock (ip, locked, nick_name, type, time_t), lock_nick | 1060/1100 |
| 报警码 | fatals[].code, desc, dateTime, times | 1100 (fatals数组) |
| 编码器 | encoder_left, encoder_right, encoder_pulse | Robokit 查询编码器脉冲值 |
| 电机状态 | motor_status[], controller_temp, controller_humi, controller_voltage | Robokit 查询电机状态 |

---

## 二、导航分组（8个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 导航控制 | `POST /api/navigate`, `POST /api/cancel` | target_id选择, 导航/取消/暂停/继续按钮 | ✅ 已有(需补暂停/继续) |
| 2 | 路径状态 | `/api/state` → `agv` + `/api/route/status` | unfinished_path, finished_path, route, route_task | ✅ 已有 |
| 3 | 定位状态 | `/api/state` → `agv` | confidence, reloc_status, reloc_length, reloc_timeout | ⚠️ 需暴露reloc字段 |
| 4 | 站点管理 | `GET /api/stations`, `POST /api/stations/*` | 站点列表(x,y,yaw), 添加/删除/重命名/连接 | ✅ 已有 |
| 5 | 地图管理 | `GET /api/maps/robot`, `POST /api/maps/switch`, `POST /api/maps/refresh` | 当前地图, 可用地图列表, 切换/刷新/上传/下载/删除 | ✅ 已有 |
| 6 | 任务链管理 | Robokit API: 查询任务链, 执行预存任务链 | 任务链列表, 执行, 查询, 清除 | ⚠️ 后端需补充 |
| 7 | 跟踪状态 | Robokit API: 1100 tracking_status | tracking_status, tracking_error, running_status | ⚠️ 需暴露 |
| 8 | 路径规划 | Robokit API: 查询任意两点路径(1303), 查询站点(1301) | global_path, local_path, replanning, cost_map | ⚠️ 后端需补充 |

### Debug 子卡片（导航组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 导航状态原始 | task_status_raw, move_status_info, running_status | 1020/1100 |
| 重规划 | replanning_count, replanning_reason, last_replan_time | 1020 |
| 代价地图 | cost_map_data, obstacle_list | Robokit 查询代价地图 |
| 地图载入 | loadmap_status, current_map_md5, map_entries | 1100 |
| 扫图状态 | scan_map_status, scan_progress | Robokit 查询扫图状态 |

---

## 三、运动分组（7个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 速度曲线 | `/api/state` → `telemetry` | vx, vy, angular_velocity 实时曲线 | ⚠️ 需确认telemetry字段 |
| 2 | 纵向加速度 | `/api/state` → `telemetry` | a_longitudinal 曲线 + 阈值区间 | ⚠️ 需确认 |
| 3 | 横向加速度 | `/api/state` → `telemetry` | a_lateral 曲线 + 阈值区间 | ⚠️ 需确认 |
| 4 | 纵向 Jerk | `/api/state` → `telemetry` | jerk_longitudinal 曲线 | ⚠️ 需确认 |
| 5 | 横向 Jerk | `/api/state` → `telemetry` | jerk_lateral 曲线 | ⚠️ 需确认 |
| 6 | 角运动 | `/api/state` → `telemetry` | yaw_rate, yaw_acceleration 曲线 | ⚠️ 需确认 |
| 7 | 跟踪误差 | `/api/state` → `telemetry` | tracking_error 曲线 | ⚠️ 需确认 |

### Debug 子卡片（运动组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 原始速度 | r_vx, r_vy, r_w (导航层速度) vs vx, vy (实际速度) | 1100 + 1005 |
| 开环运动 | open_loop_status, open_loop_vx, open_loop_vy | Robokit 开环运动API |
| block详情 | block_x, block_y, block_reason, advance_regions | 1100 |

---

## 四、感知分组（6个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | LiDAR 点云 | `/api/state` → `laser` | points[], beam_count, live_lidar, label | ✅ 已有 |
| 2 | 超声波传感器 | Robokit API: 查询超声传感器数据 | ultrasonic[], distance, valid | ❌ 后端不存在 |
| 3 | 障碍物检测 | `/api/state` → `obstacles` + Robokit 查询障碍物信息 | obstacle_list[], id, x, y, w, h | ⚠️ 后端需补充 |
| 4 | 代价地图 | Robokit API: 查询代价地图 | cost_map_grid, inflation_radius | ⚠️ 后端需补充 |
| 5 | 库位检测 | Robokit API: 库位检测, 查询库位信息 | slot_status, slot_id, slot_position | ⚠️ 后端需补充 |
| 6 | RFID 数据 | Robokit API: 查询RFID数据 | rfid_data, rfid_valid | ❌ 后端不存在 |

### Debug 子卡片（感知组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 激光原始 | lasers[].beams[], beams角度/距离/rssi/valid | 1100 (lasers数组) |
| 障碍详情 | obstacle_info, dynamic_obstacles, advance_regions | 1100 + Robokit查询障碍物 |
| 传感器信息 | sensor_info, sensor_type, sensor_status | Robokit 查询传感器信息 |

---

## 五、相机分组（3个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | Jason Camera-A (地面/前视) | `/api/vision/wrist_camera/snapshot` + `/api/jason/camera/status` | JPEG快照, QR结果, detections, FPS | ✅ 已有 |
| 2 | Jason Camera-B (腕部 Pylon) | `/api/vision/wrist_camera/snapshot` | JPEG快照, QR/AprilTag结果, FPS | ✅ 已有 |
| 3 | Leo Camera (人脸) | `/api/vision/leo_face/status` | JPEG快照, person_name, confidence, bbox, FPS | ✅ 已有 |

### Debug 子卡片（相机组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 相机内参 | camera_info, intrinsic_matrix, distortion_coeffs | Robokit 查询相机标定图片 |
| 相机点云 | camera_pointcloud_data, pointcloud_image | Robokit 查询相机点云图片 |
| 检测详情 | detections[], class, confidence, bbox_xywh | /api/state → cameras |
| 相机元数据 | cameras_meta, label, logical_name, role, capabilities | /api/state → cameras_meta |

---

## 六、视觉识别分组（4个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 人脸识别 | `POST /api/vision/leo_face/trigger`, `/api/vision/leo_face/status` | trigger按钮, continuous模式, person_name, confidence, bbox | ✅ 已有 |
| 2 | 二维码(QR) | `POST /api/vision/wrist_camera/trigger/qr`, `POST /api/jason/qr/start` | trigger按钮, last_qr_result, qr_recognition | ✅ 已有 |
| 3 | AprilTag | `POST /api/vision/wrist_camera/trigger/apriltag` | trigger按钮, last_detections | ✅ 已有 |
| 4 | 地面 QR | `POST /api/vision/floor_qr/trigger`, `/api/vision/floor_qr/status` | trigger按钮, localization_data, floor_qr_status | ✅ 已有 |

### Debug 子卡片（视觉组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 人脸原始 | face.ok, backend, peer, domain_id, detections_hz, track_id, last_identify | /api/state → face |
| 二维码原始 | camera_id, source, model, device_user_id, topic, last_qr_result | /api/jason/camera/status |
| 地面QR定位 | floor_qr_localization, scanner_status | /api/vision/floor_qr/* |

---

## 七、机械臂分组（8个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 机械臂控制 | `POST /api/arm/*` | mode切换, unlock, pick_place, gripper, stop, cycles, motion_toggle | ✅ 已有 |
| 2 | 机械臂状态 | `/api/arm/status` | connected, is_moving, error, mode_name, current_sequence | ✅ 已有 |
| 3 | 关节状态 | `/api/state` → `arms` | J1-J7角度, joint_positions[], joint_velocity | ✅ 已有(需补充velocity) |
| 4 | TCP 位姿 | `/api/arm/pose` | X/Y/Z/Rx/Ry/Rz, tcp_position | ✅ 已有 |
| 5 | 夹爪状态 | `/api/arm/gripper` | gripper_state, open/close, is_full | ✅ 已有 |
| 6 | 抓取任务 | `POST /api/arm/pick_place`, `POST /api/arm/cycles` | cycles, pick_place_status, sequence_name | ✅ 已有 |
| 7 | 机械臂错误 | `/api/state` → `arms` | error, error_msg, error_code | ✅ 已有 |
| 8 | 机械臂运动控制 | Robokit API: 机械臂运动控制, binTask | arm_motion_cmd, bintask_status | ⚠️ 后端需补充 |

### Debug 子卡片（机械臂组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| 关节原始 | joint_positions[], joint_velocity[], joint_torque[] | /api/arm/status |
| 坐标转换 | arm_coordinate_transform, transform_matrix | Robokit 计算机械臂坐标转换 |
| 示教器 | teach_pendant_panel, pendant_status | Robokit 机械臂示教器面板控制 |
| 仿真识别 | simulation_file_recognition, recognition_result | Robokit 仿真从文件识别 |

---

## 八、底盘机构分组（4个，按车型显示）

> **AMB-150 模型确认**：robot.model 中已包含 jack（顶升）、fork（货叉）、roller（辊筒）机构配置。
> 本车型 AMB-150 显示：顶升、货叉、辊筒。牵引机构不显示（hook_enable=false）。

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 顶升机构 | Robokit API: 查询顶升机构状态 | jack_height, jack_state, jack_speed, jack_isFull, jack_load_times, jack_emc | ⚠️ 1100已有字段需暴露 |
| 2 | 辊筒/皮带 | Robokit API: 查询辊筒状态 + 辊筒操作 | roller_state, roller_direction, roller_status | ⚠️ 后端需补充 |
| 3 | 货叉 | Robokit API: 查询货叉状态 + 货叉操作 | fork_height, fork_state, fork_status, fork_tip_sensor | ⚠️ 后端需补充 |
| 4 | 牵引 | ~~不显示~~ | hook_enable=false (robot.model确认) | ❌ AMB-150无此机构 |

**注意**：基于 robot.model 配置动态显示。AMB-150 车型有顶升/辊筒/货叉，无牵引。

---

## 九、系统分组（7个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 系统监控 | `/api/state` → `nodes_health`, `agv_link` | CPU, MEM, arm/vision health, agv_link status, uptime | ✅ 已有(需补CPU/MEM) |
| 2 | ROS2 节点 | `/api/state` → `nodes_health` | arm_left, arm_right, vision, online/offline | ✅ 已有 |
| 3 | ROS2 Topic 频率 | `/api/state` → `hz` | topic_name → Hz 实时列表 | ✅ 已有 |
| 4 | API 延迟 | 前端测量 fetch 耗时 | /api/state 响应时间(ms) | ⚠️ 前端实现 |
| 5 | Docker 状态 | `GET /api/health` + 前端 docker ps | container_name, status, uptime | ⚠️ 需后端补充 |
| 6 | 软件版本 | `/api/version` | version, project, stack, ports, env | ✅ 已有 |
| 7 | 控制权管理 | `/api/state` → `env` + Robokit 1060 | current_lock, control_locked, control_wanted, lock_nick | ✅ 已有(需补1060详情) |

### Debug 子卡片（系统组件展开后，仅管理员）

| 子卡片 | 字段 | API 来源 |
|--------|------|----------|
| TCP客户端 | tcp_client_info[], client_ip, client_port | Robokit 查询TCP客户端信息 |
| 控制权历史 | historical_control[], ip, nick_name, time_t, type | Robokit 查询历史控制权信息 |
| 控制器状态 | controller_temp, controller_humi, controller_voltage, brake_status | 1100 |
| 脚本管理 | script_list[], script_details, default_params | Robokit 查询脚本列表/详情 |
| 文件管理 | file_list[], file_size, file_type | Robokit 查询文件列表 |
| 机器人参数 | robot_params[], param_name, param_value | Robokit 查询机器人参数 |
| 驱动器参数 | driver_params[], driver_name, driver_status | Robokit 查询驱动器参数 |
| GNSS | gnss_status, gnss_device_list, gnss_connection | Robokit 查询GNSS |
| Modbus | modbus_data[], register_type, address, value | Robokit 查询/写入modbus |
| 透传数据 | passthrough_data, data_size | Robokit 查询透传数据 |

---

## 十、警报事件分组（3个）

| # | 组件名 | API 数据源 | 显示字段 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 实时弹窗 | `/api/state` → `alerts` | level, source, code, message, raw | ✅ 已有(需扩展raw字段) |
| 2 | 事件时间线 | `/api/state` → `events` | kind, level, event, msg, ts | ✅ 已有 |
| 3 | 报警码查询 | 参考文档: 附录/报警码.docx + API错误码.docx | code → description 映射表 | ⚠️ 需前端内置映射 |

---

## 十一、Debug 分组（15+个，仅管理员）

| # | 组件名 | API 数据源 | 显示内容 | 状态 |
|---|--------|-----------|----------|------|
| 1 | 日志控制台 | `/api/log/recent`, `/api/log/toggle` | 模块日志开关, 实时日志流, 级别过滤 | ✅ 已有(verbose_log) |
| 2 | AGV 诊断快照 | Robokit 1100 批量数据1 | 完整1100响应JSON, 格式化展示 | ⚠️ 需暴露 |
| 3 | 诊断快照2 | Robokit 批量数据2 | 批量数据2完整响应 | ❌ 后端不存在 |
| 4 | 诊断快照3 | Robokit 批量数据3 | 批量数据3完整响应 | ❌ 后端不存在 |
| 5 | ROS2 诊断 | `/api/diag/snapshot` | diag_snapshot 只读快照 | ⚠️ 后端已有但未暴露 |
| 6 | Topic 消息年龄 | 前端计算 | topic → message_age(ms) | ⚠️ 前端实现 |
| 7 | 服务状态 | `GET /api/debug` | subscriptions, watch, param_tree | ✅ 已有(/api/debug) |
| 8 | Modbus 读写 | Robokit API: 查询/写入modbus数据 | 寄存器读写面板 | ⚠️ 后端需补充 |
| 9 | 透传数据 | Robokit API: 查询/更新透传数据 | 透传数据查看/更新 | ⚠️ 后端需补充 |
| 10 | 机器人参数 | Robokit API: 查询/修改机器人参数 | 参数查询/临时修改/永久修改/恢复默认 | ⚠️ 后端需补充 |
| 11 | 标定管理 | Robokit API: 查询标定状态/列表/文件/图片 | 标定状态, 支持列表, 标定文件, 标定图片 | ⚠️ 后端需补充 |
| 12 | 脚本管理 | Robokit API: 上传/下载/删除脚本, 查询脚本列表/详情/默认参数 | 脚本CRUD, 列表, 默认参数 | ⚠️ 后端需补充 |
| 13 | 文件管理 | Robokit API: 上传/下载文件, 查询文件列表 | 文件CRUD, 列表, 下载 | ⚠️ 后端需补充 |
| 14 | 地图MD5 | Robokit API: 查询地图MD5值 | 地图名 → MD5 校验 | ⚠️ 后端需补充 |
| 15 | 3D二维码建图 | Robokit API: 查询建图时3D二维码 | 3D二维码位置, 建图辅助 | ❌ 后端不存在 |

---

## 十二、当前已有 vs 需要新增

### ✅ 已有（无需后端改动）
- AGV 状态、AGV 安全、AGV 任务状态
- 导航控制、路径状态、站点管理、地图管理
- LiDAR 点云
- 3个相机、4个视觉识别
- 机械臂控制、状态、关节、TCP、夹爪、抓取、错误
- 系统监控、ROS2 节点、Topic 频率、版本、控制权
- 实时弹窗、事件时间线
- 日志控制台

### ⚠️ 需后端补充暴露
- AGV 电池(temp/cycle)、AGV I/O、AGV IMU、AGV 速度(r_vx/r_vy/r_w)
- 导航: 定位状态、跟踪状态、路径规划、任务链
- 运动: telemetry 字段确认
- 感知: 障碍物、代价地图、库位检测
- 机械臂: 运动控制、binTask
- 底盘机构: 顶升/辊筒/货叉/牵引状态
- 系统: CPU/MEM、Docker 状态
- Debug: 1100 快照、Modbus、透传、参数、标定、脚本、文件

### ❌ 后端不存在（显示 NO DATA）
- 超声波传感器（车型未配备）
- 批量数据2/3
- 3D二维码建图
- GNSS（车型未配备）
- RFID（车型未配备）

---

## 十三、GPT 提示词补充建议

GPT 的组件描述缺少以下内容：

1. **底盘机构组件**（顶升/辊筒/货叉/牵引）— GPT 未提及，但 API 文档有完整支持
2. **AGV I/O 和 IMU 组件** — GPT 未单独列出
3. **任务链管理** — GPT 未提及，但有 16 个导航 API 支持
4. **障碍物检测/代价地图/库位检测** — GPT 未详细描述
5. **相机内参/点云/检测详情 Debug 子卡片** — GPT 未提及
6. **机械臂运动控制/binTask/示教器/坐标转换** — GPT 未提及
7. **Modbus 读写/透传数据/机器人参数/标定/脚本/文件管理** — GPT 未在 Debug 中列出
8. **报警码查询组件** — 参考文档有附录报警码和API错误码，可内置映射
9. **API 延迟监控** — 前端可自行实现
10. **地图MD5校验** — GPT 未提及

**结论**：GPT 的组件覆盖约 40%，本清单补充到 72+ 个组件，覆盖了 API 文档中所有可用的功能。
