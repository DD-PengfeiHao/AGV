/**
 * CameraController — orbit / pan / zoom state
 */
(function (global) {
  'use strict';

  const MODES = { OVERVIEW: 'OVERVIEW', THIRD_PERSON: 'THIRD_PERSON', BEV: 'BEV', CAMERA: 'CAMERA' };

  class CameraController {
    constructor() {
      this.mode = MODES.OVERVIEW;
      this.yaw = 180;
      this.pitch = 35;
      this.distance = 40;
      this.targetX = 0;
      this.targetY = 0;
      this.targetZ = 0;
      this.follow = true;
      this._view = { cx: 0, cy: 0, scale: 1.0, minX: -20, maxX: 20, minY: -20, maxY: 20 };
    }

    getView() { return this._view; }

    setMode(mode) {
      if (MODES[mode]) this.mode = MODES[mode];
    }

    reset() {
      this.yaw = 180;
      this.pitch = 35;
      this.distance = 40;
      this.follow = true;
    }

    home() {
      this._view.cx = this.targetX;
      this._view.cy = this.targetY;
      this._view.scale = 1;
    }

    followVehicle(on) {
      this.follow = on !== false;
    }

    unfollowVehicle() { this.follow = false; }

    bindToPose(pose) {
      if (!pose) return;
      this.targetX = pose.x;
      this.targetY = pose.y;
      if (this.follow) {
        this._view.cx = pose.x;
        this._view.cy = pose.y;
      }
    }

    zoom(delta, factor) {
      const f = factor || 1.1;
      this._view.scale *= delta > 0 ? (1 / f) : f;
      this._view.scale = Math.max(0.2, Math.min(8, this._view.scale));
    }

    pan(dx, dy, w, h) {
      const spanX = this._view.maxX - this._view.minX;
      const spanY = this._view.maxY - this._view.minY;
      this._view.cx -= (dx / w) * spanX;
      this._view.cy += (dy / h) * spanY;
    }

    updateBounds(w, h) {
      const aspect = w / h;
      const base = 40 / this._view.scale;
      let bw = base;
      let bh = base;
      if (bw / bh > aspect) bh = bw / aspect;
      else bw = bh * aspect;
      this._view.minX = this._view.cx - bw / 2;
      this._view.maxX = this._view.cx + bw / 2;
      this._view.minY = this._view.cy - bh / 2;
      this._view.maxY = this._view.cy + bh / 2;
    }

    worldToScreen(x, y, w, h) {
      const v = this._view;
      const sx = ((x - v.minX) / (v.maxX - v.minX)) * w;
      const sy = (1 - (y - v.minY) / (v.maxY - v.minY)) * h;
      return [sx, sy];
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.CameraController = CameraController;
  global.AGV_V2.ViewModes = MODES;
})(window);
