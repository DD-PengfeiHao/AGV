/**
 * Phase 2 — StateStore
 * Single source of truth for `/api/state` polling. Components subscribe; no per-widget fetch loops.
 *
 * RULE: New V2 components MUST use StateStore — do NOT add fetch/poll to widgets.js column.
 */
(function (global) {
  'use strict';

  const DEFAULT_INTERVAL_MS = 500;

  class StateStore {
    constructor(options) {
      this._intervalMs = (options && options.intervalMs) || DEFAULT_INTERVAL_MS;
      this._state = null;
      this._subs = new Set();
      this._timer = null;
      this._inFlight = false;
      this._lastError = null;
      this._lastFetchAt = 0;
    }

    get state() {
      return this._state;
    }

    get lastError() {
      return this._lastError;
    }

    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      this._subs.add(fn);
      if (this._state) {
        try { fn(this._state, null); } catch (e) { console.error('[StateStore] subscriber error', e); }
      }
      return () => this._subs.delete(fn);
    }

    select(path, fn) {
      const read = (obj) => {
        if (!path) return obj;
        return String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
      };
      return this.subscribe((state) => {
        try { fn(read(state), state); } catch (e) { console.error('[StateStore] select error', e); }
      });
    }

    async fetchOnce() {
      if (this._inFlight) return this._state;
      this._inFlight = true;
      try {
        const headers = global.Auth && global.Auth.headers ? global.Auth.headers() : {};
        const r = await fetch('/api/state', { headers });
        if (!r.ok) throw new Error(`state HTTP ${r.status}`);
        const data = await r.json();
        this._state = data;
        this._lastFetchAt = Date.now();
        this._lastError = null;
        this._notify(null);
        return data;
      } catch (err) {
        this._lastError = err;
        this._notify(err);
        throw err;
      } finally {
        this._inFlight = false;
      }
    }

    start() {
      if (this._timer) return;
      this.fetchOnce().catch(() => {});
      this._timer = setInterval(() => {
        this.fetchOnce().catch(() => {});
      }, this._intervalMs);
    }

    stop() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }

    _notify(err) {
      this._subs.forEach((fn) => {
        try { fn(this._state, err); } catch (e) { console.error('[StateStore] subscriber error', e); }
      });
    }
  }

  global.StateStore = StateStore;
  global.stateStore = global.stateStore || new StateStore();
})(window);
