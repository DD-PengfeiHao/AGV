/**
 * SceneState — derived view model from StateStore + MapManager (no fetch)
 */
(function (global) {
  'use strict';

  class SceneState {
    constructor() {
      this.pose = null;
      this.map = { cloud: [], curves: [], source: 'UNKNOWN', stale: false };
      this.mapState = {
        online: false,
        current: null,
        active: null,
        next: null,
        status: 'WAITING_FOR_AGV',
        source: 'UNKNOWN',
        progress: 0,
        lastCheck: 0,
        error: null,
        fallbackPointCloud: true,
      };
      this.laser = { points: [], live_lidar: false };
      this.stations = {};
      this.route = [];
      this.targetId = '';
      this.poseHistory = [];
      this.updatedAt = 0;
    }

    apply(fullState, mapManagerState) {
      if (!fullState) return;
      const agv = fullState.agv;
      this.pose = agv ? {
        x: Number(agv.x || 0),
        y: Number(agv.y || 0),
        angle: Number(agv.angle || 0),
      } : null;

      const mm = mapManagerState || (global.mapManager && global.mapManager.getMapState()) || {};
      this.mapState = Object.assign({}, this.mapState, {
        online: !!mm.online,
        current: mm.current,
        active: mm.active,
        next: mm.next,
        status: mm.status || 'WAITING_FOR_AGV',
        source: mm.source || 'UNKNOWN',
        progress: mm.progress || 0,
        lastCheck: mm.lastCheck || 0,
        error: mm.error,
        fallbackPointCloud: !!mm.fallbackPointCloud,
      });

      const render = mm.activeRender;
      if (render && !mm.fallbackPointCloud) {
        this.map = {
          cloud: render.cloud || [],
          curves: render.curves || [],
          source: render.source || mm.source || 'AGV_MAP',
          stale: !!render.stale,
          smap_file: render.smap_file,
        };
        if (render.stations && Object.keys(render.stations).length) {
          this.stations = render.stations;
        } else {
          this.stations = fullState.stations || {};
        }
      } else {
        this.map = {
          cloud: [],
          curves: [],
          source: 'LIVE_POINT_CLOUD',
          stale: false,
        };
        this.stations = mm.fallbackPointCloud ? {} : (fullState.stations || {});
      }

      const laser = fullState.laser || {};
      this.laser = {
        points: laser.points || [],
        live_lidar: !!laser.live_lidar,
      };
      if (mm.fallbackPointCloud && this.laser.points.length) {
        this.map.source = 'LIVE_POINT_CLOUD';
      }

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
