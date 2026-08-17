/**
 * Phase 2 — StateStore (single /api/state polling source)
 */
(function (global) {
  'use strict';

  const STATUS = {
    STOPPED: 'STOPPED',
    ACTIVE: 'ACTIVE',
    ERROR: 'ERROR',
    STALE: 'STALE',
  };

  const STALE_AFTER_MS = 3000;

  function shallowChanged(a, b) {
    if (a === b) return false;
    if (!a || !b) return true;
    return Number(a.updated_at || 0) !== Number(b.updated_at || 0)
      || Number(a.version || 0) !== Number(b.version || 0);
  }

  class StateStore {
    constructor(options) {
      const opts = options || {};
      this._endpoint = opts.endpoint || '/api/state';
      this._intervalMs = opts.interval || opts.intervalMs || 500;
      this._snapshot = null;
      this._status = STATUS.STOPPED;
      this._subs = new Map();
      this._timer = null;
      this._inFlight = false;
      this._meta = {
        lastSuccess: 0,
        lastAttempt: 0,
        lastLatency: 0,
        failCount: 0,
        pollCount: 0,
        stateVersion: 0,
        lastError: null,
      };
    }

    getState() { return this._snapshot; }
    getSnapshot() { return this._snapshot; }
    getLastUpdate() { return this._meta.lastSuccess; }
    getError() { return this._meta.lastError; }
    getStatus() { return this._status; }
    getMeta() { return Object.assign({}, this._meta); }

    isOnline() {
      if (!this._snapshot) return false;
      if (this._status === STATUS.STALE || this._status === STATUS.ERROR) return false;
      const age = Date.now() - (this._meta.lastSuccess || 0);
      return age < STALE_AFTER_MS * 2;
    }

    subscribe(key, callback) {
      if (typeof key === 'function') {
        callback = key;
        key = '*';
      }
      if (typeof callback !== 'function') return () => {};
      if (!this._subs.has(key)) this._subs.set(key, new Set());
      this._subs.get(key).add(callback);
      if (this._snapshot) {
        try { callback(this._pick(key, this._snapshot), this._snapshot, null); } catch (e) { console.error('[StateStore]', e); }
      }
      return () => {
        const set = this._subs.get(key);
        if (set) {
          set.delete(callback);
          if (!set.size) this._subs.delete(key);
        }
      };
    }

    unsubscribe(key, callback) {
      if (typeof callback === 'function') {
        const set = this._subs.get(key);
        if (set) set.delete(callback);
      }
    }

    _pick(key, state) {
      if (!key || key === '*') return state;
      if (key === 'navigation') {
        return {
          route: state.route,
          route_task: state.route_task,
          target_id: state.agv && state.agv.target_id,
          current_station: state.agv && state.agv.current_station,
        };
      }
      if (key === 'system') {
        return {
          version: state.version,
          uptime_sec: state.uptime_sec,
          env: state.env,
          agv_link: state.agv_link,
          updated_at: state.updated_at,
        };
      }
      return state[key];
    }

    _notify(err) {
      this._subs.forEach((set, key) => {
        const slice = this._pick(key, this._snapshot);
        set.forEach((fn) => {
          try { fn(slice, this._snapshot, err); } catch (e) { console.error('[StateStore] subscriber', e); }
        });
      });
    }

    async fetchOnce() {
      if (this._inFlight) return this._snapshot;
      this._inFlight = true;
      this._meta.lastAttempt = Date.now();
      const t0 = performance.now();
      try {
        const headers = global.Auth && global.Auth.headers ? global.Auth.headers() : {};
        const r = await fetch(this._endpoint, { headers, cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const latency = performance.now() - t0;
        const changed = shallowChanged(this._snapshot, data);
        this._snapshot = data;
        this._meta.lastSuccess = Date.now();
        this._meta.lastLatency = latency;
        this._meta.pollCount += 1;
        this._meta.lastError = null;
        this._meta.stateVersion += 1;
        const wasStale = this._status === STATUS.STALE || this._status === STATUS.ERROR;
        this._status = STATUS.ACTIVE;
        if (changed) this._notify(null);
        if (wasStale && global.eventStore) {
          global.eventStore.info('STATE', 'State API recovered', { code: 'STATE_API_RECOVERED' });
        }
        if (global.telemetryStore) {
          global.telemetryStore.recordApiLatency('api.state', latency, true);
          global.telemetryStore.ingestFromState(data);
        }
        if (global.eventStore && changed) {
          global.eventStore.info('STATE', 'State updated', { latency: Math.round(latency) });
        }
        return data;
      } catch (err) {
        this._meta.failCount += 1;
        this._meta.lastError = err;
        this._status = this._snapshot ? STATUS.STALE : STATUS.ERROR;
        if (global.telemetryStore) {
          global.telemetryStore.recordApiLatency('api.state', performance.now() - t0, false);
        }
        if (global.eventStore) {
          global.eventStore.warn('STATE', err.message || 'State fetch failed', { code: 'STATE_API_TIMEOUT' });
        }
        this._notify(err);
        throw err;
      } finally {
        this._inFlight = false;
      }
    }

    start() {
      if (this._timer) return;
      this._status = STATUS.ACTIVE;
      this.fetchOnce().catch(() => {});
      this._timer = setInterval(() => this.fetchOnce().catch(() => {}), this._intervalMs);
      if (global.eventStore) global.eventStore.info('STATE', 'StateStore started');
    }

    stop() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
      this._status = STATUS.STOPPED;
      if (global.eventStore) global.eventStore.info('STATE', 'StateStore stopped');
    }

    reset() {
      this.stop();
      this._snapshot = null;
      this._meta = {
        lastSuccess: 0,
        lastAttempt: 0,
        lastLatency: 0,
        failCount: 0,
        pollCount: 0,
        stateVersion: 0,
        lastError: null,
      };
      this._subs.forEach((set) => set.clear());
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.StateStore = StateStore;
  global.AGV_V2.StoreStatus = STATUS;
  global.stateStore = global.stateStore || new StateStore({ interval: 500 });
})(window);
