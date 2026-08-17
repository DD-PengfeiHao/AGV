/**
 * BlackBox API client
 */
(function (global) {
  'use strict';

  function collectClientBundle() {
    const bundle = {
      scene: {},
      metrics: {},
      ui: { app_mode: global.APP_MODE || 'LEGACY' },
      browser_events: [],
    };

    if (global.V2Bootstrap && global.V2Bootstrap._viewController) {
      const cam = global.V2Bootstrap._viewController.getCamera();
      bundle.scene = {
        view_mode: global.V2Bootstrap._viewController.getMode(),
        yaw: cam.yaw,
        pitch: cam.pitch,
        distance: cam.distance,
        follow: cam.follow,
        target: { x: cam.targetX, y: cam.targetY, z: cam.targetZ },
      };
    }

    if (global.telemetryStore) {
      bundle.metrics = {
        velocity: global.telemetryStore.getLatest('velocity'),
        api_state: global.telemetryStore.getApiStats('api.state'),
      };
    }

    if (global.eventStore) {
      bundle.browser_events = global.eventStore.list().slice(-40);
    }

    if (global.Auth && global.Auth.user) {
      bundle.ui.user = global.Auth.user.username;
      bundle.ui.role = global.Auth.user.role;
    }

    return bundle;
  }

  const BlackBoxClient = {
    async status() {
      const r = await fetch('/api/blackbox/status', { headers: global.Auth?.headers?.() || {} });
      return r.json();
    },

    async trigger(opts) {
      const body = Object.assign({
        source: 'keyboard',
        key: 'CTRL+S',
        client: collectClientBundle(),
      }, opts || {});
      const r = await fetch('/api/blackbox/trigger', {
        method: 'POST',
        headers: global.Auth?.headers?.({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      return r.json();
    },

    async list(limit) {
      const r = await fetch(`/api/blackbox/list?limit=${limit || 20}`, { headers: global.Auth?.headers?.() || {} });
      return r.json();
    },

    async pollUntilDone(onTick) {
      const maxMs = 90000;
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        const st = await this.status();
        if (onTick) onTick(st);
        const state = st.state || '';
        if (state === 'COMPLETE' || state === 'FAILED') return st;
        if (!st.active_record && state === 'ARMED') return st;
        await new Promise((res) => setTimeout(res, 1000));
      }
      return { success: false, message: 'poll timeout' };
    },
  };

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.BlackBoxClient = BlackBoxClient;
  global.BlackBoxClient = BlackBoxClient;
})(window);
