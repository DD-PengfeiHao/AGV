#!/bin/bash
set -eu
C="delivery_gazebo_soft"

echo "Killing dashboard PIDs..."
docker top "$C" -eo pid,args | grep 'lib/delivery_web/dashboard_node' | awk '{print $1}' | while read -r pid; do
  [ -n "$pid" ] && docker exec "$C" kill -9 "$pid" 2>/dev/null || true
done
docker top "$C" -eo pid,args | grep 'ros2 run delivery_web dashboard_node' | awk '{print $1}' | while read -r pid; do
  [ -n "$pid" ] && docker exec "$C" kill -9 "$pid" 2>/dev/null || true
done
sleep 2
docker top "$C" | grep dashboard || echo "CLEAN"

echo "Starting dashboard..."
docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 20); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null 2>&1; then
    echo "API_UP attempt=$i"
    curl -s http://127.0.0.1:19999/api/version
    echo
    exit 0
  fi
done
echo "API_STILL_DOWN"
ss -tlnp | grep 19999 || true
exit 1
