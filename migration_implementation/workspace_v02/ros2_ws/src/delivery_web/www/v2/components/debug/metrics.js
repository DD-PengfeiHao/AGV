/**
 * Debug components — StateStore + API latency (admin)
 */
(function (global) {
  'use strict';

  function card(title) {
    const el = document.createElement('article');
    el.className = 'v2-card v2-card-debug';
    el.innerHTML = `<div class="v2-card-head"><h4>${title}</h4></div><div class="v2-card-body"></div>`;
    return { el, body: el.querySelector('.v2-card-body') };
  }

  function line(text) {
    const d = document.createElement('div');
    d.className = 'v2-mono v2-debug-line';
    d.textContent = text;
    return d;
  }

  function registerDebugComponents(registry) {
    if (registry.get('state_store.debug')) return;
    registry.register('state_store.debug', {
      group: 'debug',
      requiredPermission: 'admin',
      mount(host) {
        const { el, body } = card('StateStore');
        host.appendChild(el);
        const lines = {
          status: line('Status: —'),
          last: line('Last update: —'),
          latency: line('Latency: —'),
          polls: line('Poll count: —'),
          fails: line('Fail count: —'),
          version: line('State version: —'),
          error: line(''),
        };
        Object.values(lines).forEach((l) => body.appendChild(l));
        return {
          update() {
            const ss = global.stateStore;
            if (!ss) return;
            const m = ss.getMeta();
            lines.status.textContent = `Status: ${ss.getStatus()}`;
            lines.last.textContent = `Last success: ${m.lastSuccess ? new Date(m.lastSuccess).toLocaleTimeString() : '—'}`;
            lines.latency.textContent = `Latency: ${m.lastLatency ? m.lastLatency.toFixed(1) + ' ms' : '—'}`;
            lines.polls.textContent = `Poll count: ${m.pollCount}`;
            lines.fails.textContent = `Fail count: ${m.failCount}`;
            lines.version.textContent = `State version: ${m.stateVersion}`;
            lines.error.textContent = m.lastError ? `Error: ${m.lastError.message || m.lastError}` : '';
          },
        };
      },
    });

    registry.register('debug.api_latency', {
      group: 'debug',
      requiredPermission: 'admin',
      mount(host) {
        const { el, body } = card('API Latency');
        host.appendChild(el);
        const stateLine = line('/api/state —');
        const verLine = line('/api/version —');
        body.appendChild(stateLine);
        body.appendChild(verLine);
        return {
          update() {
            const ts = global.telemetryStore;
            if (!ts) return;
            const st = ts.getApiStats('api.state');
            stateLine.textContent = `/api/state cur ${st.current.toFixed(0)}ms avg ${st.avg.toFixed(0)} p95 ${st.p95.toFixed(0)} max ${st.max.toFixed(0)} fail ${st.fail}`;
            const vs = ts.getApiStats('api.version');
            verLine.textContent = `/api/version cur ${vs.current.toFixed(0)}ms fail ${vs.fail}`;
          },
        };
      },
    });
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.registerDebugComponents = registerDebugComponents;
})(window);
