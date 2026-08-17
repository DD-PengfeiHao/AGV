/**
 * SceneRenderer — Canvas 2D Overview (no API calls)
 */
(function (global) {
  'use strict';

  class SceneRenderer {
    constructor(canvas, camera) {
      this._canvas = canvas;
      this._camera = camera;
      this._scene = new global.AGV_V2.SceneState();
      this._layers = { map: true, lidar: true, path: true, stations: true, agv: true };
      this._lidarAlpha = 0.7;
      this._error = null;
      this._bindPointer();
    }

    get sceneState() { return this._scene; }

    setLayers(layers) { Object.assign(this._layers, layers || {}); }

    applyState(fullState) {
      try {
        this._scene.apply(fullState);
        this._camera.bindToPose(this._scene.pose);
        this._error = null;
      } catch (err) {
        this._error = err;
        if (global.eventStore) global.eventStore.error('SCENE', err.message);
      }
    }

    render() {
      const c = this._canvas;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (!w || !h) return;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._camera.updateBounds(w, h);

      ctx.fillStyle = '#F7F8FA';
      ctx.fillRect(0, 0, w, h);

      const wts = (x, y) => this._camera.worldToScreen(x, y, w, h);

      if (this._layers.map && this._scene.map.cloud.length) {
        ctx.fillStyle = 'rgba(55,65,81,0.55)';
        const cloud = this._scene.map.cloud;
        const step = Math.max(1, Math.floor(cloud.length / 3500));
        for (let i = 0; i < cloud.length; i += step) {
          const [sx, sy] = wts(cloud[i].x, cloud[i].y);
          ctx.fillRect(sx, sy, 1.4, 1.4);
        }
      }

      if (this._layers.map) {
        (this._scene.map.curves || []).forEach((cu) => {
          const pts = cu.points || [];
          if (pts.length < 2) return;
          ctx.strokeStyle = 'rgba(229,54,74,0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          pts.forEach((p, i) => {
            const [sx, sy] = wts(p.x, p.y);
            i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
          });
          ctx.stroke();
        });
      }

      if (this._layers.lidar && this._scene.laser.points.length) {
        const a = this._lidarAlpha;
        ctx.fillStyle = this._scene.laser.live_lidar
          ? `rgba(59,130,246,${a})` : `rgba(107,114,128,${a * 0.7})`;
        this._scene.laser.points.forEach((p) => {
          const [sx, sy] = wts(p.x, p.y);
          ctx.fillRect(sx - 1, sy - 1, 2, 2);
        });
      }

      if (this._layers.stations) {
        Object.entries(this._scene.stations).forEach(([n, s]) => {
          const [sx, sy] = wts(s.x, s.y);
          const isTarget = n === this._scene.targetId;
          ctx.beginPath();
          ctx.arc(sx, sy, isTarget ? 9 : 6, 0, Math.PI * 2);
          ctx.fillStyle = isTarget ? '#E5364A' : '#10B981';
          ctx.fill();
          ctx.fillStyle = '#111111';
          ctx.font = '11px Inter, Segoe UI, sans-serif';
          ctx.fillText(n, sx + 10, sy - 6);
        });
      }

      if (this._layers.agv && this._scene.pose) {
        const p = this._scene.pose;
        const [sx, sy] = wts(p.x, p.y);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-p.angle);
        ctx.fillStyle = '#E5364A';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, 9);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, -9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    _bindPointer() {
      const c = this._canvas;
      if (!c) return;
      let drag = null;
      c.addEventListener('pointerdown', (e) => {
        c.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, btn: e.button };
        e.preventDefault();
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        drag.x = e.clientX;
        drag.y = e.clientY;
        if (drag.btn === 2 || (drag.btn === 0 && e.shiftKey)) {
          this._camera.pan(dx, dy, c.clientWidth, c.clientHeight);
          this._camera.unfollowVehicle();
        } else if (drag.btn === 0) {
          this._camera.yaw += dx * 0.3;
          this._camera.pitch = Math.max(5, Math.min(85, this._camera.pitch - dy * 0.2));
        }
        this.render();
        e.preventDefault();
      });
      const end = () => { drag = null; };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
      c.addEventListener('wheel', (e) => {
        this._camera.zoom(e.deltaY);
        this.render();
        e.preventDefault();
      }, { passive: false });
      c.addEventListener('dblclick', () => {
        this._camera.followVehicle(true);
        this._camera.home();
        this.render();
      });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    resize() { this.render(); }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.SceneRenderer = SceneRenderer;
})(window);
