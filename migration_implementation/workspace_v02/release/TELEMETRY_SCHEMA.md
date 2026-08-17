# Telemetry Schema (Phase 2)

> Phase 2 establishes `TelemetryStore` interface; most motion metrics are **BACKEND MISSING**.

## Ring Buffer

- Default window: last 100 samples per metric
- Push on each StateStore successful poll (where data exists)

## Metrics

| Metric | Source | Topic/Field | Unit | Rate | Status |
|--------|--------|-------------|------|------|--------|
| `velocity` | `/api/state` | `agv.vx`, `agv.vy` → `hypot` | m/s | ~2Hz | **MEASURED** (when agv connected) |
| `velocity_x` | `/api/state` | `agv.vx` | m/s | ~2Hz | **MEASURED** |
| `velocity_y` | `/api/state` | `agv.vy` | m/s | ~2Hz | **MEASURED** |
| `yaw_rate` | — | — | rad/s | — | **BACKEND MISSING** |
| `acc_long` | — | — | m/s² | — | **BACKEND MISSING** |
| `acc_lat` | — | — | m/s² | — | **BACKEND MISSING** |
| `jerk_long` | — | — | m/s³ | — | **BACKEND MISSING** |
| `jerk_lat` | — | — | m/s³ | — | **BACKEND MISSING** |
| `tracking_error` | — | adapter partial | m | — | **BACKEND MISSING** (no stable field) |
| `api.state.latency` | StateStore | fetch timing | ms | 500ms | **MEASURED** |
| `api.version.latency` | TelemetryStore | optional probe | ms | on-demand | **MEASURED** |

## Rules

- Do **not** differentiate velocity in frontend to fake acceleration/jerk.
- UI must show `NO DATA` / `BACKEND MISSING` for unavailable metrics.
- `telemetry[]` in `/api/state` is a historical deque (40 items) — not used for jerk/acc in Phase 2.
