#!/bin/bash
set -eu
C="delivery_gazebo_soft"

echo "=== kill existing dashboard ==="
docker exec "$C" bash -lc 'pids=$(pgrep -f dashboard_node || true); if [ -n "$pids" ]; then kill -9 $pids; fi'
sleep 2
docker exec "$C" pgrep -af dashboard_node 2>&1 || echo "CLEAN"

docker exec "$C" mkdir -p /var/log/delivery
docker exec "$C" chmod 777 /var/log/delivery 2>/dev/null || true

echo "=== foreground start (25s timeout) ==="
docker exec "$C" bash -lc '
export ROS_DOMAIN_ID=30
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
export ARM_MODE=real
export ARM_REAL_MOTION=1
export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
export MAPS_RW_DIR=/opt/delivery_ws/maps_rw
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
timeout 25 ros2 run delivery_web dashboard_node --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json \
  2>&1 | tee /tmp/dashboard_foreground.log | tail -40
' || true

echo "=== after timeout: ports ==="
ss -tlnp | grep 19999 || echo "no 19999"

echo "=== grep errors in log ==="
docker exec "$C" grep -iE 'error|traceback|exception|failed|HTTP|Web DEMO' /tmp/dashboard_foreground.log 2>/dev/null | tail -20 || true
