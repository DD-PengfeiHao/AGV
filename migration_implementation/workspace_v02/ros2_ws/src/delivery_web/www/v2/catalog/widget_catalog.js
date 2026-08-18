/**
 * V2 Widget Catalog — 11 groups, maps to legacy WIDGET_REGISTRY ids (real backend widgets).
 */
(function (global) {
  'use strict';

  const GROUPS = [
    { id: 'agv', title: 'AGV', order: 10, widgets: ['agv_status'] },
    { id: 'navigation', title: '导航', order: 20, widgets: ['nav_control', 'pointcloud'] },
    { id: 'camera', title: '相机', order: 60, widgets: ['jason_camera_a', 'jason_camera_b', 'leo_camera'] },
    { id: 'arm', title: '机械臂', order: 70, widgets: ['arm_control'] },
    { id: 'system', title: '系统', order: 80, widgets: ['system_monitor', 'operation_log'] },
    { id: 'debug', title: 'Debug', order: 90, adminOnly: true, widgets: ['verbose_log'] },
  ];

  function allWidgetIds() {
    const ids = [];
    GROUPS.forEach((g) => g.widgets.forEach((id) => ids.push(id)));
    return ids;
  }

  function groupForWidget(id) {
    for (const g of GROUPS) {
      if (g.widgets.includes(id)) return g;
    }
    return { id: 'other', title: '其他', order: 999, widgets: [] };
  }

  function visibleGroups() {
    const admin = global.Auth && global.Auth.isAdmin && global.Auth.isAdmin();
    return GROUPS.filter((g) => !g.adminOnly || admin).sort((a, b) => a.order - b.order);
  }

  global.AGV_V2 = global.AGV_V2 || {};
  global.AGV_V2.WidgetCatalog = { GROUPS, allWidgetIds, groupForWidget, visibleGroups };
})(window);
