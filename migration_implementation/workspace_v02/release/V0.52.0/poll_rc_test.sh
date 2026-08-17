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
  ros2 run delivery_web dashboard_node --ros-args \
    -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 \
    -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json \
    >> /tmp/rc_poll.log 2>&1 &
  DPID=$!
  echo "dashboard pid=$DPID"
  for t in 2 4 6 8 10 15 20 30 40 50 60; do
    sleep 2
    PORT=$(ss -lntp 2>/dev/null | grep 19999 || echo NONE)
    VER=$(curl -sf -m 2 http://127.0.0.1:19999/api/version 2>/dev/null || echo FAIL)
    ALIVE=$(kill -0 $DPID 2>/dev/null && echo YES || echo NO)
    echo "t=${t}s alive=$ALIVE port=${PORT:-NONE} ver=$VER"
    echo "$VER" | grep -q 0.52.0 && echo READY && break
  done
  echo "=== log tail ==="
  tail -25 /tmp/rc_poll.log
  kill -9 $DPID 2>/dev/null || true
  ps -eo pid,cmd | grep install/delivery_web/lib/delivery_web/dashboard_node | grep -v grep | awk "{print \$1}" | xargs -r kill -9
'
