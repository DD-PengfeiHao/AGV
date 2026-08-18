/**
 * V2 Bootstrap — StateStore + MapManager + ViewShell (Overview map + floating widgets + BEV).
 * Real backend only — no mock state.
 */
(function (global) {
  'use strict';

  const V2 = global.AGV_V2 || {};

  const Bootstrap = {
    _started: false,
    _unsub: null,
    _verTimer: null,

    isV2() {
      return global.APP_MODE === 'V2';
    },

    start() {
      if (!this.isV2() || this._started) return;

      document.body.classList.add('app-v2');

      if (V2.ViewShell) V2.ViewShell.init();

      const ss = global.stateStore;
      if (!ss) {
        console.warn('[V2Bootstrap] stateStore missing');
        return;
      }
      ss.start();
      if (global.mapManager) global.mapManager.start();

      this._unsub = ss.subscribe('*', (slice, full) => {
        global.state = full;
        if (global.AlertQueue && full && full.alerts) {
          global.AlertQueue.syncFromState(full.alerts);
        }
        if (global.mapManager) global.mapManager.reconcile(full, 'state_update');
        if (typeof global.drawMap === 'function') global.drawMap();
        if (typeof global.renderHeader === 'function') global.renderHeader();
        if (V2.ViewShell) V2.ViewShell.onState(full);
        this._updateMapBanner();
      });

      ss.fetchOnce().catch(() => {});

      this._probeVersionLatency();
      this._started = true;
      if (global.AGV_V2 && global.AGV_V2.initBlackBoxShortcut) global.AGV_V2.initBlackBoxShortcut();
      if (global.eventStore) global.eventStore.info('APP', 'V2 started (real backend)');
    },

    destroy() {
      if (!this._started) return;
      if (global.mapManager) global.mapManager.stop();
      if (global.stateStore) global.stateStore.stop();
      if (this._unsub) { this._unsub(); this._unsub = null; }
      if (this._verTimer) { clearInterval(this._verTimer); this._verTimer = null; }
      document.body.classList.remove('app-v2');
      if (global.stateStore) global.stateStore.reset();
      this._started = false;
    },

    _updateMapBanner() {
      const el = document.getElementById('v2MapBanner');
      if (!el || !global.mapManager) return;
      const mm = global.mapManager.getMapState();
      let text = '';
      let cls = 'v2-map-banner';
      if (mm.fallbackPointCloud || mm.status === 'LIVE_POINT_CLOUD_ONLY' || mm.status === 'MAP_MISMATCH') {
        text = mm.status === 'MAP_MISMATCH'
          ? '地图不匹配 — 仅显示实时点云'
          : '当前地图不可用 — 使用实时点云';
        cls += ' warn';
      } else if (mm.status === 'DOWNLOADING' || mm.status === 'PRELOADING') {
        const name = (mm.next && mm.next.map_id) || (mm.current && mm.current.map_id) || '';
        text = `地图准备中 ${name} ${mm.progress || 0}%`;
        cls += ' info';
      } else if (mm.status === 'STALE' || mm.agv_link === 'OFFLINE') {
        text = 'AGV 离线 — 显示上次已知地图 (STALE)';
        cls += ' warn';
      }
      if (text) {
        el.textContent = text;
        el.className = cls;
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    },

    _probeVersionLatency() {
      const ts = global.telemetryStore;
      if (!ts) return;
      const probe = () => {
        const t0 = performance.now();
        const headers = global.Auth && global.Auth.headers ? global.Auth.headers() : {};
        fetch('/api/version', { headers, cache: 'no-store' })
          .then((r) => { ts.recordApiLatency('api.version', performance.now() - t0, r.ok); })
          .catch(() => { ts.recordApiLatency('api.version', performance.now() - t0, false); });
      };
      probe();
      this._verTimer = setInterval(probe, 10000);
    },
  };

  global.AGV_V2 = V2;
  global.V2Bootstrap = Bootstrap;
})(window);
