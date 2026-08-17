# Black Box Recorder V1 — Architecture

## Overview

Backend-centric incident capture: ring buffers run continuously; **Ctrl+S** (or API) triggers a **T-20s → T0 → T+20s** bundle written asynchronously to disk.

```
Browser Ctrl+S / POST /api/blackbox/trigger
        ↓
BlackBoxManager (dashboard_node)
        ↓
Ring Buffers (state, telemetry, events, alerts, logs, camera JPEG)
        ↓
Post-window wait (monotonic 20s)
        ↓
DiskWriter (background thread)
        ↓
~/Pengfei.Hao/blackbox/YYYYMMDD/YYYYMMDD_HHMMSS/
```

## Principles

| Rule | Implementation |
|------|----------------|
| No blocking control | Feeds are append-only; disk IO in worker thread |
| No extra /api/state poll | Backend `_blackbox_tick` @ 0.5s feeds from in-memory state |
| Frontend supplements only | Scene/UI/metrics sent once in trigger POST `client` bundle |
| Single active capture | State machine rejects concurrent triggers |
| Fast HTTP response | POST returns immediately with `CAPTURING_POST` |
| Fail-safe boot | BlackBox init failure → dashboard still starts |

## State Machine

`ARMED` → `CAPTURING_POST` → `FINALIZING` → `COMPLETE` | `FAILED` | `INTERRUPTED`

## Modules

| File | Role |
|------|------|
| `blackbox/schema.py` | Constants, timestamps, RecordStatus |
| `blackbox/ring_buffer.py` | Time/count bounded buffers + camera JPEG ring |
| `blackbox/manager.py` | State machine, feeds, trigger, list/get |
| `blackbox/writer.py` | Async disk writer queue |
| `www/v2/blackbox/*.js` | Ctrl+S, client API, UI component |

## Integration Points

- `dashboard_node._blackbox_tick` — state + wrist camera feed
- `dashboard_node._push_event` — event/log feed
- `dashboard_node._on_img` — cam_front/left/right JPEG feed
- `snapshot()` — full T0 snapshot on trigger

## Future Sources

`registerSource()` pattern reserved in manifest `sources` map for planning, control, navigation.
