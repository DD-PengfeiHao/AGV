/**
 * V2 View Shell — Overview (#map + widgets) ↔ BEV (#bevCanvas), shared widget overlay.
 */
(function (global) {
  'use strict';

  const ViewShell = {
    mode: 'overview',
    _bev: null,
    _raf: null,

    init() {
      this._ensureDom();
      this._bindHeader();
      this._relocateWidgetLayer();
      Auth.applyUi();
      this.setMode('overview');
    },

    _ensureDom() {
      let bevPane = document.getElementById('bevPane');
      if (!bevPane) {
        bevPane = document.createElement('section');
        bevPane.id = 'bevPane';
        bevPane.className = 'bev-pane hidden';
        bevPane.innerHTML = `
          <canvas id="bevCanvas" aria-label="BEV Scene"></canvas>
          <div class="bev-hud" id="bevHud">BEV · 第三人称</div>
          <label class="bev-bind"><input type="checkbox" id="bevBind" checked/> 视角绑定</label>`;
        const main = document.querySelector('main');
        const legacy = document.getElementById('legacyMain');
        if (main && legacy) main.insertBefore(bevPane, legacy.nextSibling);
      }
      const canvas = document.getElementById('bevCanvas');
      if (canvas && global.AGV_V2 && global.AGV_V2.BevRenderer) {
        this._bev = new global.AGV_V2.BevRenderer(canvas);
        document.getElementById('bevBind')?.addEventListener('change', (e) => {
          if (this._bev) this._bev.binding = e.target.checked;
        });
      }
    },

    _relocateWidgetLayer() {
      const layer = document.getElementById('widgetLayer');
      const shell = document.getElementById('viewShell');
      if (layer && shell && layer.parentElement !== shell) {
        shell.appendChild(layer);
      }
    },

    _bindHeader() {
      const btn = document.getElementById('btnViewSwitch');
      if (btn) {
        btn.addEventListener('click', () => {
          if (!global.Auth || !global.Auth.isAdmin()) {
            if (global.showToast) global.showToast('BEV 需要管理员登录', 'warn');
            else ViewShell._openLogin();
            return;
          }
          this.setMode(this.mode === 'overview' ? 'bev' : 'overview');
        });
      }
      const logo = document.querySelector('.header-logo');
      logo?.addEventListener('click', () => ViewShell._openLogin());
    },

    _openLogin() {
      if (typeof global.openLoginPanel === 'function') {
        global.openLoginPanel();
        return;
      }
      const panel = document.getElementById('loginSlidePanel');
      const backdrop = document.getElementById('loginSlideBackdrop');
      panel?.classList.add('open');
      backdrop?.classList.add('open');
    },

    closeLogin() {
      if (typeof global.closeLoginPanel === 'function') {
        global.closeLoginPanel();
        return;
      }
      document.getElementById('loginSlidePanel')?.classList.remove('open');
      document.getElementById('loginSlideBackdrop')?.classList.remove('open');
    },

    setMode(mode) {
      this.mode = mode;
      const legacy = document.getElementById('legacyMain');
      const bev = document.getElementById('bevPane');
      const btn = document.getElementById('btnViewSwitch');
      if (legacy) legacy.classList.toggle('hidden', mode !== 'overview');
      if (bev) bev.classList.toggle('hidden', mode !== 'bev');
      if (btn) btn.textContent = mode === 'overview' ? 'BEV' : '总览';
      document.body.classList.toggle('view-bev', mode === 'bev');
      document.body.classList.toggle('view-overview', mode === 'overview');
      if (mode === 'bev' && this._bev) {
        this._bev.resize();
        this._startLoop();
      } else {
        this._stopLoop();
      }
      if (global.widgetMgr) {
        global.widgetMgr.widgets.forEach((card) => global.widgetMgr._clampCard(card));
      }
    },

    _startLoop() {
      if (this._raf) return;
      const loop = () => {
        if (this.mode === 'bev' && this._bev) {
          this._bev.resize();
          this._bev.render(global.state);
        }
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    },

    _stopLoop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    },

    onState(state) {
      if (this._bev) this._bev.applyState(state);
    },
  };

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.ViewShell = ViewShell;
  global.ViewShell = ViewShell;
})(window);
