# Real Web V2 — Phase 2 (PoC)

## Layout

```
www/v2/
├── app/bootstrap.js          # V2 entry (login → start, logout → destroy)
├── store/
│   ├── state_store.js        # Single /api/state poll
│   ├── telemetry_store.js    # Ring buffer metrics
│   └── event_store.js        # Timeline events
├── registry/
│   ├── component_registry.js
│   └── group_registry.js
├── scene/
│   ├── scene_state.js
│   ├── scene_renderer.js     # Canvas 2D Overview
│   ├── view_controller.js
│   └── camera_controller.js
├── components/
│   ├── agv/observe.js        # PoC AGV group
│   └── debug/metrics.js      # admin debug cards
└── styles/
    ├── layout.css
    └── components.css
```

## Mode

`window.APP_MODE = 'V2'` in index.html — disables legacy `pollState()`, uses StateStore @ 500ms.

Set to `'LEGACY'` to roll back without removing V2 code.

## Rule

**Do NOT add components to `widgets.js` or `#widgetLayer`.**
