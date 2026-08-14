#!/bin/bash
set -e
cd /opt/delivery_ws/src/delivery_web/delivery_web
cp dashboard_node.py.baktest dashboard_node.py
python3 /opt/delivery_ws/src/delivery_web/apply_phase3_patch.py
echo FULL_PATCH_APPLIED
cd /opt/delivery_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select delivery_web --symlink-install 2>&1 | tail -1
source install/setup.bash
pkill -9 -f dashboard_node 2>/dev/null || true
sleep 1
export ROS_DOMAIN_ID=30
timeout 8 python3 -c "
import rclpy
rclpy.init()
from delivery_web.dashboard_node import DashboardNode
n = DashboardNode()
print('INIT_OK')
rclpy.shutdown()
"
