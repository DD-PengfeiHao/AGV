#!/usr/bin/env bash
set -u
C="delivery_gazebo_soft"
PY_DW="/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web"
SRC_DW="/opt/delivery_ws/src/delivery_web"

docker cp /tmp/v052_rc/dw/dashboard_node.py "$C:$SRC_DW/delivery_web/dashboard_node.py"
docker cp /tmp/v052_rc/dw/dashboard_node.py "$C:$PY_DW/dashboard_node.py"

docker exec "$C" bash -lc '
  ps -eo pid,cmd | grep install/delivery_web/lib/delivery_web/dashboard_node | grep -v grep | awk "{print \$1}" | xargs -r kill -9
  ps -eo pid,cmd | grep "ros2 run delivery_web dashboard_node" | grep -v grep | awk "{print \$1}" | xargs -r kill -9
  sleep 2
  export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1
  export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
  export MAPS_RW_DIR=/opt/delivery_ws/maps_rw
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  ros2 run delivery_web dashboard_node --ros-args \
    -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 \
    -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json \
    >> /tmp/quick_rc.log 2>&1 &
  for t in 1 2 3 5 8 10 15 20; do
    sleep 1
    VER=$(curl -sf -m 2 http://127.0.0.1:19999/api/version 2>/dev/null || echo FAIL)
    PORT=$(ss -lntp 2>/dev/null | grep 19999 || echo NONE)
    echo "t=${t}s port=$PORT ver=$VER"
    echo "$VER" | grep -q 0.52.1 && break
  done
  echo restart:
  curl -sf -m 3 http://127.0.0.1:19999/api/restart/components | head -c 200
  echo
  tail -8 /tmp/quick_rc.log
'
