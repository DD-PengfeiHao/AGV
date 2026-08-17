#!/bin/bash
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
export ROS_DOMAIN_ID=30
timeout 25 python3 <<'PY'
import time
import rclpy
from delivery_web.dashboard_node import DashboardNode

print('init rclpy...')
rclpy.init()
print('create node...')
t0 = time.time()
node = DashboardNode()
print('node created in', time.time()-t0, 's')
print('ports', node._state.get('ports'))
print('httpd', bool(getattr(node, '_httpd_demo', None)))
rclpy.shutdown()
print('OK')
PY
