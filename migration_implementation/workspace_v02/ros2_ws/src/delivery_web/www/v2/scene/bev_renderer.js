/**
 * BEV Renderer — third-person canvas, real /api/state lidar (no cmd_vel).
 */
(function (global) {
  'use strict';

  function lidarColor(dist, maxD) {
    const t = Math.min(1, Math.max(0, dist / (maxD || 8)));
    if (t < 0.33) return `rgb(239,68,68)`;
    if (t < 0.66) return `rgb(245,158,11)`;
    return '#000000';
  }

  class BevRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.yaw = -Math.PI / 2;
      this.pitch = 0.55;
      this.distance = 12;
      this.target = { x: 0, y: 0 };
      this.binding = true;
      this._drag = false;
      this._pan = false;
      this._lastMouse = { x: 0, y: 0 };
      this._idleTimer = null;
      this._defaultView = { yaw: -Math.PI / 2, pitch: 0.55, distance: 12 };
      this._layers = {
        agv: true, map: true, lidar: true, path: true, history: false, target: true, fov: false,
      };
      this._bindEvents();
    }

    setLayers(layers) {
      Object.assign(this._layers, layers || {});
    }

    resize() {
      const p = this.canvas.parentElement;
      if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _bindEvents() {
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.canvas.addEventListener('mousedown', (e) => {
        this._resetIdle();
        if (e.button === 2) { this._pan = true; this._lastMouse = { x: e.clientX, y: e.clientY }; return; }
        if (e.button === 0) { this._drag = true; this._lastMouse = { x: e.clientX, y: e.clientY }; }
      });
      window.addEventListener('mouseup', () => { this._drag = false; this._pan = false; });
      window.addEventListener('mousemove', (e) => {
        if (!this._drag && !this._pan) return;
        const dx = e.clientX - this._lastMouse.x;
        const dy = e.clientY - this._lastMouse.y;
        this._lastMouse = { x: e.clientX, y: e.clientY };
        if (this._drag) {
          this.yaw -= dx * 0.008;
          this.pitch = Math.max(0.15, Math.min(1.2, this.pitch + dy * 0.006));
        } else if (this._pan) {
          this.target.x -= dx * 0.02;
          this.target.y += dy * 0.02;
          this.binding = false;
        }
        this.render(this._lastState);
      });
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this._resetIdle();
        this.distance = Math.max(4, Math.min(40, this.distance + e.deltaY * 0.02));
        this.render(this._lastState);
      }, { passive: false });
      this.canvas.addEventListener('dblclick', () => {
        this.binding = true;
        this.yaw = this._defaultView.yaw;
        this.pitch = this._defaultView.pitch;
        this.distance = this._defaultView.distance;
        this.render(this._lastState);
      });
    }

    _resetIdle() {
      if (this._idleTimer) clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => {
        this.yaw = this._defaultView.yaw;
        this.pitch = this._defaultView.pitch;
        this.distance = this._defaultView.distance;
        this.render(this._lastState);
      }, 3000);
    }

    applyState(state) {
      this._lastState = state;
      const agv = (state && state.agv) || {};
      if (this.binding && agv.x != null) {
        this.target.x = Number(agv.x) || 0;
        this.target.y = Number(agv.y) || 0;
      }
    }

    render(state) {
      state = state || this._lastState;
      if (!this.ctx) return;
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#F7F8FA';
      ctx.fillRect(0, 0, w, h);

      const scale = Math.min(w, h) / (this.distance * 2.2);
      const cx = w * 0.5;
      const cy = h * 0.55;
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);

      const toScreen = (wx, wy, wz) => {
        const lx = wx - this.target.x;
        const ly = wy - this.target.y;
        const rx = lx * cos - ly * sin;
        const ry = lx * sin + ly * cos;
        const isoY = ry * Math.cos(this.pitch) - (wz || 0) * Math.sin(this.pitch);
        return { x: cx + rx * scale, y: cy - isoY * scale };
      };

      // grid
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 1;
      for (let i = -10; i <= 10; i++) {
        const a = toScreen(this.target.x + i, this.target.y - 10, 0);
        const b = toScreen(this.target.x + i, this.target.y + 10, 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        const c = toScreen(this.target.x - 10, this.target.y + i, 0);
        const d = toScreen(this.target.x + 10, this.target.y + i, 0);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }

      const map = (state && state.map) || {};
      const pts = map.points || [];
      if (this._layers.map && pts.length) {
        ctx.fillStyle = '#9ca3af';
        pts.forEach((p) => {
          const s = toScreen(p[0], p[1], 0);
          ctx.fillRect(s.x, s.y, 1.2, 1.2);
        });
      }

      const laser = (state && state.laser) || {};
      const lpts = laser.points || [];
      if (this._layers.lidar && lpts.length) {
        const agv = (state && state.agv) || {};
        const ax = Number(agv.x) || 0;
        const ay = Number(agv.y) || 0;
        lpts.forEach((p) => {
          const wx = p[0];
          const wy = p[1];
          const dist = Math.hypot(wx - ax, wy - ay);
          const s = toScreen(wx, wy, 0);
          ctx.fillStyle = lidarColor(dist, 8);
          ctx.fillRect(s.x, s.y, 2, 2);
        });
      }

      const agv = (state && state.agv) || {};
      if (this._layers.agv) {
        const s = toScreen(Number(agv.x) || 0, Number(agv.y) || 0, 0);
        const ang = Number(agv.angle) || 0;
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-ang + this.yaw);
        ctx.fillStyle = '#E5364A';
        ctx.strokeStyle = '#C42B3D';
        ctx.lineWidth = 2;
        ctx.fillRect(-14, -10, 28, 20);
        ctx.strokeRect(-14, -10, 28, 20);
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(22, 0);
        ctx.stroke();
        ctx.restore();
      }

      if (this._layers.path) {
        const route = (state && state.route) || {};
        const path = route.waypoints || route.path || [];
        if (path.length > 1) {
          ctx.strokeStyle = '#E5364A';
          ctx.setLineDash([6, 4]);
          ctx.lineWidth = 2;
          ctx.beginPath();
          path.forEach((p, i) => {
            const s = toScreen(p[0], p[1], 0);
            if (i === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.BevRenderer = BevRenderer;
})(window);
