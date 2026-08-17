/**
 * SceneState — derived view model from StateStore (no fetch)
 */
(function (global) {
  'use strict';

  class SceneState {
    constructor() {
      this.pose = null;
      this.map = { cloud: [], curves: [] };
      this.laser = { points: [], live_lidar: false };
      this.stations = {};
      this.route = [];
      this.targetId = '';
      this.poseHistory = [];
      this.updatedAt = 0;
    }

    apply(fullState) {
      if (!fullState) return;
      const agv = fullState.agv;
      this.pose = agv ? {
        x: Number(agv.x || 0),
        y: Number(agv.y || 0),
        angle: Number(agv.angle || 0),
      } : null;
      const map = fullState.map || {};
      this.map = {
        cloud: map.cloud || [],
        curves: map.curves || [],
      };
      const laser = fullState.laser || {};
      this.laser = {
        points: laser.points || [],
        live_lidar: !!laser.live_lidar,
      };
      this.stations = fullState.stations || {};
      const rt = fullState.route_task || {};
      this.route = (fullState.route && fullState.route.stations) || [];
      this.targetId = rt.current || (agv && agv.target_id) || '';
      this.poseHistory = fullState.pose_history || [];
      this.updatedAt = Number(fullState.updated_at || 0);
    }
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.SceneState = SceneState;
})(window);
