# Black Box V1 Test Report

> Environment: dev (Windows), V0.52.4, **no NUC deploy**

## Automated / Code Review

| Test | Result | Notes |
|------|--------|-------|
| Python module import | PASS | `blackbox/*.py` syntax valid |
| POST returns immediately | PASS | No sleep in HTTP handler |
| Post window uses monotonic | PASS | `_record_end_mono` |
| Pre-buffer before trigger | PASS | 30s retention, export T-20s |
| Duplicate Ctrl+S | PASS | Ignored while CAPTURING_POST |
| Editable field Ctrl+S | PASS | Shortcut skips input/textarea |
| BlackBox init failure | PASS | Dashboard starts if import fails |
| Path traversal on record id | PASS | Sanitized lookup |
| Async disk write | PASS | DiskWriter thread |

## Manual Tests Required (on running dashboard)

| Test | Status |
|------|--------|
| Normal Ctrl+S → COMPLETE bundle | PENDING manual |
| 5× Ctrl+S → single capture | PENDING manual |
| Disk full simulation | PENDING manual |
| Camera offline partial capture | PENDING manual |
| 10 min RAM stability | PENDING manual |

## Known Limitations (V1)

1. Planning/Control buffers not implemented — marked `not_available` in manifest.
2. No MP4 / full frame sequence export.
3. `acc_long/jerk` telemetry **BACKEND MISSING** — not fabricated.
4. Browser-only storage not used (by design).
5. Wrist camera frame depends on vision pipeline availability.
