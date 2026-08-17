/**
 * Phase 2 — ComponentRegistry
 * Lifecycle for V2 UI components (mount / update / unmount / error boundary).
 *
 * RULE: Do NOT register new components in widgets.js WIDGET_REGISTRY.
 *       All new Real Web V2 components go through ComponentRegistry + GroupRegistry.
 */
(function (global) {
  'use strict';

  class ComponentRegistry {
    constructor() {
      this._defs = new Map();
      this._instances = new Map();
    }

    register(id, def) {
      if (!id || !def || typeof def.mount !== 'function') {
        throw new Error('ComponentRegistry.register: id and mount() required');
      }
      this._defs.set(id, Object.assign({ id }, def));
    }

    get(id) {
      return this._defs.get(id);
    }

    list() {
      return Array.from(this._defs.values());
    }

    mount(id, container, ctx) {
      const def = this._defs.get(id);
      if (!def) throw new Error(`Component not registered: ${id}`);
      this.unmount(id);
      const host = document.createElement('div');
      host.className = `v2-component v2-component-${id}`;
      host.dataset.componentId = id;
      container.appendChild(host);
      let api = null;
      try {
        api = def.mount(host, ctx || {}) || {};
      } catch (err) {
        host.innerHTML = `<div class="v2-component-error" role="alert">${id}: ${err.message || err}</div>`;
        console.error(`[ComponentRegistry] mount failed: ${id}`, err);
      }
      const inst = { id, host, api, def };
      this._instances.set(id, inst);
      return inst;
    }

    update(id, ctx) {
      const inst = this._instances.get(id);
      if (!inst || !inst.api || typeof inst.api.update !== 'function') return;
      try {
        inst.api.update(ctx || {});
      } catch (err) {
        console.error(`[ComponentRegistry] update failed: ${id}`, err);
      }
    }

    unmount(id) {
      const inst = this._instances.get(id);
      if (!inst) return;
      try {
        if (inst.api && typeof inst.api.unmount === 'function') inst.api.unmount();
      } catch (err) {
        console.error(`[ComponentRegistry] unmount failed: ${id}`, err);
      }
      inst.host.remove();
      this._instances.delete(id);
    }

    unmountAll() {
      Array.from(this._instances.keys()).forEach((id) => this.unmount(id));
    }
  }

  global.ComponentRegistry = ComponentRegistry;
  global.componentRegistry = global.componentRegistry || new ComponentRegistry();
})(window);
