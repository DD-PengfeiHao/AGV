/**
 * debug.map_inspector — admin map debug panel
 */
(function (global) {
  'use strict';

  function registerMapInspector(registry) {
    registry.register('debug.map_inspector', {
      group: 'debug',
      requiredPermission: 'admin',
      title: 'Map Inspector',
      mount(host) {
        host.innerHTML = '<pre class="v2-mono v2-map-inspector" id="mapInspectorPre">—</pre>';
        const pre = host.querySelector('#mapInspectorPre');
        const api = {
          update() {
            const full = global.stateStore && global.stateStore.getSnapshot();
            const mm = global.mapManager ? global.mapManager.getMapState() : {};
            const backend = (full && full.map_manager) || {};
            const cache = backend.cache || {};
            const lines = [
              `Status: ${mm.status}`,
              `AGV link: ${mm.agv_link}`,
              `Source: ${mm.source}`,
              `Mismatch: ${mm.mismatch}`,
              `Fallback PC: ${mm.fallbackPointCloud}`,
              '',
              'Current:', JSON.stringify(mm.current, null, 2),
              'Active:', JSON.stringify(mm.active, null, 2),
              'Next:', JSON.stringify(mm.next, null, 2),
              '',
              `Cache: ${cache.count || 0} maps, ${cache.total_mb || 0} MB`,
              `Cache root: ${cache.root || '—'}`,
              `Timings: ${JSON.stringify(backend.timings_ms || {})}`,
              `Error: ${mm.error || backend.error || '—'}`,
              `Download supported: ${backend.download_supported !== false}`,
            ];
            if (pre) pre.textContent = lines.join('\n');
          },
        };
        if (global.mapManager) global.mapManager.onChange(() => api.update());
        if (global.stateStore) {
          global.stateStore.subscribe('map_manager', () => api.update());
        }
        api.update();
        return api;
      },
    });
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.registerMapInspector = registerMapInspector;
})(window);
