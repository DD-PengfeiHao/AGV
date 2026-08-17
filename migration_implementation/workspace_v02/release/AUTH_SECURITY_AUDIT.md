# V0.52.2 Auth Security Audit

> **Date**: 2026-08-17  
> **Scope**: `web_auth.py`, `dashboard_node.py` HTTP handler, `auth.js`, `index.html`, `debug/index.html`  
> **NUC**: Remains on **V0.52.1** — this audit covers GitHub-only V0.52.2

---

## Executive Summary

V0.52.2 introduces session-based login for all `/api/*` endpoints (except health/version/heartbeat). Critical gaps from the initial auth draft (unprotected restart APIs, weak password hashing, misleading「重启系统」label) are **mitigated** in this release. Residual risks are documented below.

| Area | Verdict |
|------|---------|
| Default `ubuntu/ubuntu` | ⚠️ Accepted bootstrap; **must_change_password** forces change on first login |
| Password storage | ✅ PBKDF2-HMAC-SHA256 (120k iter); legacy SHA256 upgraded on login |
| Session lifecycle | ✅ 48h TTL, sliding expiration, in-memory (lost on process restart) |
| Permission model | ✅ `user` vs `admin`; danger + admin routes enforced server-side |
|「重启系统」semantics | ✅ Clarified: **Docker container restart only**, not NUC `reboot` |

---

## 1. Default Administrator (`ubuntu` / `ubuntu`)

### Behavior

- On first start, if `web_users.json` has no `ubuntu` user, one is created with password from env `WEB_AUTH_ADMIN_PASSWORD` (default `ubuntu`).
- `must_change_password: true` is set; UI blocks normal use until password is changed (min 8 chars).
- Admin cannot be registered via `/api/auth/register`.

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Known default credentials on LAN | **High** | Force password change; recommend setting `WEB_AUTH_ADMIN_PASSWORD` before first boot in production |
| Credentials in env leak | Medium | Document env var; file `web_users.json` chmod `600` |

### Recommendation (post-V0.52.2)

- On NUC deploy: set `WEB_AUTH_ADMIN_PASSWORD` to a strong secret **before** first container start, or change password immediately after deploy.
- Consider disabling password login from WAN; keep dashboard on factory VLAN only.

---

## 2. Password Storage

### Implementation

```
PBKDF2-HMAC-SHA256, 120,000 iterations, per-user random 16-byte hex salt
Stored format: pbkdf2:<iterations>:<hex_digest>
```

- Legacy `sha256(salt:password)` hashes are verified once, then re-hashed to PBKDF2 on successful login.
- User file: `$MAPS_RW_DIR/web_users.json` (default `/opt/delivery_ws/maps_rw/web_users.json`), mode `600`.

### Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No pepper/HSM | Low | Acceptable for isolated AGV LAN |
| File backup exposes hashes | Medium | Protect backups; chmod 600 |
| Brute force offline | Medium | PBKDF2 120k iter; online rate limit 8 / 5 min |

---

## 3. Session Lifecycle

| Property | Value |
|----------|-------|
| Storage | In-process dict (`_sessions`) |
| TTL | 48 hours (`WEB_AUTH_SESSION_TTL_SEC`, default 172800) |
| Renewal | Sliding — each validated request extends expiry |
| Transport | `Authorization: Bearer <token>` or `agv_session` cookie or `X-Session-Token` |
| Client | `sessionStorage` key `agv_session_token` |

### Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Sessions lost on dashboard restart | Low | Users re-login; acceptable |
| No server-side session revocation list | Low | Logout clears token; restart clears all |
| Token in sessionStorage | Medium | XSS could steal token; no httpOnly cookie yet |
| HTTP (not HTTPS) on LAN | Medium | Acceptable on isolated network; use TLS if exposed |

---

## 4. Permission Model

### Roles

| Role | Capabilities |
|------|----------------|
| **admin** | All APIs, Debug console (:1999), register users, restart APIs, verbose_log widget |
| **user** | Monitor + control (navigate, arm, stations, etc.); no debug/logs/restart |

### Route Guards (`dashboard_node.py` → `_guard_api`)

| Class | Paths | Requirement |
|-------|-------|-------------|
| Public | `/api/health`, `/api/version`, `/api/heartbeat`, `/api/auth/login` | None |
| Login required | All other `/api/*` | Valid session |
| Admin | `/api/debug`, `/api/logs`, `/api/log/*`, `/api/diag/*` | `role == admin` |
| Danger | `/api/restart/docker`, `/api/restart/component`, `/api/stack/ensure` | `role == admin` |
| Debug port (:1999) | All `/api/*` on debug server | Admin only |

### Fixes Applied (V0.52.2)

- **Before**: `/api/restart/*` had no auth — anyone on LAN could restart container/components.
- **After**: Danger routes require admin session; UI hides restart buttons for non-admin.

---

## 5.「重启系统」Semantics — Docker vs NUC Reboot

### Actual Implementation

```python
# dashboard_node.restart_docker()
subprocess.run(["docker", "restart", container], ...)  # whitelist: delivery_gazebo_soft
```

| User-facing label (old) | Actual action |
|-------------------------|---------------|
| 「重启系统」 | `docker restart delivery_gazebo_soft` |
| NUC host `reboot` | **NOT implemented** — no API calls `reboot` or `shutdown` |

### V0.52.2 UI Fix

- Button renamed to **「重启容器」**
- Modal explains: Docker container restart only; **does not** reboot NUC hardware
- API response message includes `action: "docker_restart"`

### Component Restart

`/api/restart/component` restarts individual supervised processes **inside** the container via `stack_supervisor` — also not a NUC reboot.

---

## 6. Debug Console Token Handling

### Before

- Debug opened with `?token=...` in URL → leaks via browser history, server logs, Referer.

### After

- Main console opens debug window and sends token via `postMessage` to `:1999` origin.
- Debug page listens for `agv_session` message from `:19999` only.
- URL query token support **removed**.

---

## 7. Rate Limiting & Login

- 8 failed attempts per username per 5-minute window.
- Generic error message「用户名或密码错误」— no username enumeration.

---

## 8. Residual Risks / Future Work

| Item | Priority | Phase |
|------|----------|-------|
| httpOnly secure cookie instead of sessionStorage | Medium | 2+ |
| CSRF token for state-changing POSTs | Low (LAN) | 3+ |
| Audit log for danger actions | Medium | 4+ |
| Session persistence across restart (Redis/file) | Low | 6+ |
| TLS termination for dashboard | Medium if WAN | Deploy |

---

## 9. Sign-off Checklist

- [x] Restart APIs require admin auth (server-side)
- [x] PBKDF2 password hashing with legacy migration
- [x] Default admin must change password on first login
- [x] Session TTL 48h with sliding window
- [x]「重启系统」renamed and documented as Docker-only
- [x] Debug token not passed in URL
- [x] No semantic/security blockers for Phase 2

**Approved to proceed**: Phase 2 — `StateStore` + `ComponentRegistry` + `GroupRegistry`
