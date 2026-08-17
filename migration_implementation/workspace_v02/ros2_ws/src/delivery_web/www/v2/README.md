# Real Web V2 — Phase 2 Scaffold

**Status**: Started in V0.52.2 (GitHub only). Not wired into `index.html` yet.

## Modules

| File | Role |
|------|------|
| `state_store.js` | Single `/api/state` poll + pub/sub |
| `component_registry.js` | Component mount/update/unmount lifecycle |
| `group_registry.js` | Collapsible groups — replaces widget column for new UI |

## Hard Rule (from architecture audit)

> **Do NOT add new components to `widgets.js` / `#widgetLayer`.**  
> All new Real Web V2 surfaces register via `ComponentRegistry` and mount inside `GroupRegistry` groups.

## Next Steps (Phase 2 continuation)

1. Add `#v2Layout` region in `index.html` (alongside legacy map, not replacing yet)
2. Load `v2/*.js` after `auth.js`
3. Migrate first group (e.g. OBSERVE status chips) as proof-of-concept
4. Connect `stateStore.start()` after login
