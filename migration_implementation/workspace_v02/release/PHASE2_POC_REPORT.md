# Phase 2 PoC Report

> **Version**: V0.52.3 (dev, GitHub only)  
> **NUC**: V0.52.1 — **not deployed**  
> **Date**: 2026-08-18

## Summary

Phase 2 PoC establishes the Real Web V2 architecture: single `StateStore` polling, `ComponentRegistry` + `GroupRegistry` layout, Canvas 2D Overview scene, and AGV Observe group — all fed from `/api/state`.

---

## 1. Architecture — **PASS**

| Item | Status |
|------|--------|
| StateStore single poll source | ✅ 500ms, legacy `pollState` disabled in V2_MODE |
| ComponentRegistry lifecycle | ✅ register/mount/update/destroy + error isolation |
| GroupRegistry CSS Grid | ✅ 9 groups registered, PoC mounts AGV + Debug |
| Scene layer (no API) | ✅ SceneState ← StateStore → SceneRenderer |
| Auth binding | ✅ start on login, destroy on logout |
| Legacy parallel | ✅ `#legacyMain` hidden in V2; code preserved |
| No new widgets.js components | ✅ |

## 2. StateStore — **PASS**

| Check | Status |
|-------|--------|
| start() / stop() | ✅ |
| subscribe('agv', …) | ✅ |
| STALE on failure | ✅ retains last snapshot |
| Metadata (latency, failCount, version) | ✅ |
| No duplicate /api/state in V2_MODE | ✅ |

## 3. Registry — **PASS**

| Check | Status |
|-------|--------|
| Component register/mount/update/destroy | ✅ |
| Exception isolation | ✅ try/catch + runtime error UI |
| Group collapse | ✅ |
| Admin permission (debug group) | ✅ |
| Component stats API | ✅ `componentRegistry.allStats()` |

## 4. Scene — **PASS** (Overview PoC)

| Check | Status |
|-------|--------|
| Overview Canvas 2D | ✅ map cloud, curves, lidar, stations, AGV |
| Zoom (wheel) | ✅ |
| Pan (right-drag / shift+left) | ✅ |
| Follow / home | ✅ |
| View HUD (mode, yaw, pitch, distance) | ✅ |
| No motion commands from mouse | ✅ |
| BEV / Third Person | ⏸ stubbed (CameraController modes exist, renderer = Overview only) |

## 5. AGV Group — **PASS**

| Field | Source |
|-------|--------|
| Connected | `agv` + `agv_link` |
| Task / Station | `agv.task_status`, `current_station` |
| Pose X/Y/Heading | `agv.x/y/angle` |
| Velocity | `agv.vx/vy` |
| Manual Block / Blocked / Battery | `agv.*` |

All from live `/api/state` — no hard-coded values.

## 6. Performance

| Item | Notes |
|------|-------|
| Single poll instance | V2_MODE: one StateStore @ 500ms |
| DOM growth | Components update textContent only |
| rAF scene loop | One canvas, no duplicate legacy drawMap in V2 |
| 10-min soak | **Not run on NUC** — dev verification only |

## 7. Known Issues

1. **BEV / Third Person** — API present, full render deferred to Phase 3.
2. **Event Timeline UI** — EventStore exists; no timeline component yet.
3. **Navigation/Motion groups** — registered empty (by design).
4. **Legacy header** still uses `pollHeartbeat()` @ 800ms (not `/api/state`).
5. **Component re-register** on each bootstrap start — acceptable for PoC.

## 8. Migration Risk

| Risk | Level | Mitigation |
|------|-------|------------|
| Double polling | Low | APP_MODE guard |
| CSS/DOM conflict | Low | Separate `#v2Layout` / `#v2SceneCanvas` |
| NUC regression | None | No NUC deploy |
| Rollback | Trivial | `APP_MODE = 'LEGACY'` |

---

## PoC Checklist (Code Review)

### AUTH
- [x] 未登录看不到主界面
- [x] 登录后 V2 启动
- [x] logout 后 V2 停止
- [x] 普通用户不可看到 admin-only Debug

### STATE
- [x] 只有一个 /api/state polling (V2_MODE)
- [x] ~500ms
- [x] Store 可启动/停止
- [x] API failure → STALE, page survives

### REGISTRY / GROUP / SCENE / AGV
- [x] As above

### SAFETY
- [x] 鼠标拖动不发 motion command
- [x] 无设置障碍物 UI

---

## STOP — Next Phase

Per Phase 2 scope: **do not** continue with Arm, Navigation, Motion, Camera full migration until review.

**Suggested next**: Phase 3 — BEV/Third Person renderer, Telemetry charts, migrate Navigation group.
