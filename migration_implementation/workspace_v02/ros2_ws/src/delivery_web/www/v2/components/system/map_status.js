/**
 * system.map_status — Map Manager status card
 */
(function (global) {
  'use strict';

  function registerMapStatus(registry) {
    registry.register('system.map_status', {
      group: 'system',
      title: 'Map Status',
      mount(host) {
        host.innerHTML = `
          <div class="v2-map-status">
            <div class="v2-row"><span>AGV</span><b id="msAgv">—</b></div>
            <div class="v2-row"><span>CURRENT</span><b id="msCurrent" class="v2-mono">—</b></div>
            <div class="v2-row"><span>ACTIVE</span><b id="msActive" class="v2-mono">—</b></div>
            <div class="v2-row"><span>NEXT</span><b id="msNext" class="v2-mono">—</b></div>
            <div class="v2-row"><span>STATUS</span><b id="msStatus">—</b></div>
            <div class="v2-row"><span>SOURCE</span><b id="msSource">—</b></div>
            <div class="v2-row v2-preload-row hidden" id="msPreloadRow"><span>PRELOAD</span><b id="msPreload">—</b></div>
            <div class="v2-row v2-meta"><span>LAST CHECK</span><span id="msCheck" class="v2-mono">—</span></div>
          </div>`;
        const api = {
          update() {
            const mm = global.mapManager ? global.mapManager.getMapState() : {};
            const agvEl = host.querySelector('#msAgv');
            const stEl = host.querySelector('#msStatus');
            if (agvEl) {
              agvEl.textContent = mm.agv_link || 'UNKNOWN';
              agvEl.className = mm.agv_link === 'ONLINE' ? 'ok' : (mm.agv_link === 'OFFLINE' ? 'bad' : 'warn');
            }
            const set = (id, v) => { const el = host.querySelector(id); if (el) el.textContent = v || '—'; };
            set('#msCurrent', mm.current && (mm.current.map_id || mm.current.name));
            set('#msActive', mm.active && (mm.active.map_id || mm.active.name));
            set('#msNext', mm.next && (mm.next.map_id || mm.next.name));
            if (stEl) {
              stEl.textContent = mm.status || '—';
              stEl.className = /FAIL|MISMATCH|CORRUPT|UNAVAILABLE/i.test(mm.status || '') ? 'bad'
                : /PRELOAD|DOWNLOAD|PREPAR/i.test(mm.status || '') ? 'warn' : '';
            }
            set('#msSource', mm.source);
            const pr = host.querySelector('#msPreloadRow');
            const pg = mm.progress;
            if (pr && pg > 0 && pg < 100) {
              pr.classList.remove('hidden');
              set('#msPreload', `${pg}%`);
            } else if (pr) pr.classList.add('hidden');
            if (mm.lastCheck) {
              set('#msCheck', new Date(mm.lastCheck).toLocaleTimeString());
            }
          },
        };
        if (global.mapManager) global.mapManager.onChange(() => api.update());
        api.update();
        return api;
      },
    });
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.registerMapStatus = registerMapStatus;
})(window);
