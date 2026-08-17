#!/usr/bin/env bash
set -u
C="delivery_gazebo_soft"
docker cp /tmp/v052_rc/init_trace.py "$C:/tmp/init_trace.py"
docker exec "$C" bash -lc '
  ps -eo pid,cmd | grep install/delivery_web/lib/delivery_web/dashboard_node | grep -v grep | awk "{print \$1}" | xargs -r kill -9
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  timeout 25 python3 /tmp/init_trace.py
'
