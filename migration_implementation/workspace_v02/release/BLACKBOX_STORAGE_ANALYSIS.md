# Black Box Storage Analysis

## Ring Buffer Retention

| Buffer | Max Age | Max Items | Notes |
|--------|---------|-----------|-------|
| State | 30s | 120 | ~2 Hz tick |
| Telemetry | 30s | 1200 | derived from state |
| Events/Alerts/Logs | 60s | 2400–5000 | dashboard events |
| Camera JPEG | 30s | 90/cam | in-memory only |

## RAM Estimate (worst case)

| Component | Estimate |
|-----------|----------|
| State JSON entries | ~120 × 2KB ≈ 240 KB |
| Telemetry | ~1200 × 200B ≈ 240 KB |
| Events/logs | ~5000 × 500B ≈ 2.5 MB |
| Camera (4 cams × 90 × 150KB) | **~54 MB** (dominant) |

**Total RAM ceiling ~60–80 MB** with 4 cameras at ~150KB/frame.

Mitigation: `MAX_CAMERA_FRAMES_PER_CAM=90`, JPEG only (no raw), time eviction.

## Disk Per Capture (40s window)

| Content | Estimate |
|---------|----------|
| state/telemetry/events JSONL | 1–5 MB |
| snapshot JSON | 0.5–2 MB |
| 4 camera single frames | 0.5–1 MB |
| **Total** | **~2–10 MB** typical |

No continuous video; no full 40s JPEG dump in V1.

## Disk Threshold

`MIN_DISK_FREE_MB = 5120` (5 GB) — below this trigger returns `DISK_FULL` SAFE_FAIL.

## IO Model

- Producer: ring buffer append (O(1))
- Consumer: single `DiskWriter` daemon thread
- No fsync storm; directory bundle not zip
