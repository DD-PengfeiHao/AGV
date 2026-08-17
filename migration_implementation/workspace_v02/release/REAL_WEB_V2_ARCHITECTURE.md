# REAL WEB V2 — Architecture Audit (Phase 1)

> **Status**: Phase 1 complete — audit + immediate RC items (auth, design tokens, transparency)  
> **Frozen baseline**: V0.52.1 NUC RC (`release/v0.52.0-web-alerts` @ 5a93f78) — do not modify frozen install paths on NUC without new version tag  
> **Target**: AGV 实车 Web V2 — independent Real console, not a copy of simulation Web

---

## 0. Design Style (不可违反)

完整视觉规范见项目设计令牌文档。核心约束：

| 原则 | 要求 |
|------|------|
| 主题 | **亮色优先** — 白/浅灰背景，点云深色渲染 |
| 质感 | 毛玻璃卡片 `--glass-bg` ≈ **30% 不透明白** |
| 弹窗 | info/warning/error 深色半透明 ≈ **20% 不透明度** + 彩色边框 |
| 字体 | Inter（正文）+ JetBrains Mono（数值/坐标/错误码） |
| BEV/Overview | **禁止暗色底图** — 点云 `#1a1a1a`~`#4a4a4a` on `#F7F8FA` |
| 颜色 | 仅使用 CSS 变量，禁止硬编码 hex |

---

## 1. WHAT — Web 负责什么

| 职责 | 说明 |
|------|------|
| 实车监控 | AGV 位姿、导航、电池、任务、告警 |
| 感知可视化 | LiDAR、Camera、QR、Face、BEV/Overview |
| 受控操作 | 导航、机械臂、重启（分级权限） |
| 诊断 | ROS2、API 延迟、日志（**仅管理员**） |
| 故障呈现 | 三色 Alert 弹窗 + Event Timeline（V2） |

**不负责**：仿真障碍物编辑、Gazebo 物理、在线改地图。

---

## 2. WHY — 为何独立 Real Web V2

| 问题（当前 V0.52） | V2 目标 |
|-------------------|---------|
| Widget 纵向堆叠 | 区域 + 分组 + 主视图中心 |
| 仿真/实车 UI 混杂 | Real 模式零仿真控件 |
| 单模块崩溃风险（已部分修复 0.52.1） | 组件级错误边界 |
| 每 Widget 独立 poll | 集中 StateStore |
| Debug 与操作混排 | OBSERVE / CONTROL / DANGER 三级 |

---

## 3. WHO / WHEN / WHERE / HOW

### 用户角色（V0.52.2+）

| 角色 | 权限 |
|------|------|
| **admin** (`ubuntu`) | 全部功能 + Debug + 注册用户 |
| **user** | 监控/控制，无 Debug、无全量日志 Widget |

### 数据来源

| 数据 | 来源 | 进入 Web |
|------|------|----------|
| AGV 状态 | ROS2 `agv/status` + Robokit adapter | `/api/state` |
| 导航 | adapter batch 1100 | `alerts`, `agv.*` |
| 机械臂 | DDS `arm/*` | `/api/arm/*` |
| Camera | ROS2 + HTTP snapshot | `/api/camera/*`, vision APIs |
| LiDAR | smap + live scan | `state.laser` |
| 告警 | `_collect_system_alerts()` | `state.alerts[]` with `raw` |
| 重启 | `stack_supervisor` | `GET /api/restart/components` |

---

## 4. 现有代码审计

### 4.1 后端 (`delivery_web/`)

| 文件 | 版本 | 判定 | 说明 |
|------|------|------|------|
| `dashboard_node.py` | 0.52.2 | **REFACTOR** | 早期 HTTP 绑定、auth、alerts、restart API |
| `web_auth.py` | new | **KEEP** | 会话 + 用户注册 |
| `stack_supervisor.py` | — | **KEEP** | 关联件重启 |
| `vision/wrist_camera.py` | — | **KEEP** | `_qr_busy` 已修复 |
| `agv_adapter/` | — | **KEEP** | manualBlock, tracking |

### 4.2 前端 (`www/`)

| 文件 | 判定 | 说明 |
|------|------|------|
| `index.html` | **REFACTOR → V2** | 主控制台，含地图 Canvas |
| `widgets.js` | **REFACTOR** | Widget 管理器，无 minimize（已删） |
| `alert_queue.js` | **KEEP** | FIFO 6，三色弹窗 |
| `auth.js` | **KEEP** | 登录/权限 |
| `arm_widget.js` | **REFACTOR** | 拆为 Arm State / Control |
| `verbose_log_widget.js` | **KEEP (admin)** | Debug 全量日志 |
| `debug/index.html` | **REFACTOR** | 管理员专用，待亮色化 |
| `status_banner.js` | **REMOVE** | 已由 alert_queue 替代 |

### 4.3 API 清单（必须兼容）

```
GET  /api/version          /api/state           /api/heartbeat
GET  /api/restart/components
POST /api/restart/component /api/restart/docker  (DANGER)
GET  /api/arm/status       /api/vision/*
GET  /api/auth/session
POST /api/auth/login       /api/auth/logout     /api/auth/register (admin)
GET  /api/debug            (admin only)
```

---

## 5. KEEP / REFACTOR / REMOVE / NEW

### KEEP（复用数据逻辑）

- `alert_queue.js` + `_collect_system_alerts()`
- `agv_adapter` manualBlock / tracking 解析
- `stack_supervisor` 重启白名单
- Canvas 地图绘制基础（点云、站点、路径）
- V0.52.1 启动架构（早期 HTTP、异步 smap）

### REFACTOR

- 页面布局 → Grid + Group + 主视图
- `pollState()` → `StateStore` 单点轮询
- Widget 注册表 → `ComponentRegistry` + `GroupRegistry`
- 曲线 → `TelemetryStore` ring buffer
- BEV → `SceneRenderer` + `CameraController`

### REMOVE（Real 模式）

- 仿真障碍物 UI
- `status_banner.js`
- Widget minimize
- 非管理员 Debug 入口

### NEW（V2 阶段）

| 模块 | Phase |
|------|-------|
| `StateStore` | 2 |
| `TelemetryStore` | 2 |
| `SceneRenderer` / `ViewController` | 3 |
| Third Person / BEV orbit | 3 |
| Navigation / Motion Groups | 4 |
| Event Timeline | 6 |
| 组件错误边界 | 7 |

---

## 6. 曲线数据来源审计

| 曲线 | 后端字段 | 状态 |
|------|----------|------|
| velocity | `agv.vx/vy` or speed | **MEASURED** (ROS) |
| acc_long / acc_lat | — | **BACKEND MISSING** — UI 显示 NO DATA |
| jerk_long / jerk_lat | — | **BACKEND MISSING** |
| yaw_rate | `agv` angular | 待确认 topic |
| tracking_error | adapter | 部分可用 |

> 禁止前端差分伪造为 Measured。

---

## 7. 冲突与迁移

| CONFLICT | CURRENT | TARGET | MIGRATION |
|----------|---------|--------|-----------|
| 一列 Widget | `widgets.js` absolute | CSS Grid groups | Phase 2-3 渐进 |
| 暗色 Debug 页 | `debug/index.html` | 亮色或隔离 | Phase 6 |
| 每组件 fetch | 分散 | StateStore | Phase 2 |
| 登录 | 无 → 0.52.2 有 | 全用户必须登录 | **已实施** |

---

## 8. V0.52.2 已交付（Auth 审计 + Phase 2 脚手架）

- [x] 设计令牌补全（`--info`, JetBrains Mono）
- [x] 毛玻璃透明度：卡片 ~30%，Alert ~20%
- [x] 「重启系统」→ **「重启容器」**（明确 Docker only，非 NUC reboot）
- [x] 管理员/用户登录（ubuntu/ubuntu，首次须改密）
- [x] PBKDF2 密码哈希 + 登录限速
- [x] 危险 API（restart/stack）管理员鉴权
- [x] Debug token 改 postMessage（无 URL 泄露）
- [x] `AUTH_SECURITY_AUDIT.md` 安全审计
- [x] Phase 2 脚手架：`www/v2/state_store.js`, `component_registry.js`, `group_registry.js`

---

## 9. 开发阶段（后续）

```
Phase 1  ✅ 本文档 + 设计规范 + Auth 审计
Phase 2  🔄 StateStore / ComponentRegistry / GroupRegistry（脚手架已建，禁止往 widgets 列加组件）
Phase 3  SceneRenderer / BEV / Third Person
Phase 4  Navigation + Motion Groups
Phase 5  Perception / Camera / Arm
Phase 6  Debug / Event Timeline
Phase 7  性能 + 错误隔离验收
Phase 8  NUC 实车 REAL WEB V2 PASS
```

---

## 10. 验收标准（摘要）

见 GPT 技术提示词第四十四节。关键：

- Real 模式无仿真控件
- BEV 亮色底 + 深色点云
- View 操作不发 cmd_vel
- 单组件故障不白屏
- 60s+ 无内存泄漏

---

*Generated: 2026-08-17 · AGV Real Web V2 Phase 1*
