/**
 * User layout persistence — GET/POST /api/user/layout (per-user, cross-device).
 */
(function (global) {
  'use strict';

  class LayoutStore {
    async load() {
      if (!global.Auth || !global.Auth.isLoggedIn()) return null;
      try {
        const r = await fetch('/api/user/layout', { headers: global.Auth.headers() });
        if (!r.ok) return null;
        const j = await r.json();
        return j.layout || j;
      } catch (e) {
        console.warn('[LayoutStore] load failed', e);
        return null;
      }
    }

    async save(layout) {
      if (!global.Auth || !global.Auth.isLoggedIn()) return false;
      try {
        const r = await fetch('/api/user/layout', {
          method: 'POST',
          headers: global.Auth.headers(),
          body: JSON.stringify({ layout }),
        });
        const j = await r.json();
        return !!j.success;
      } catch (e) {
        console.warn('[LayoutStore] save failed', e);
        return false;
      }
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.LayoutStore = LayoutStore;
  global.layoutStore = global.layoutStore || new LayoutStore();
})(window);
