# V0.52.4 Black Box Release

> **Branch**: `release/v0.52.4-blackbox`  
> **Provenance commit**: see tag `v0.52.4-blackbox`  
> **Scope**: BlackBox V1 + Phase 2 PoC + Auth (V0.52.2–V0.52.4 stack)  
> **NUC deploy mode**: **BlackBox-only verify** — no unlock/grasp/navigation acceptance

## Camera Ring Buffer (30s)

| Parameter | Value | Meaning |
|-----------|-------|---------|
| `CAMERA_BUFFER_MAX_AGE_SEC` | 30 | Wall-clock retention (must exceed T-20s window) |
| `CAPTURE_PRE_SEC` | 20 | Exported pre-trigger window |
| `MAX_CAMERA_FRAMES_PER_CAM` | 240 | `8 FPS × 30s` RAM safety cap; **time eviction is primary** |

`retention_ok` in `/api/blackbox/status` → true when `oldest_age_sec >= 20` after warm-up.

## Deploy

```bash
# On dev machine: stage to NUC /tmp/v0524_deploy (see stage_v0524.ps1)
ssh ubuntu@172.31.0.84 'bash /tmp/v0524_deploy/blackbox_deploy_nuc.sh'

# Verify requires Web admin password (NUC may have changed from default ubuntu/ubuntu)
# Option A: env var
ssh ubuntu@172.31.0.84 'BB_PASS="your-web-password" bash /tmp/v0524_deploy/blackbox_verify_nuc.sh'
# Option B: password file on NUC host (chmod 600)
# echo -n 'your-web-password' > ~/Pengfei.Hao/.web_auth_pass && chmod 600 ~/Pengfei.Hao/.web_auth_pass
ssh ubuntu@172.31.0.84 'bash /tmp/v0524_deploy/blackbox_verify_nuc.sh'
```

## BlackBox-only verification

- `/api/version` → `0.52.4`
- `/api/blackbox/status` → ARMED, camera buffer warm 25s+
- `POST /api/blackbox/trigger` → COMPLETE bundle under `~/Pengfei.Hao/blackbox/`
- **Does NOT** run navigate / arm / unlock tests
