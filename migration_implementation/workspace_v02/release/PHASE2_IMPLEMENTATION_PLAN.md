# Phase 2 Implementation Plan

## CURRENT (V0.52.2 @ b100aa4)

| Area | State |
|------|-------|
| Polling | `pollState()` @ 2500ms + `pollHeartbeat()` @ 800ms |
| Widgets | `widgets.js` + `#widgetLayer` vertical stack |
| Map | `#map` canvas, inline `drawMap()` in index.html |
| Auth | Login gates UI; no StateStore lifecycle binding |
| V2 scaffold | Basic `state_store.js`, `component_registry.js`, `group_registry.js` (not wired) |

## TARGET (Phase 2 PoC)

```
Backend → /api/state → StateStore (500ms, single poll)
    → TelemetryStore / EventStore
    → SceneState → SceneRenderer ← ViewController / CameraController
    → ComponentRegistry → GroupRegistry → #v2Layout
```

PoC scope: **Overview scene + AGV Observe group + Debug metrics (admin)**

## CHANGE

| # | Change | Files |
|---|--------|-------|
| 1 | Enhanced StateStore (STALE, subscribe by key, metadata) | `www/v2/store/state_store.js` |
| 2 | TelemetryStore + EventStore | `www/v2/store/*.js` |
| 3 | Enhanced registries + permissions | `www/v2/registry/*.js` |
| 4 | Scene layer (Canvas 2D Overview) | `www/v2/scene/*.js` |
| 5 | AGV observe components | `www/v2/components/agv/observe.js` |
| 6 | Debug components | `www/v2/components/debug/*.js` |
| 7 | Bootstrap + V2_MODE | `www/v2/app/bootstrap.js` |
| 8 | V2 layout DOM + styles | `index.html`, `www/v2/styles/*.css` |
| 9 | Disable legacy `/api/state` when `APP_MODE=V2` | `index.html` |
| 10 | Auth ↔ StateStore start/stop | `bootstrap.js`, `auth.js` hook |

## RISK

| Risk | Mitigation |
|------|------------|
| Double `/api/state` polling | `APP_MODE=V2` disables `pollState` interval |
| DOM/CSS conflict | `#v2Layout` separate from `#widgetLayer`; legacy map hidden in V2 |
| Scene vs legacy canvas | Independent `#v2SceneCanvas` |
| Global namespace clash | `window.AGV_V2` namespace |
| Logout后 scene 仍更新 | `V2Bootstrap.destroy()` stops store + unmounts |

## ROLLBACK

1. Set `window.APP_MODE = 'LEGACY'` in index.html
2. Remove v2 script tags (optional)
3. Legacy path unchanged — no backend changes
4. NUC stays V0.52.1 regardless

## NOT IN SCOPE (Phase 2 PoC)

- Arm / Navigation / Motion / Camera / Perception full groups
- WebGL / BEV full implementation (Overview only for PoC; BEV/Third Person API stubbed)
- NUC deploy
- Backend changes
