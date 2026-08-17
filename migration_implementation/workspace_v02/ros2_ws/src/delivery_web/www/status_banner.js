/**
 * Top-center system status alerts — error (red) / warn (orange) / info (blue).
 */
(function (global) {
  'use strict';

  const SOURCE_LABEL = {
    arm: '机械臂',
    camera: '相机',
    agv: 'AGV',
    system: '系统',
  };

  let hostEl = null;
  const shown = new Map();

  function ensureHost() {
    if (hostEl && document.body.contains(hostEl)) return hostEl;
    hostEl = document.getElementById('statusBannerHost');
    if (!hostEl) {
      hostEl = document.createElement('div');
      hostEl.id = 'statusBannerHost';
      document.body.appendChild(hostEl);
    }
    return hostEl;
  }

  function alertId(alert) {
    return `${alert.source || 'sys'}:${alert.code || 'MSG'}:${alert.message || ''}`;
  }

  function renderAlert(alert) {
    const level = alert.level || 'info';
    const src = SOURCE_LABEL[alert.source] || alert.source || '系统';
    const code = alert.code ? `[${alert.code}] ` : '';
    const el = document.createElement('div');
    el.className = `status-alert status-alert-${level}`;
    el.dataset.alertId = alertId(alert);
    el.innerHTML = `<span class="status-alert-src">${src}</span><span class="status-alert-msg">${code}${alert.message || ''}</span>`;
    return el;
  }

  function push(alert, ms = 0) {
    if (!alert || !alert.message) return;
    const host = ensureHost();
    const id = alertId(alert);
    if (shown.has(id)) {
      const existing = shown.get(id);
      if (existing && existing.parentNode) existing.remove();
    }
    const el = renderAlert(alert);
    host.appendChild(el);
    shown.set(id, el);
    if (ms > 0) {
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => {
          el.remove();
          if (shown.get(id) === el) shown.delete(id);
        }, 300);
      }, ms);
    }
  }

  function sync(alerts) {
    const host = ensureHost();
    const list = Array.isArray(alerts) ? alerts : [];
    const nextIds = new Set(list.map(alertId));
    shown.forEach((el, id) => {
      if (!nextIds.has(id)) {
        el.remove();
        shown.delete(id);
      }
    });
    list.forEach((alert) => {
      const id = alertId(alert);
      if (!shown.has(id)) {
        const el = renderAlert(alert);
        host.appendChild(el);
        shown.set(id, el);
      }
    });
    host.style.display = list.length ? 'flex' : 'none';
  }

  function notifyFromResult(source, result, okLevel = 'info', failLevel = 'error') {
    if (!result) return;
    const level = result.success === false ? failLevel : okLevel;
    const msg = result.message || (result.success ? '操作成功' : '操作失败');
    if (!msg) return;
    push({
      level,
      source,
      code: result.code || (result.success === false ? 'FAIL' : 'OK'),
      message: msg,
    }, result.success === false ? 8000 : 5000);
  }

  global.StatusBanner = { push, sync, notifyFromResult };
})(window);
