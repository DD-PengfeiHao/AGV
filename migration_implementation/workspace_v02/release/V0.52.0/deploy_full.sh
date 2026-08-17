#!/bin/bash
set -eu
C="delivery_gazebo_soft"
T=/tmp/v052_deploy

docker cp "$T/dw/dashboard_node.py" "$C:/opt/delivery_ws/src/delivery_web/delivery_web/dashboard_node.py"
docker cp "$T/dw/stack_supervisor.py" "$C:/opt/delivery_ws/src/delivery_web/delivery_web/stack_supervisor.py"
docker cp "$T/www/index.html" "$C:/opt/delivery_ws/src/delivery_web/www/index.html"
docker cp "$T/www/alert_queue.js" "$C:/opt/delivery_ws/src/delivery_web/www/alert_queue.js"
docker cp "$T/www/widgets.js" "$C:/opt/delivery_ws/src/delivery_web/www/widgets.js"
docker cp "$T/vision/wrist_camera.py" "$C:/opt/delivery_ws/src/delivery_web/delivery_web/vision/wrist_camera.py"

docker cp "$T/dw/dashboard_node.py" "$C:/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/dashboard_node.py"
docker cp "$T/dw/stack_supervisor.py" "$C:/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/stack_supervisor.py"
docker cp "$T/www/index.html" "$C:/opt/delivery_ws/install/delivery_web/share/delivery_web/www/index.html"
docker cp "$T/www/alert_queue.js" "$C:/opt/delivery_ws/install/delivery_web/share/delivery_web/www/alert_queue.js"
docker cp "$T/www/widgets.js" "$C:/opt/delivery_ws/install/delivery_web/share/delivery_web/www/widgets.js"
docker cp "$T/vision/wrist_camera.py" "$C:/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/vision/wrist_camera.py"
docker exec "$C" rm -f /opt/delivery_ws/install/delivery_web/share/delivery_web/www/status_banner.js

docker exec "$C" bash -lc 'pids=$(pgrep -f dashboard_node || true); if [ -n "$pids" ]; then kill -9 $pids || true; fi'
sleep 2

docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1 DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml MAPS_RW_DIR=/opt/delivery_ws/maps_rw; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 15); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null; then
    echo API_UP
    curl -s http://127.0.0.1:19999/api/version | head -c 120
    echo
    curl -s http://127.0.0.1:19999/api/restart/components | head -c 180
    echo
    exit 0
  fi
done
echo FAIL
docker exec "$C" tail -20 /var/log/delivery/dashboard_node.log
exit 1
