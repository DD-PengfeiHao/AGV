# Black Box Schema V1

## Record ID

`YYYYMMDD_HHMMSS` with `_01` suffix on collision.

## Path

`{BLACKBOX_DIR|~/Pengfei.Hao/blackbox}/{YYYYMMDD}/{record_id}/`

## Timestamp Fields (all JSONL rows)

```json
{
  "timestamp_wall": "2026-08-18T00:24:00.123+08:00",
  "timestamp_mono_ns": 1234567890123,
  "source_clock": "dashboard|web|ros|camera",
  "data": { }
}
```

Internal ring buffer uses `_ts` (float wall seconds) for window slicing.

## manifest.json

| Field | Type | Description |
|-------|------|-------------|
| record_id | string | Event ID |
| version | string | BlackBox schema version |
| trigger_time | ISO8601 | T0 |
| record_start | ISO8601 | T0 - 20s |
| record_end | ISO8601 | T0 + 20s |
| operator | string | Triggering user |
| trigger_source | string | keyboard / button / api |
| sources | object | per-source complete/partial/unavailable |
| files | array | path, size, sha256 |

## snapshot/state.json

Full `/api/state` at T0 plus `captured_at`, `schema_version`.

## snapshot/scene.json

From frontend: view_mode, yaw, pitch, distance, follow, target.

## frame/frames.json

Per camera: status, frame_timestamp, trigger_timestamp, delta_ms, file path.

## Log Row Schema

```json
{
  "timestamp_wall": "...",
  "timestamp_mono_ns": 0,
  "source_clock": "dashboard",
  "data": {
    "level": "ERROR",
    "source": "navigation",
    "component": "planner",
    "code": "PLANNER_FAILED",
    "message": "...",
    "data": {}
  }
}
```

## API

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/blackbox/trigger` | logged-in user |
| GET | `/api/blackbox/status` | logged-in |
| GET | `/api/blackbox/list` | logged-in |
| GET | `/api/blackbox/record?id=` | logged-in |
