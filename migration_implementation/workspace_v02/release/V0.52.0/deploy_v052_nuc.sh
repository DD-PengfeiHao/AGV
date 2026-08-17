#!/usr/bin/env bash
set -eu
TMP="${1:-/tmp/v052_deploy}"
C="delivery_gazebo_soft"
PY_DW="/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web"
WWW="/opt/delivery_ws/install/delivery_web/share/delivery_web/www"
PY_AGV="/opt/delivery_ws/install/agv_bridge/lib/python3.10/site-packages/agv_bridge/agv_adapter"
SRC_DW="/opt/delivery_ws/src/delivery_web"
SRC_AGV="/opt/delivery_ws/src/agv_bridge/agv_bridge/agv_adapter"
RELEASE="/home/ubuntu/Pengfei.Hao/AGV/release/V0.51.4/start_dashboard_release.sh"

docker cp "$TMP/dw/dashboard_node.py" "$C:$SRC_DW/delivery_web/dashboard_node.py"
docker cp "$TMP/dw/stack_supervisor.py" "$C:$SRC_DW/delivery_web/stack_supervisor.py"
docker cp "$TMP/www/index.html" "$C:$SRC_DW/www/index.html"
docker cp "$TMP/www/alert_queue.js" "$C:$SRC_DW/www/alert_queue.js"
docker cp "$TMP/www/widgets.js" "$C:$SRC_DW/www/widgets.js"
docker cp "$TMP/agv/models.py" "$C:/opt/delivery_ws/src/agv_bridge/agv_bridge/agv_adapter/models.py"
docker cp "$TMP/agv/real.py" "$C:/opt/delivery_ws/src/agv_bridge/agv_bridge/agv_adapter/real.py"

docker cp "$TMP/dw/dashboard_node.py" "$C:$PY_DW/dashboard_node.py"
docker cp "$TMP/dw/stack_supervisor.py" "$C:$PY_DW/stack_supervisor.py"
docker cp "$TMP/www/index.html" "$C:$WWW/index.html"
docker cp "$TMP/www/alert_queue.js" "$C:$WWW/alert_queue.js"
docker cp "$TMP/www/widgets.js" "$C:$WWW/widgets.js"
docker cp "$TMP/agv/models.py" "$C:$PY_AGV/models.py"
docker cp "$TMP/agv/real.py" "$C:$PY_AGV/real.py"

docker exec "$C" bash -lc "rm -f $WWW/status_banner.js"
docker exec "$C" bash -lc "grep -m1 VERSION $PY_DW/dashboard_node.py"
docker exec "$C" bash -lc "ls -la $WWW/alert_queue.js"

docker exec "$C" bash -lc 'pgrep -f /lib/delivery_web/dashboard_node | xargs -r kill -9 || true'
sleep 2
docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1 DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'
sleep 8
docker exec "$C" bash -lc 'pgrep -af /lib/delivery_web/dashboard_node | head -3 || echo NO_PROCESS'
