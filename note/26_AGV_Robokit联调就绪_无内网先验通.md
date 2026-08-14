# AGV / Roboshop / Robokit 联调就绪说明（协议离线自洽）

> **2026-08-07 更正**：原「百分百能通」表述作废。Mock/离线冒烟只证明客户端↔自写 Mock 一致，**不得**宣称真车或 Demo 就绪。  
> 正式裁决与 Go/No-Go：**`docs/27_Demo_GoNoGo门禁_已采纳第三方审阅.md`**。

---

> 日期：2026-08-07 · 目标：在你连上公司内网 / Demo AGV `192.168.18.198` **之前**，把协议层离线自洽先验清（≠ 真车/Demo 就绪）。

---

## 1. 先分清三样东西

| 名称 | 是什么 | 谁用 |
|------|--------|------|
| **Roboshop** | 仙工上位机（**Ubuntu `.deb` / Windows / 新版亦支持 Mac M**；你这边是 Ubuntu 包） | 扫图、推地图、看状态、高级配置 |
| **Robokit** | 车端控制器上的 TCP/IP API（端口 19204–19207） | **本项目 Demo 实车模式**直接打它 |
| **Nav2** | ROS2 官方导航栈（`note/AGV同事提出的` 截图讲的那套） | **本 Demo 车不用**；我们走 SEER Robokit，不是自家 Nav2 |

结论：

- 你电脑上的 **Roboshop（Ubuntu）** 用来连车、看状态、推地图；我这边保证的是 **Demo→Robokit TCP** 与仿真。真车联调时 Roboshop 与本系统 **共用同一台车的 Robokit**，不要两边同时抢控制权。
- 本仓库要保证通的是：**开发仿真** + **Demo→Robokit TCP**（公开字段按 API 手册）。

---

## 2. 公开字段（与 `note/AGV智能送货机器人API` 对齐）

本系统 **实际使用** 的 Robokit 接口：

| API | 端口 | 公开字段（我们读/写） | 用途 |
|-----|------|----------------------|------|
| **1004** `robot_status_loc_req` | 19204 | `x,y,angle(rad),confidence,current_station,last_station` | 位姿 |
| **1007** `robot_status_battery_req` | 19204 | `battery_level,charging` | 电量（Web） |
| **1009** `robot_status_laser_req` | 19204 | `lasers[].beams[{angle(deg),dist,valid}], install_info[{x,y,yaw}]` | 激光 |
| **1020** `robot_status_task_req` | 19204 | `task_status,task_type,target_id,finished_path,unfinished_path` | 导航状态 |
| **3051** `robot_task_gotarget_req` | 19206 | 请求 `id,source_id,task_id?,angle?,method?,max_speed?` | 去站点 |
| **3003** cancel | 19206 | — | 取消导航 |
| **4005/4006** lock/unlock | 19207 | 请求 `nick_name`（默认 `ros2_delivery`） | 控制权 |

`task_status`：`0 NONE / 1 WAITING / 2 RUNNING / 3 SUSPENDED / 4 COMPLETED / 5 FAILED / 6 CANCELED`

注意：**1009 的 beam.angle 是度**（手册例 −90…90）；车体 `angle` 是弧度。Dashboard 已按度→弧度转换。

同事截图里的 Nav2 模块名（`bt_navigator` 等）**不是**我们 Demo 的公开接口。

---

## 3. 无真车时能先验什么（仅协议自洽）

### A. 开发环境（仿真）— 本来就该通

容器起来后：

```bash
bash workspace_v02/scripts/smoke_v02.sh 127.0.0.1 19999
# 或 Web 端口以实际为准（常为 8080 / 19999）
```

Web 右上角保持 **开发环境**；导航走 Gazebo/`agv_gazebo_nav`，地图/障碍物走 `agv_downloaded` smap。

### B. Demo 路径（Robokit TCP）— 用 Mock 代替真车

```bash
# 终端1：假 Robokit（本机）
cd workspace_v02/ros2_ws/src
PYTHONPATH=$PWD/agv_bridge python3 -m agv_bridge.robokit_mock_server --host 127.0.0.1

# 终端2：协议冒烟（不依赖 Docker）
bash workspace_v02/scripts/smoke_robokit_mock.sh 127.0.0.1
# 期望末行：ALL_ROBOKIT_MOCK_SMOKE_PASSED

# 若 Web 已起，再切 Demo 打 mock：
curl -s -X POST http://127.0.0.1:19999/api/env \
  -H 'Content-Type: application/json' \
  -d '{"mode":"demo","agv_host":"127.0.0.1"}'
curl -s -X POST http://127.0.0.1:19999/api/navigate \
  -H 'Content-Type: application/json' \
  -d '{"target_id":"LM2","wait":true}'
```

Mock 覆盖：1004 / 1007 / 1009 / 1020 / 3051 / 3003 / 4005 / 4006。

---

## 4. 你连上公司内网后（真车）— 按这个顺序

1. PC / NUC 能 `ping 192.168.18.198`
2. `nc -vz 192.168.18.198 19204`（以及 19205/19206/19207）通
3. **Roboshop 先连接成功**（证明车端 Robokit 正常），再关掉或释放控制权，避免抢锁
4. Web：`POST /api/env` → `{"mode":"demo","agv_host":"192.168.18.198"}`
5. 看返回 `robokit_ok: true`；日志有 `agv_lock_ok` / `robokit_ready`
6. 地图激光 source=`robokit_1009`；导航到真实站点 ID（以车上 smap 为准，不一定是 LM2）

随身 WiFi 下 **不可能** 通 `192.168.18.198`——这是网络问题，不是代码没调通。

---

## 5. 本次代码侧已补齐

- `agv_bridge/robokit_mock_server.py`：离线 Demo 干跑
- `scripts/smoke_robokit_mock.sh`：协议级冒烟
- Dashboard：激光角度按 **度** 转换；Demo 轮询补上 **1020 任务态 + 1007 电量**
- `agv_bridge_node` 默认 host 与 `devices.yaml` 对齐为 `192.168.18.198`
