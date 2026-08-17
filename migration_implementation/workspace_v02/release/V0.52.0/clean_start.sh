#!/bin/bash
set -eu
C="delivery_gazebo_soft"

docker exec "$C" bash -lc '
for pass in 1 2 3; do
  pids=$(pgrep -f dashboard_node || true)
  if [ -z "$pids" ]; then break; fi
  kill -9 $pids 2>/dev/null || true
  sleep 1
done
pgrep -af dashboard_node || echo CLEAN
'

sleep 2

docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 25); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null 2>&1; then
    echo API_UP attempt=$i
    curl -s http://127.0.0.1:19999/api/version
    echo
    curl -s http://127.0.0.1:19999/api/restart/components | head -c 220
    echo
    docker top "$C" | grep dashboard || true
    exit 0
  fi
done

echo API_STILL_DOWN
docker top "$C" | grep dashboard || true
ss -tlnp | grep 19999 || true
exit 1
