#!/usr/bin/env bash
set -u
C="delivery_gazebo_soft"
docker exec "$C" bash -lc '
  ps -eo pid,cmd | grep install/delivery_web/lib/delivery_web/dashboard_node | grep -v grep | awk "{print \$1}" | xargs -r kill -9
  ps -eo pid,cmd | grep "ros2 run delivery_web dashboard_node" | grep -v grep | awk "{print \$1}" | xargs -r kill -9
  sleep 2
  export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1
  export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
  export MAPS_RW_DIR=/opt/delivery_ws/maps_rw
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  echo "=== VERSION in site-packages ==="
  grep -m1 "^VERSION" /opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/dashboard_node.py
  echo "=== _qr_busy in wrist_camera ==="
  grep -m1 "_qr_busy = False" /opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/vision/wrist_camera.py
  echo "=== starting foreground 50s ==="
  timeout 50 ros2 run delivery_web dashboard_node --ros-args \
    -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 \
    -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json 2>&1
' &
BGPID=$!
sleep 8
echo "=== t=8s curl ==="
curl -sf -m 3 http://127.0.0.1:19999/api/version || echo CURL_FAIL
ss -lntp | grep 19999 || echo NO_PORT
wait $BGPID || true
