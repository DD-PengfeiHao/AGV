/**
 * MapManager (client) — subscribes StateStore, event-driven + 5s reconcile.
 * Does NOT poll /api/state (uses StateStore snapshot only).
 */
(function (global) {
  'use strict';

  const RECONCILE_MS = 5000;
  const MapId = () => global.AGV_V2.MapIdentity;

  class ClientMapManager {
    constructor() {
      this._subs = [];
      this._reconcileTimer = null;
      this._lastStateVersion = 0;
      this._mapState = {
        online: false,
        agv_link: 'UNKNOWN',
        current: null,
        active: null,
        next: null,
        status: 'WAITING_FOR_AGV',
        source: 'UNKNOWN',
        progress: 0,
        lastCheck: 0,
        error: null,
        mismatch: false,
        fallbackPointCloud: false,
        activeRender: null,
      };
      this._listeners = new Set();
    }

    getMapState() { return Object.assign({}, this._mapState); }

    onChange(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }

    _notify() {
      const st = this.getMapState();
      this._listeners.forEach((fn) => {
        try { fn(st); } catch (e) { console.error('[MapManager]', e); }
      });
    }

    _agvLinkFromState(full, meta) {
      const link = full.agv_link || {};
      if (link.connected === false && !link.adapter_connected) return 'OFFLINE';
      const agv = full.agv || {};
      const updated = Number(agv.updated_at || full.updated_at || meta.lastSuccess / 1000 || 0);
      const age = updated ? (Date.now() / 1000 - updated) : 999;
      if (age < 2) return 'ONLINE';
      if (age < 5) return 'DEGRADED';
      if (!updated) return 'UNKNOWN';
      return 'OFFLINE';
    }

    _applyBackend(mm) {
      if (!mm) return;
      this._mapState.status = mm.status || this._mapState.status;
      this._mapState.source = mm.source || this._mapState.source;
      this._mapState.progress = mm.progress || 0;
      this._mapState.current = mm.current || this._mapState.current;
      this._mapState.active = mm.active || this._mapState.active;
      this._mapState.next = mm.next || null;
      this._mapState.error = mm.error || null;
      this._mapState.mismatch = !!mm.mismatch;
      this._mapState.fallbackPointCloud = mm.status === 'LIVE_POINT_CLOUD_ONLY' || !!mm.mismatch;
    }

    reconcile(full, reason) {
      if (!full) return;
      const MI = MapId();
      const ss = global.stateStore;
      const meta = ss && ss.getMeta ? ss.getMeta() : {};
      const agvLink = this._agvLinkFromState(full, meta);
      this._mapState.agv_link = agvLink;
      this._mapState.online = agvLink === 'ONLINE' || agvLink === 'DEGRADED';
      this._mapState.lastCheck = Date.now();

      this._applyBackend(full.map_manager);

      const current = MI.fromState(full);
      if (current) this._mapState.current = current;

      const map = full.map || {};
      const mm = full.map_manager || {};
      const usePointCloudOnly = this._mapState.fallbackPointCloud
        || mm.status === 'LIVE_POINT_CLOUD_ONLY'
        || mm.status === 'MAP_MISMATCH'
        || (this._mapState.mismatch && !mm.active_render_ready);

      if (usePointCloudOnly) {
        this._mapState.activeRender = null;
        this._mapState.fallbackPointCloud = true;
        if (global.eventStore && reason !== 'periodic') {
          global.eventStore.warn('MAP', 'Point cloud fallback', { code: 'MAP_FALLBACK_POINTCLOUD' });
        }
      } else if (map.cloud && map.cloud.length) {
        this._mapState.activeRender = {
          cloud: map.cloud,
          curves: map.curves || [],
          stations: full.stations || {},
          smap_file: map.smap_file,
          meta: full.meta || {},
          source: this._mapState.source,
        };
        this._mapState.fallbackPointCloud = false;
      } else if (agvLink === 'OFFLINE' && map.cloud && map.cloud.length) {
        this._mapState.activeRender = {
          cloud: map.cloud,
          curves: map.curves || [],
          stations: full.stations || {},
          smap_file: map.smap_file,
          meta: full.meta || {},
          source: 'LOCAL_CACHE',
          stale: true,
        };
        this._mapState.status = 'STALE';
      } else {
        this._mapState.activeRender = null;
        this._mapState.fallbackPointCloud = !map.cloud || !map.cloud.length;
      }

      if (!this._mapState.online && !this._mapState.activeRender) {
        this._mapState.status = 'OFFLINE';
      } else if (!this._mapState.online && this._mapState.activeRender) {
        this._mapState.status = 'STALE';
      }

      this._notify();
    }

    _onState(slice, full) {
      const ss = global.stateStore;
      const ver = ss && ss.getMeta ? ss.getMeta().stateVersion : 0;
      const prev = this._lastStateVersion;
      this._lastStateVersion = ver;
      let reason = 'state_update';
      const agv = full.agv || {};
      const mm = full.map_manager || {};
      if (prev && ver > prev) {
        if (agv.current_map) reason = 'MAP_ID_CHANGED';
        if (full.route_task) reason = 'TASK_CHANGED';
      }
      this.reconcile(full, reason);
    }

    start() {
      if (!global.stateStore) return;
      this._subs.push(global.stateStore.subscribe('*', (s, full) => this._onState(s, full)));
      this._reconcileTimer = setInterval(() => {
        const full = global.stateStore.getSnapshot();
        if (full) this.reconcile(full, 'periodic');
      }, RECONCILE_MS);
      if (global.eventStore) global.eventStore.info('MAP', 'MapManager started');
    }

    stop() {
      this._subs.forEach((u) => u());
      this._subs = [];
      if (this._reconcileTimer) {
        clearInterval(this._reconcileTimer);
        this._reconcileTimer = null;
      }
    }

    async preload(identity) {
      const headers = global.Auth && global.Auth.headers ? global.Auth.headers() : { 'Content-Type': 'application/json' };
      const r = await fetch('/api/map/preload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ identity: identity || this._mapState.next || this._mapState.current }),
      });
      return r.json();
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.ClientMapManager = ClientMapManager;
  global.mapManager = global.mapManager || new ClientMapManager();
})(window);
