/**
 * ViewController — mode switching facade
 */
(function (global) {
  'use strict';

  class ViewController {
    constructor(camera) {
      this._cam = camera;
    }

    setMode(mode) { this._cam.setMode(mode); }
    getMode() { return this._cam.mode; }
    reset() { this._cam.reset(); }
    home() { this._cam.home(); }
    followVehicle(on) { this._cam.followVehicle(on); }
    unfollowVehicle() { this._cam.unfollowVehicle(); }
    getCamera() { return this._cam; }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.ViewController = ViewController;
})(window);
