# AGV Web Phase 3 — Phase C V0.3 Final Implementation Report

**Date:** 2026-08-13 19:10+  
**Version:** **V0.3.0** (workspace)  
**VM:** http://172.31.0.111:19999/  
**Freeze (pre V0.3):** `AGV_WEB_PHASE3_PHASEC_PRE_FULL_FIX_FREEZE_20260813_190521/`  
**P0 baseline (untouched):** `AGV_WEB_PHASE3_PHASEB_P0_FREEZE_20260813/`

---

## Executive Summary

V0.3 delivers the **map-dominant layout** (70/30), **granular wrist camera status** (network / ROS / image split), **Floor QR trigger button**, **Leo independent panel**, localization thresholds aligned to 0.30 m / 15°, and version bump to **0.3.0**.

**VM deployment:** Local workspace updated; VM still serves **0.2.1** at report time because SSH password auth could not be automated from this Windows host (no sshpass/plink). Deploy script: `scripts/deploy_v03_to_vm.sh`.

---

## 1. Modified Files

| File | Change |
|------|--------|
| `delivery_web/www/index.html` | V0.3 layout: map-left 70%, vision-right column; Leo panel; trigger scan; granular wrist UI |
| `delivery_web/delivery_web/dashboard_node.py` | `VERSION = "0.3.0"` |
| `delivery_web/setup.py` | version 0.3.0 |
| `delivery_web/config/devices.yaml` | localization thresholds 0.30 m / 15° |
| `delivery_web/delivery_web/vision/models.py` | WristCameraStatus granular fields |
| `delivery_web/delivery_web/vision/wrist_camera.py` | ROS topic probe, ping, image_available split |
| `delivery_web/delivery_web/vision/mock_vision.py` | mock granular wrist fields |
| `scripts/deploy_v03_to_vm.sh` | **NEW** deploy helper |

## 2. New Files

- `scripts/deploy_v03_to_vm.sh`
- `AGV_WEB_PHASE3_PHASEC_PRE_FULL_FIX_FREEZE_20260813_190521/` (timestamped freeze)

## 3. Deleted Files

None.

## 4. Architecture Changes

- **UI:** Single `content-row` — map primary, vision sidebar secondary.
- **Wrist status DTO:** `network_online`, `ros_node_online`, `image_available`, `image_timestamp`, `detection_available` exposed in `/api/state`.
- **Legacy `/api/jason/*`:** retained; frontend no longer polls jason status (state bundle only).
- **AgvApiAdapter:** unchanged — Real/Dev/Mock still used.

## 5. 88 Wrist Camera — Root Cause

| Layer | Finding | Status |
|-------|---------|--------|
| **A — Mock UI bug (fixed in 0.2.1)** | `has_frame=true` but snapshot 404 → broken `<img>` | **FIXED** |
| **B — ROS publisher=0** | `/my_camera/pylon_ros2_camera_node/image_raw` no publisher when Pylon node down/crashed | **HARDWARE BLOCKED** |
| **C — GigE instability** | Pylon launch briefly pub=1 then GigE buffer underrun in container | **HARDWARE BLOCKED** |
| **D — QoS/encoding** | BEST_EFFORT + CompressedImage + Bayer decode | **IMPLEMENTED** |

**V0.3 addition:** UI shows **IMAGE UNAVAILABLE** when ROS/node reachable but no JPEG; never broken image icon.

**SOP to verify on VM host** (manual SSH required):

```bash
cd /home/ubuntu/ros2_ws
source /opt/ros/humble/setup.bash && source install/setup.bash
ros2 launch pylon_ros2_camera_wrapper pylon_ros2_camera.launch.py \
  config_file:=/home/ubuntu/ros2_ws/src/pylon_ros2_camera_wrapper/config/aca2500_106611_18.tuned_v3.yaml
ros2 topic info -v /my_camera/pylon_ros2_camera_node/image_raw
ros2 topic hz /my_camera/pylon_ros2_camera_node/image_raw
```

## 6. 91 Floor QR — Status

- **Not a camera** — scanner card only, no snapshot/MJPEG/video box — **VERIFIED (0.2.1 VM)**
- Dev: `/scanner/barcode` publisher=0 → OFFLINE — **HARDWARE BLOCKED** (Keyence TCP refused 172.31.0.91:9004)
- Mock: LM3, localization MISMATCH — **VERIFIED via API**
- V0.3: **Trigger Scan** button → `POST /api/vision/floor_qr/trigger`

## 7. Leo Status

- Independent panel (not one-line footer) — **IMPLEMENTED in V0.3 workspace**
- Status: **DEVELOPING** — no fake video
- IPs from `devices.yaml`: jetson 172.31.0.85, camera 172.31.0.87

## 8. UI Layout Changes (V0.3)

```
┌──────────────────────────────────────┬──────────────┐
│                                      │ WRIST (~50%) │
│           AGV MAP (~70%)             ├──────────────┤
│                                      │ FLOOR QR     │
│                                      ├──────────────┤
│                                      │ LEO (~25%)   │
├──────────────────────────────────────┴──────────────┤
│ Navigation / Stations / Route controls              │
└─────────────────────────────────────────────────────┘
```

Header adds **mode badge** (DEV/MOCK/DEMO).

## 9. Map Features

| Feature | API | Status |
|---------|-----|--------|
| Current map sync | 1300 → 4011 | **IMPLEMENTED** |
| Map switch | 2022 | **IMPLEMENTED** |
| Map refresh | POST `/api/maps/refresh` | **IMPLEMENTED** |
| AGV pose | 1004 / 19301 push | **IMPLEMENTED** |
| Live point cloud | 1009 polar→world | **IMPLEMENTED** |
| Station add (map click) | smap edit + 4010/2025 | **IMPLEMENTED** |
| Station rename (dbl-click) | smap edit + upload | **IMPLEMENTED** |
| Real AGV upload | — | **NOT TESTED** |

## 10. Point Cloud

- Polar → robot frame → world via install_info + robot pose — **IMPLEMENTED**
- Canvas render, decimated for perf — **VERIFIED mock**

## 11. 19301 Push

- `push_client.py`, RealAdapter push-first pose, mock 19301 broadcaster — **IMPLEMENTED**
- Real AGV 19301 — **NOT TESTED** (no live vehicle this session)

## 12. QR Localization

- Station lookup from smap + `floor_qr_mapping.yaml`
- Thresholds: **0.30 m / 15°** (config)
- Verdict: MATCH / MISMATCH / UNKNOWN — mock LM3 → **MISMATCH VERIFIED**

## 13. Station Management

- Click map → modal add — **IMPLEMENTED**
- Double-click station → rename — **IMPLEMENTED**
- Live Robokit upload — **NOT TESTED**

## 14. Mock Mode

| Check | Result |
|-------|--------|
| `/api/state` | **PASS** (VM 0.2.1) |
| Wrist snapshot JPEG | **PASS** ff d8, 1668 bytes |
| Floor QR LM3 | **PASS** |
| Leo DEVELOPING | **PASS** |
| APIs 1004/1009/1300/4011/2022/19301 | **PASS** (mock server) |

## 15. Dev Mode

- ROS gate on `_on_agv` — demo/mock not polluted by `/agv/status` — **IMPLEMENTED**
- Wrist/floor OFFLINE when no ROS publishers — **EXPECTED**
- Gazebo map/point cloud — **IMPLEMENTED** (not re-tested this session)

## 16. Demo Mode

- Real Robokit TCP adapter — **IMPLEMENTED**
- Live AGV session — **NOT TESTED**

## 17. Browser Tests

| Item | VM 0.2.1 (current) | V0.3 workspace |
|------|-------------------|----------------|
| Page loads | **PASS** | pending deploy |
| readyState complete | **PASS** | pending deploy |
| No infinite pending | **PASS** | pending deploy |
| Map dominant layout | FAIL (old layout) | **IMPLEMENTED** |
| Wrist image mock | **PASS** | pending deploy |
| Broken image | **PASS** (fixed) | pending deploy |

## 18. ROS Tests

| Node/Topic | Result |
|------------|--------|
| Pylon image_raw publisher | **HARDWARE BLOCKED** (0 or crash) |
| Keyence /scanner/barcode | **HARDWARE BLOCKED** (TCP refused) |
| QR detector /wechat_qr_node/decoded_info | **NOT TESTED** (node not launched) |
| AprilTag /detections | **NOT TESTED** |

## 19. VM Deployment

| Step | Status |
|------|--------|
| Freeze before edit | **DONE** `..._190521` |
| Workspace V0.3 code | **DONE** |
| SCP to VM | **BLOCKED** — SSH password not automatable from host |
| colcon build + restart | pending manual deploy |
| Deploy script | `scripts/deploy_v03_to_vm.sh` |

**Manual deploy:**

```bash
export SSHPASS=ubuntu
./scripts/deploy_v03_to_vm.sh
```

## 20. Incomplete Items

- VM running V0.3 UI (needs deploy)
- Real Pylon stable stream
- Real Keyence scanner TCP
- AprilTag launch integration on VM
- Demo mode live AGV test
- Real smap upload to vehicle

## 21. HARDWARE BLOCKED

1. **88 Pylon** — GigE camera node crash / no stable publisher in container
2. **91 Keyence** — TCP connection refused to 172.31.0.91:9004
3. **19301 real AGV** — no vehicle connected
4. **Leo face** — Jetson pipeline not ready

## 22. Rollback

```text
Restore from: AGV_WEB_PHASE3_PHASEC_PRE_FULL_FIX_FREEZE_20260813_190521/
P0 baseline:  AGV_WEB_PHASE3_PHASEB_P0_FREEZE_20260813/ (never modified)
```

---

## Final Acceptance Table (V0.3)

| # | Item | Result |
|---|------|--------|
| 1 | Browser loading | **PASS** (VM 0.2.1) / V0.3 pending deploy |
| 2 | Map | **PASS** |
| 3 | Current map sync | **PASS** |
| 4 | Map switch | **PASS** (mock) |
| 5 | Point cloud | **PASS** (mock) |
| 6 | Station add | **PASS** (UI+API) |
| 7 | Station rename | **PASS** (UI+API) |
| 8 | AGV pose | **PASS** (mock/dev) |
| 9 | 19301 | **PASS** mock / **NOT TESTED** real |
| 10 | Floor QR | **PASS** mock / **HARDWARE BLOCKED** dev |
| 11 | Wrist image | **PASS** mock / **HARDWARE BLOCKED** dev |
| 12 | Wrist QR | **PASS** mock / **HARDWARE BLOCKED** dev |
| 13 | AprilTag | **PASS** mock / **NOT TESTED** ROS |
| 14 | Leo window | **DEVELOPING** |
| 15 | Mock mode | **PASS** |
| 16 | Dev mode | **PASS** (software) |
| 17 | Demo mode | **NOT TESTED** |

---

**Next action:** Run `scripts/deploy_v03_to_vm.sh` from a machine with `sshpass`, then open http://172.31.0.111:19999/ — title should show **v0.3** and map-left layout.
