#!/bin/bash
# Reliable dashboard start on NUC — use after deploy
set -u
C="delivery_gazebo_soft"

echo "Stopping dashboard..."
docker exec "$C" bash -lc 'pids=$(pgrep -f dashboard_node 2>/dev/null || true); if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null || true; fi'
sleep 2

echo "Starting dashboard..."
docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
export ARM_MODE=real
export ARM_REAL_MOTION=1
export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
export MAPS_RW_DIR=/opt/delivery_ws/maps_rw
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
exec ros2 run delivery_web dashboard_node --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json \
  >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 20); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null 2>&1; then
    echo "OK"
    curl -s http://127.0.0.1:19999/api/version
    echo
    exit 0
  fi
done
echo "FAILED — last log lines:"
docker exec "$C" tail -15 /var/log/delivery/dashboard_node.log 2>/dev/null || true
exit 1
