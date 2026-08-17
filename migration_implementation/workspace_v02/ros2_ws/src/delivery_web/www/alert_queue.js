/**
 * Fault-code alert popup queue — top-center, glassmorphism, FIFO max 6.
 */
(function (global) {
  'use strict';

  const MAX = 6;
  const AUTO_MS = 3000;

  const AlertQueue = {
    items: [],

    _container() {
      return document.getElementById('alertContainer');
    },

    _id(alert) {
      return `${alert.source || 'system'}:${alert.code || 'ALERT'}`;
    },

    _normalizeLevel(level) {
      const lv = String(level || 'info').toLowerCase();
      if (lv === 'warn' || lv === 'warning') return 'warning';
      if (lv === 'err' || lv === 'error') return 'error';
      return 'info';
    },

    add(alert) {
      if (!alert || !alert.message) return;
      const level = this._normalizeLevel(alert.level);
      const id = this._id(alert);
      if (this.items.find((a) => a.id === id)) return;

      const card = document.createElement('div');
      card.className = `alert-card ${level}`;
      card.dataset.alertId = id;
      const raw = alert.raw != null ? String(alert.raw) : String(alert.message || '');
      card.innerHTML = `
        <div class="alert-line1">${this._esc(alert.message)}</div>
        <div class="alert-line2">${this._esc(alert.code)}: ${this._esc(raw)}</div>
      `;

      const item = { id, level, element: card, expireTimer: null, alert };
      if (level === 'info' || level === 'warning') {
        item.expireTimer = setTimeout(() => this.remove(id), AUTO_MS);
      }

      this.items.push(item);
      while (this.items.length > MAX) {
        this.remove(this.items[0].id);
      }
      this.render();
    },

    remove(id) {
      const idx = this.items.findIndex((a) => a.id === id);
      if (idx === -1) return;
      const item = this.items[idx];
      if (item.expireTimer) clearTimeout(item.expireTimer);
      item.element.classList.add('fading-out');
      setTimeout(() => {
        if (item.element.parentNode) item.element.remove();
        this.items = this.items.filter((a) => a.id !== id);
        this.render();
      }, 200);
    },

    render() {
      const container = this._container();
      if (!container) return;
      container.innerHTML = '';
      this.items.forEach((item) => {
        container.appendChild(item.element);
      });
      container.style.display = this.items.length ? 'flex' : 'none';
    },

    syncFromState(alerts) {
      const list = Array.isArray(alerts) ? alerts : [];
      const seen = new Set();

      list.forEach((a) => {
        const id = this._id(a);
        seen.add(id);
        this.add(a);
      });

      this.items.forEach((item) => {
        if (item.level === 'error' && !seen.has(item.id)) {
          this.remove(item.id);
        }
      });
    },

    push(alert, ms) {
      this.add(alert);
      if (ms > 0 && alert) {
        const id = this._id(alert);
        const item = this.items.find((a) => a.id === id);
        if (item && item.expireTimer) {
          clearTimeout(item.expireTimer);
          item.expireTimer = setTimeout(() => this.remove(id), ms);
        }
      }
    },

    notifyFromResult(source, result, okLevel, failLevel) {
      if (!result) return;
      const level = result.success === false ? (failLevel || 'error') : (okLevel || 'info');
      const msg = result.message || (result.success ? '操作成功' : '操作失败');
      this.push({
        level: this._normalizeLevel(level),
        source,
        code: result.code || (result.success === false ? 'FAIL' : 'OK'),
        message: msg,
        raw: msg,
      }, result.success === false ? 8000 : 5000);
    },

    _esc(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
  };

  global.AlertQueue = AlertQueue;
  global.StatusBanner = {
    push: (a, ms) => AlertQueue.push(a, ms),
    sync: (a) => AlertQueue.syncFromState(a),
    notifyFromResult: (s, r, ok, fail) => AlertQueue.notifyFromResult(s, r, ok, fail),
  };
})(window);
