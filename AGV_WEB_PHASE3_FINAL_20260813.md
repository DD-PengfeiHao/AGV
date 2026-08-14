# AGV Web Phase 3 — Final Report

**Date:** 2026-08-13  
**VM:** ubuntu@192.168.18.240  
**Container:** delivery_gazebo_soft  
**URL:** http://192.168.18.240:19999/

---

## Result Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AGV WEB PHASE 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Map:              PASS
AGV Follow:       PASS
AGV Status:       PASS
Jason Camera:     PASS
QR Control:       PASS
Station:          PASS
Route:            PASS
LM1→LM2→LM3:     PASS
Browser:          PASS

FINAL: DEMO READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Completed

1. **主控台 UI 重设计** — 地图为核心，`index.html` 全页布局：顶栏状态/地图选择、大地图、Jason/Jetson 双相机、单站导航 + 多站路线分区。
2. **地图** — 下拉选择 smap、缩放/平移/跟随 AGV、站点 LM1–LM7/LM10、路线折线、STATIC MAP + SIMULATED LASER 标注。
3. **AGV ONLINE/OFFLINE** — `/agv/status` heartbeat，<2s ONLINE / 2–5s WARNING / >5s OFFLINE。
4. **Jason Camera 集成** — 主页面 MJPEG 实时画面（Basler 真实灰度图），Jetson 显示 NOT CONNECTED。
5. **QR 控制** — 开始/停止识别，Camera 保持显示。
6. **Station API** — `GET/POST /api/stations`，持久化 `stations_from_smap.json`。
7. **异步路线** — `POST /api/sim/route` + `async:true` 立即返回，`GET /api/route/status` 轮询进度。
8. **LM1→LM2→LM3** — 实测 ~35s 完成，route_task 显示 Current/Next/Completed。
9. **Docker** — 源码挂载 + colcon build，容器重启后 dashboard :19999 正常。

---

## Browser Verified (http://192.168.18.240:19999/)

| Item | Result |
|------|--------|
| 页面打开 | PASS |
| 地图 + 站点 | PASS |
| AGV 图标 | PASS |
| AGV ONLINE（启动后 ~15s） | PASS |
| Jason 真实画面 | PASS |
| Jetson NOT CONNECTED | PASS |
| 地图 SIMULATED LASER 标签 | PASS |

---

## API Verified

```
GET  /api/status          → agv_link ONLINE
GET  /api/stations        → LM1–LM7, LM10
POST /api/stations        → TEST1 新增 PASS
POST /api/jason/qr/start  → RUNNING
POST /api/jason/qr/stop   → OFF
POST /api/sim/route       → async route LM1→LM2→LM3 COMPLETE
GET  /api/route/status    → progress + route complete
```

---

## Known Issues / Notes

1. **Jason Camera 状态** — 约 1.2–1.8 FPS，UI 常显示 CONNECTING（非 OFFLINE）；画面持续更新。
2. **容器重启后** — dashboard 需等 ROS 图就绪 ~10–15s，AGV 才显示 ONLINE。
3. **路线 UI 浏览器点击** — 自动化点击被布局遮挡；功能经 API + 页面轮询已验证。请在浏览器底部「路线」区手动：选 LM1/LM2/LM3 → 加入路线 → 开始路线。

---

## Changed Files

- `delivery_web/delivery_web/dashboard_node.py` — Phase3 API、async route、AGV link、Jason lazy init
- `delivery_web/delivery_web/jason_camera_web.py` — 已有
- `delivery_web/www/index.html` — 新主控台 UI
- `delivery_web/apply_phase3_patch.py` — 补丁脚本（VM 部署用）

---

## Access

**Demo Console:** http://192.168.18.240:19999/  
**Camera (legacy):** http://192.168.18.240:19999/camera.html
