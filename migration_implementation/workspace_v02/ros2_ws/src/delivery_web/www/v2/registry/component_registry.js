/**
 * Phase 2 — ComponentRegistry
 */
(function (global) {
  'use strict';

  const LIFECYCLE = { REGISTERED: 1, MOUNTED: 2, ACTIVE: 3, DESTROYED: 4 };

  class ComponentRegistry {
    constructor() {
      this._defs = new Map();
      this._instances = new Map();
      this._stats = new Map();
    }

    register(id, def) {
      if (!id || !def || typeof def.mount !== 'function') {
        throw new Error('ComponentRegistry: id and mount() required');
      }
      this._defs.set(id, Object.assign({ id, group: def.group || 'system' }, def));
      this._stats.set(id, {
        mountTime: 0,
        lastUpdate: 0,
        updateCount: 0,
        errorCount: 0,
        lastError: null,
        lifecycle: LIFECYCLE.REGISTERED,
      });
    }

    get(id) { return this._defs.get(id); }
    list() { return Array.from(this._defs.values()); }
    getStats(id) { return Object.assign({}, this._stats.get(id)); }
    allStats() {
      const out = {};
      this._stats.forEach((v, k) => { out[k] = Object.assign({}, v); });
      return out;
    }

    _canMount(def) {
      const perm = def.requiredPermission;
      if (!perm) return true;
      if (perm === 'admin') {
        return global.Auth && global.Auth.isAdmin && global.Auth.isAdmin();
      }
      return true;
    }

    mount(id, container, ctx) {
      const def = this._defs.get(id);
      if (!def) throw new Error(`Component not registered: ${id}`);
      if (!this._canMount(def)) {
        const stub = document.createElement('div');
        stub.className = 'v2-component-denied';
        stub.textContent = '需要管理员权限';
        container.appendChild(stub);
        return null;
      }
      this.destroy(id);
      const host = document.createElement('div');
      host.className = `v2-component v2-component-${id.replace(/\./g, '-')}`;
      host.dataset.componentId = id;
      container.appendChild(host);
      const st = this._stats.get(id);
      let api = null;
      try {
        api = def.mount(host, ctx || {}) || {};
        st.mountTime = Date.now();
        st.lifecycle = LIFECYCLE.MOUNTED;
      } catch (err) {
        st.errorCount += 1;
        st.lastError = String(err.message || err);
        host.innerHTML = `<div class="v2-component-error" role="alert">${id}: ${st.lastError}</div>`;
        if (global.eventStore) global.eventStore.componentError(id, err);
        console.error(`[ComponentRegistry] mount ${id}`, err);
      }
      const inst = { id, host, api, def, lifecycle: st.lifecycle };
      this._instances.set(id, inst);
      return inst;
    }

    update(id, ctx) {
      const inst = this._instances.get(id);
      if (!inst || !inst.api || typeof inst.api.update !== 'function') return;
      const st = this._stats.get(id);
      try {
        inst.api.update(ctx || {});
        st.lastUpdate = Date.now();
        st.updateCount += 1;
        st.lifecycle = LIFECYCLE.ACTIVE;
      } catch (err) {
        st.errorCount += 1;
        st.lastError = String(err.message || err);
        if (global.eventStore) global.eventStore.componentError(id, err);
        const errEl = inst.host.querySelector('.v2-component-runtime-error');
        if (errEl) errEl.textContent = st.lastError;
        else {
          const d = document.createElement('div');
          d.className = 'v2-component-runtime-error';
          d.textContent = st.lastError;
          inst.host.appendChild(d);
        }
      }
    }

    unmount(id) { this.destroy(id); }

    destroy(id) {
      const inst = this._instances.get(id);
      if (!inst) return;
      try {
        const fn = (inst.api && inst.api.destroy) || (inst.api && inst.api.unmount);
        if (typeof fn === 'function') fn();
      } catch (err) {
        console.error(`[ComponentRegistry] destroy ${id}`, err);
      }
      inst.host.remove();
      this._instances.delete(id);
      const st = this._stats.get(id);
      if (st) st.lifecycle = LIFECYCLE.DESTROYED;
    }

    destroyAll() {
      Array.from(this._instances.keys()).forEach((id) => this.destroy(id));
    }

    updateAll(ctx) {
      this._instances.forEach((_, id) => this.update(id, ctx));
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.ComponentRegistry = ComponentRegistry;
  global.componentRegistry = global.componentRegistry || new ComponentRegistry();
})(window);
