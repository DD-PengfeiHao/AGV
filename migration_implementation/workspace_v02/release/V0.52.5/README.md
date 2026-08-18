# V0.52.5 — MapManager V1 + Web V2 Design Pack

> **Branch**: `release/v0.52.5-map-manager`  
> **Includes**: V0.52.4 BlackBox + MapManager V1 + V2 PoC  
> **NUC**: Dev-only by default (NUC baseline remains V0.52.1 unless explicitly promoted)

## What's new

| Area | Change |
|------|--------|
| MapManager | Auto detect AGV map, persistent cache, async download, preload, point-cloud fallback |
| UI | Removed manual map dropdown / refresh — MapManager drives lifecycle |
| Docs | `MAP_MANAGER_*`, V2 component checklist, Stitch design screens |
| Version | `0.52.5` |

## Design references (Stitch + 项目材料)

- `AGVAPI文档/项目材料/AGV_Web_V2_组件详细清单.md` — 72+ components vs Robokit APIs
- `AGVAPI文档/项目材料/AGV_Web_V2_最终完整提示词.md` — full V2 spec
- `release/V0.52.5/DESIGN.md` — Stitch design tokens
- `release/V0.52.5/stitch/` — generated Overview + BEV mockups (after Stitch run)

## Stage / deploy

```powershell
.\release\V0.52.5\stage_v0525.ps1
```

Optional NUC (BlackBox verify only — no unlock/nav acceptance):

```bash
ssh ubuntu@172.31.0.84 'BB_PASS="..." bash /tmp/v0525_deploy/verify_nuc.sh'
```

## GitHub provenance

- Branch: `release/v0.52.5-map-manager`
- Tag: `v0.52.5-map-manager`
