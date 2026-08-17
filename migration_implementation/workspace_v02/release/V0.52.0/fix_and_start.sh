#!/bin/bash
set -eu
C="delivery_gazebo_soft"
SRC_ROOT="/tmp/v052_deploy"

copy_py() {
  local rel="$1"
  docker cp "$SRC_ROOT/$rel" "$C:/opt/delivery_ws/src/delivery_web/$rel"
  docker cp "$SRC_ROOT/$rel" "$C:/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web/$rel"
}

echo "=== deploy wrist_camera fix ==="
mkdir -p "$SRC_ROOT/vision"
# wrist_camera copied separately via scp before this runs

echo "=== kill dashboard ==="
docker exec "$C" bash -lc 'pids=$(pgrep -f dashboard_node || true); if [ -n "$pids" ]; then kill -9 $pids; fi'
sleep 2

docker exec "$C" mkdir -p /var/log/delivery
docker exec "$C" chmod 777 /var/log/delivery 2>/dev/null || true

echo "=== start dashboard ==="
docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1 DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml MAPS_RW_DIR=/opt/delivery_ws/maps_rw; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 20); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null 2>&1; then
    echo "API_UP attempt=$i"
    curl -s http://127.0.0.1:19999/api/version
    echo
    curl -s http://127.0.0.1:19999/api/restart/components | head -c 200
    echo
    ss -tlnp | grep 19999 || true
    exit 0
  fi
done

echo "API_STILL_DOWN"
docker exec "$C" tail -30 /var/log/delivery/dashboard_node.log 2>/dev/null || true
exit 1
