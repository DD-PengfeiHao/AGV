# V0.53.0 — Web V2 Full Shell (real backend)

## What's in this release

| Area | Change |
|------|--------|
| **Overview** | Legacy `#map` + floating widgets (Jason / Leo / Arm / Nav) — all real APIs |
| **BEV** | Third-person canvas, LiDAR red→yellow→black gradient, orbit camera |
| **State** | `StateStore` polls `/api/state` @ 500ms (no mock) |
| **Components** | Grouped picker (11 categories), +/- buttons, search |
| **Auth** | No login wall for overview; logo → left slide login panel |
| **Layout** | `GET/POST /api/user/layout` per-user persistence |
| **Public read** | `/api/state`, vision status/snapshot without login |

## Deploy

```powershell
.\release\V0.52.5\stage_v0525.ps1
# then scp + deploy_nuc.sh on NUC
```

## Default widgets (first load)

AGV 状态, Jason Camera-A/B, Leo Camera, 机械臂, 导航, 操作日志
