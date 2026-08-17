/**
 * Phase 2 — EventStore (timeline feed for alerts/errors)
 */
(function (global) {
  'use strict';

  const MAX = 200;

  class EventStore {
    constructor() {
      this._events = [];
      this._subs = new Set();
      this._lastCodes = new Map();
    }

    _emit(entry) {
      this._events.push(entry);
      while (this._events.length > MAX) this._events.shift();
      this._subs.forEach((fn) => {
        try { fn(entry, this._events); } catch (e) { console.error('[EventStore]', e); }
      });
    }

    subscribe(fn) {
      this._subs.add(fn);
      return () => this._subs.delete(fn);
    }

    list() { return this._events.slice(); }

    _add(level, category, message, extra) {
      const code = extra && extra.code;
      if (code) {
        const key = `${level}:${code}`;
        const last = this._lastCodes.get(key) || 0;
        if (Date.now() - last < 5000) return;
        this._lastCodes.set(key, Date.now());
      }
      this._emit({
        t: Date.now(),
        level,
        category,
        message,
        extra: extra || null,
      });
    }

    info(cat, msg, extra) { this._add('INFO', cat, msg, extra); }
    warn(cat, msg, extra) { this._add('WARN', cat, msg, extra); }
    error(cat, msg, extra) { this._add('ERROR', cat, msg, extra); }

    componentError(id, err) {
      this.error('COMPONENT', `${id}: ${err.message || err}`, { componentId: id });
    }

    clear() {
      this._events = [];
      this._lastCodes.clear();
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.EventStore = EventStore;
  global.eventStore = global.eventStore || new EventStore();
})(window);
