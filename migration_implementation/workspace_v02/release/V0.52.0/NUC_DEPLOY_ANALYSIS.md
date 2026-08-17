# V0.52.0 NUC 部署与故障分析报告

> 日期：2026-08-17  
> NUC：`172.31.0.84`，容器：`delivery_gazebo_soft`  
> 目标：Web 故障码弹窗 + 重启 API + Widget 去缩小 + 容器架构分析

---

## 1. 版本与代码范围

| 组件 | 路径 | 版本 |
|------|------|------|
| 后端 | `ros2_ws/src/delivery_web/delivery_web/dashboard_node.py` | `VERSION = "0.52.0"` |
| 前端 | `ros2_ws/src/delivery_web/www/index.html` | V0.52 UI |
| 弹窗 | `ros2_ws/src/delivery_web/www/alert_queue.js` | 新建 |
| Widget | `ros2_ws/src/delivery_web/www/widgets.js` | 已移除缩小按钮 |
| AGV 诊断 | `ros2_ws/src/agv_bridge/agv_bridge/agv_adapter/{models,real}.py` | manualBlock / tracking_status |
| 腕部相机 | `delivery_web/vision/wrist_camera.py` | **P0 修复 `_qr_busy`** |
| 容器方案 | `release/CONTAINER_ARCHITECTURE.md` | P2 分析 |

---

## 2. 功能清单（V0.52.0）

### 2.1 故障码弹窗（前端 `alert_queue.js` + 后端 `_collect_system_alerts`）

- 位置：header 下方居中，最多 6 个 FIFO，毛玻璃三级色
- `info` / `warning`：3 秒自动消失；`error`：仅当 `/api/state` 的 `alerts` 中消失后才关闭
- 每条 alert：`{ level, source, code, message, raw }`

### 2.2 重启 API（后端已实现，前端 UI 已加按钮）

```
GET  /api/restart/components
POST /api/restart/component   body: {"name": "jason_camera"|...}
POST /api/restart/docker      body: {"container": "delivery_gazebo_soft"}  # 白名单
```

### 2.3 Widget

- 删除 `widget-minimize` 按钮及相关 layout `minimized` 字段

---

## 3. NUC 现场故障排查结论

### 3.1 曾怀疑的原因（部分不成立）

| 怀疑项 | NUC 实测 |
|--------|----------|
| `stations_from_smap.json` 不存在 | **存在**：`/opt/delivery_ws/maps_rw/stations_from_smap.json`（1211B），`/data/agv_downloaded/maps/stations_from_smap.json`（765B），JSON 可解析 |
| `devices.nuc.release.yaml` 缺失 | **存在**：`/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml` |
| `/var/log/delivery` 无写权限 | **存在**且可写：`drwxrwxr-x` |
| 日志重定向吞掉错误 | **部分成立**：后台 `>> log` 时不易看到 traceback；**前台运行**后抓到真因 |

### 3.2 真正的根因（前台 `ros2 run` 抓到）

HTTP **可以成功绑定**，约 4 秒后出现 `Web DEMO` 日志，随后进程崩溃：

```
[INFO] [dashboard_node]: Wrist camera subscribe CompressedImage ...
[INFO] [dashboard_node]: AprilTag subscribe detections /detections
[INFO] [dashboard_node]: AprilTag camera_info ...
[INFO] [dashboard_node]: Web DEMO  http://0.0.0.0:19999/  |  DEBUG http://0.0.0.0:1999/
Traceback (most recent call last):
  File ".../wrist_camera.py", line 210, in _maybe_local_qr_async
    if self._qr_busy:
AttributeError: 'WristCameraBridge' object has no attribute '_qr_busy'
[ros2run]: Process exited with failure 1
```

**因果链**：

1. `dashboard_node` 启动 → HTTP 线程绑定 19999
2. 腕部相机 `CompressedImage` 回调 → `_maybe_local_qr_async`
3. 访问未初始化的 `_qr_busy` → **AttributeError** → 进程退出
4. 表现为「有 python 进程 / 无 19999 监听」或间歇性可访问

**修复**（已合入本地 `wrist_camera.py`）：

```python
# __init__ 中增加
self._qr_busy = False
```

### 3.3 次要因素

1. **多实例残留**：多次部署留下多个 `dashboard_node`，DDS/端口竞争；需 `pgrep -f dashboard_node` 后 `kill -9`（在容器内 root 执行）
2. **启动命令漏环境变量**：`DELIVERY_DEVICES_YAML`、`MAPS_RW_DIR` 曾遗漏
3. **V0.52.0 后端启动偏慢**：HTTP 就绪约 4–40s（0.5.0 约 7s）；`start_dashboard_nuc.sh` 应等待 ≥40s
4. **部署脚本 `set -eu` + kill 失败**：无 dashboard 进程时 `kill` 非零退出导致脚本中断（已改为 `|| true`）

### 3.4 当前 NUC 运行态（用户确认 Web 已恢复）

- **后端**：暂回退 `0.5.0`（`install/.../dashboard_node.py` 来自 build 目录）以保证稳定
- **前端**：V0.52（`index.html`、`alert_queue.js`、`widgets.js`）
- **腕部修复**：`wrist_camera.py` 已 docker cp 到 install 路径
- **弹窗 / 重启 API**：需重新部署 V0.52.0 后端后才有 `alerts` 与 restart 路由

---

## 4. 关键日志摘录

### 4.1 诊断脚本输出（`diagnose_nuc.sh`）

```
=== stations file (maps_rw) ===
-rw-r--r-- 1 root root 1211 ... /opt/delivery_ws/maps_rw/stations_from_smap.json
=== devices yaml ===
-rw-rw-rw- 1 root root 2088 ... devices.nuc.release.yaml
=== dashboard processes ===
... dashboard_node --ros-args ... stations_file:=/data/agv_downloaded/maps/...
=== listening ports ===
no 19999
```

### 4.2 前台启动成功绑定后崩溃（修复前）

见 §3.2 完整 traceback。

### 4.3 V0.52 启动成功片段（`dashboard_node.log`）

```
[INFO] Web DEMO  http://0.0.0.0:19999/  |  DEBUG http://0.0.0.0:1999/
[INFO] stack supervisor: {'enabled': True, ...}
[INFO] vision bridges warmed up
[WARN] boot map sync failed: adapter not connected
```

### 4.4 稳定启动（0.5.0 + wrist 修复 + 完整 env）

```json
{"version": "0.5.0", "ports": {"demo": 19999, "debug": 1999}, ...}
```

`ss -tlnp | grep 19999` → `LISTEN 0.0.0.0:19999`

---

## 5. 推荐 NUC 启动命令

脚本：`release/V0.52.0/start_dashboard_nuc.sh`

```bash
export ROS_DOMAIN_ID=30
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
export ARM_MODE=real
export ARM_REAL_MOTION=1
export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
export MAPS_RW_DIR=/opt/delivery_ws/maps_rw

source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash

ros2 run delivery_web dashboard_node --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json
```

**注意**：容器内 `network_mode: host`；不要用宿主机上不存在的路径 `/home/ubuntu/.../start_dashboard_release.sh`（未挂载进容器）。

---

## 6. 部署到 NUC 的文件映射

| 本地 | 容器 install 路径 |
|------|-------------------|
| `dashboard_node.py` | `.../site-packages/delivery_web/dashboard_node.py` |
| `stack_supervisor.py` | 同上 |
| `vision/wrist_camera.py` | `.../site-packages/delivery_web/vision/wrist_camera.py` |
| `www/index.html` | `.../share/delivery_web/www/` |
| `www/alert_queue.js` | 同上 |
| `www/widgets.js` | 同上 |

`src` 目录通过 volume 挂载到 `/opt/delivery_ws/src`，与 install 副本需**同时更新**。

---

## 7. 待办（GPT / 后续开发）

1. [ ] 在 NUC 验证 V0.52.0 后端 + `_qr_busy` 修复后长期稳定（无回退 0.5.0）
2. [ ] 确认 `/api/state` 返回 `alerts` 含 `raw` 字段
3. [ ] 验证 `GET /api/restart/components` 与 POST 重启
4. [ ] 调查 V0.52.0 相对 0.5.0 启动变慢原因（`boot_adapter_connect` 已异步化）
5. [ ] 合并 `status_banner.js` → 仅保留 `alert_queue.js`

---

## 8. 相关文件索引

```
migration_implementation/workspace_v02/ros2_ws/src/delivery_web/
  delivery_web/dashboard_node.py      # alerts, restart API, VERSION 0.52.0
  delivery_web/stack_supervisor.py    # restart_component()
  delivery_web/vision/wrist_camera.py # _qr_busy fix
  www/index.html, alert_queue.js, widgets.js

migration_implementation/workspace_v02/ros2_ws/src/agv_bridge/
  agv_bridge/agv_adapter/models.py    # manualBlock, tracking_status
  agv_bridge/agv_adapter/real.py

migration_implementation/workspace_v02/release/
  CONTAINER_ARCHITECTURE.md
  V0.52.0/NUC_DEPLOY_ANALYSIS.md      # 本文
  V0.52.0/start_dashboard_nuc.sh
  V0.52.0/deploy_v052_nuc.sh
```
