/**
 * V2 Bootstrap — wires StateStore, Scene, Groups on login
 */
(function (global) {
  'use strict';

  const V2 = global.AGV_V2 || {};

  const Bootstrap = {
    _started: false,
    _sceneRenderer: null,
    _viewController: null,
    _groupRegistry: null,
    _unsubLegacy: null,
    _raf: null,

    isV2() {
      return global.APP_MODE === 'V2';
    },

    start() {
      if (!this.isV2() || this._started) return;
      if (!global.Auth || !global.Auth.isLoggedIn()) return;

      const root = document.getElementById('v2Layout');
      const canvas = document.getElementById('v2SceneCanvas');
      if (!root || !canvas) {
        console.warn('[V2Bootstrap] missing #v2Layout or #v2SceneCanvas');
        return;
      }

      document.body.classList.add('app-v2');
      const legacy = document.getElementById('legacyMain');
      if (legacy) legacy.classList.add('legacy-hidden');

      const camera = new V2.CameraController();
      this._viewController = new V2.ViewController(camera);
      this._sceneRenderer = new V2.SceneRenderer(canvas, camera);
      this._groupRegistry = new V2.GroupRegistry();
      this._groupRegistry.setRoot(root);

      this._registerGroups();
      this._groupRegistry.mountAll();

      const ss = global.stateStore;
      ss.start();

      this._unsubLegacy = ss.subscribe('*', (slice, full) => {
        if (global.state) global.state = full;
        if (global.AlertQueue && full && full.alerts) {
          global.AlertQueue.syncFromState(full.alerts);
        }
        if (this._sceneRenderer) {
          this._sceneRenderer.applyState(full);
        }
        if (typeof global.renderHeader === 'function') global.renderHeader();
      });

      const loop = () => {
        if (this._sceneRenderer) this._sceneRenderer.render();
        this._updateHud();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);

      window.addEventListener('resize', this._onResize);
      this._bindSceneTools();
      this._probeVersionLatency();

      this._started = true;
      if (global.eventStore) global.eventStore.info('APP', 'V2 bootstrap started');
    },

    destroy() {
      if (!this._started) return;
      if (global.stateStore) global.stateStore.stop();
      if (this._groupRegistry) this._groupRegistry.unmountAll();
      if (this._unsubLegacy) { this._unsubLegacy(); this._unsubLegacy = null; }
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      window.removeEventListener('resize', this._onResize);
      document.body.classList.remove('app-v2');
      const legacy = document.getElementById('legacyMain');
      if (legacy) legacy.classList.remove('legacy-hidden');
      if (global.stateStore) global.stateStore.reset();
      if (global.telemetryStore) global.telemetryStore.clear();
      if (global.eventStore) global.eventStore.clear();
      if (this._verTimer) { clearInterval(this._verTimer); this._verTimer = null; }
      this._started = false;
      this._sceneRenderer = null;
      this._viewController = null;
      this._groupRegistry = null;
    },

    _onResize() {
      if (Bootstrap._sceneRenderer) Bootstrap._sceneRenderer.resize();
    },

    _registerGroups() {
      const gr = this._groupRegistry;
      const cr = global.componentRegistry;

      if (V2.registerAgvObserve) V2.registerAgvObserve(cr);
      if (V2.registerDebugComponents) V2.registerDebugComponents(cr);

      gr.register('system', { title: 'System', order: 10, size: 'sm', collapsed: true, components: [] });
      gr.register('agv', {
        title: 'AGV · Observe',
        description: 'Pose, velocity, safety — from /api/state',
        order: 20,
        size: 'md',
        components: ['agv.state', 'agv.pose', 'agv.velocity', 'agv.safety'],
      });
      gr.register('navigation', { title: 'Navigation', order: 30, size: 'md', collapsed: true, components: [] });
      gr.register('motion', { title: 'Motion', order: 40, size: 'lg', collapsed: true, components: [] });
      gr.register('perception', { title: 'Perception', order: 50, size: 'md', collapsed: true, components: [] });
      gr.register('camera', { title: 'Camera', order: 60, size: 'md', collapsed: true, components: [] });
      gr.register('arm', { title: 'Arm', order: 70, size: 'md', collapsed: true, components: [] });
      gr.register('debug', {
        title: 'Debug',
        order: 80,
        size: 'md',
        requiredPermission: 'admin',
        components: ['state_store.debug', 'debug.api_latency'],
      });
      gr.register('events', { title: 'Events', order: 90, size: 'sm', collapsed: true, components: [] });
    },

    _bindSceneTools() {
      const btnFollow = document.getElementById('v2BtnFollow');
      const btnZoomIn = document.getElementById('v2BtnZoomIn');
      const btnZoomOut = document.getElementById('v2BtnZoomOut');
      const btnHome = document.getElementById('v2BtnHome');
      const cam = this._viewController && this._viewController.getCamera();
      if (!cam) return;

      btnFollow?.addEventListener('click', () => {
        const on = !cam.follow;
        cam.followVehicle(on);
        btnFollow.classList.toggle('active', on);
        this._sceneRenderer.render();
      });
      btnZoomIn?.addEventListener('click', () => { cam.zoom(-1); this._sceneRenderer.render(); });
      btnZoomOut?.addEventListener('click', () => { cam.zoom(1); this._sceneRenderer.render(); });
      btnHome?.addEventListener('click', () => { cam.home(); this._sceneRenderer.render(); });
    },

    _updateHud() {
      const hud = document.getElementById('v2ViewHud');
      const cam = this._viewController && this._viewController.getCamera();
      if (!hud || !cam) return;
      hud.innerHTML = [
        `VIEW: ${this._viewController.getMode()}`,
        `FOLLOW: ${cam.follow ? 'ON' : 'OFF'}`,
        `YAW: ${cam.yaw.toFixed(0)}°`,
        `PITCH: ${cam.pitch.toFixed(0)}°`,
        `DIST: ${cam.distance.toFixed(0)} m`,
      ].map((t) => `<div class="v2-mono">${t}</div>`).join('');
    },

    _probeVersionLatency() {
      const ts = global.telemetryStore;
      if (!ts) return;
      const probe = () => {
        const t0 = performance.now();
        const headers = global.Auth && global.Auth.headers ? global.Auth.headers() : {};
        fetch('/api/version', { headers, cache: 'no-store' })
          .then((r) => {
            ts.recordApiLatency('api.version', performance.now() - t0, r.ok);
          })
          .catch(() => {
            ts.recordApiLatency('api.version', performance.now() - t0, false);
          });
      };
      probe();
      this._verTimer = setInterval(probe, 10000);
    },
  };

  Bootstrap._onResize = Bootstrap._onResize.bind(Bootstrap);

  global.AGV_V2 = V2;
  global.V2Bootstrap = Bootstrap;
})(window);
