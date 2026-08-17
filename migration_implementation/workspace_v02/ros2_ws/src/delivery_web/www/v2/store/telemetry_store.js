/**
 * Phase 2 — TelemetryStore (ring buffer metrics)
 */
(function (global) {
  'use strict';

  const DEFAULT_CAP = 100;

  class TelemetryStore {
    constructor(capacity) {
      this._cap = capacity || DEFAULT_CAP;
      this._series = new Map();
      this._apiStats = new Map();
    }

    _buf(metric) {
      if (!this._series.has(metric)) this._series.set(metric, []);
      return this._series.get(metric);
    }

    push(metric, timestamp, value) {
      const buf = this._buf(metric);
      buf.push({ t: timestamp || Date.now(), v: value });
      while (buf.length > this._cap) buf.shift();
    }

    getSeries(metric, windowMs) {
      const buf = this._buf(metric);
      if (!windowMs) return buf.slice();
      const cutoff = Date.now() - windowMs;
      return buf.filter((p) => p.t >= cutoff);
    }

    getLatest(metric) {
      const buf = this._buf(metric);
      return buf.length ? buf[buf.length - 1].v : null;
    }

    clear(metric) {
      if (metric) this._series.delete(metric);
      else this._series.clear();
    }

    ingestFromState(state) {
      const agv = state && state.agv;
      if (!agv) return;
      const now = Date.now();
      const vx = Number(agv.vx || 0);
      const vy = Number(agv.vy || 0);
      const speed = Math.hypot(vx, vy);
      this.push('velocity', now, speed);
      this.push('velocity_x', now, vx);
      this.push('velocity_y', now, vy);
    }

    recordApiLatency(name, latencyMs, ok) {
      const key = name || 'api.state';
      if (!this._apiStats.has(key)) {
        this._apiStats.set(key, { samples: [], fail: 0, ok: 0 });
      }
      const st = this._apiStats.get(key);
      if (ok) {
        st.ok += 1;
        st.samples.push(latencyMs);
        while (st.samples.length > this._cap) st.samples.shift();
        this.push(`${key}.latency`, Date.now(), latencyMs);
      } else {
        st.fail += 1;
      }
    }

    getApiStats(name) {
      const st = this._apiStats.get(name || 'api.state') || { samples: [], fail: 0, ok: 0 };
      const s = st.samples.slice().sort((a, b) => a - b);
      const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const p95 = s.length ? s[Math.floor(s.length * 0.95)] : 0;
      const max = s.length ? s[s.length - 1] : 0;
      const cur = s.length ? s[s.length - 1] : 0;
      return { current: cur, avg, p95, max, fail: st.fail, ok: st.ok };
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.TelemetryStore = TelemetryStore;
  global.telemetryStore = global.telemetryStore || new TelemetryStore();
})(window);
