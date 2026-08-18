#!/usr/bin/env bash
# V0.52.5 deploy: BlackBox + MapManager + V2 www into delivery_gazebo_soft
set -eu
TMP="${1:-/tmp/v0525_deploy}"
C="delivery_gazebo_soft"
PY_DW="/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web"
WWW="/opt/delivery_ws/install/delivery_web/share/delivery_web/www"
SRC_DW="/opt/delivery_ws/src/delivery_web"

fail() { echo "DEPLOY_FAIL: $*"; exit 1; }
ok() { echo "DEPLOY_OK: $*"; }

[ -d "$TMP/delivery_web/blackbox" ] || fail "missing $TMP/delivery_web/blackbox"
[ -d "$TMP/delivery_web/map_manager" ] || fail "missing $TMP/delivery_web/map_manager"
[ -f "$TMP/delivery_web/dashboard_node.py" ] || fail "missing dashboard_node.py"
[ -f "$TMP/www/index.html" ] || fail "missing www/index.html"

echo "========== COPY SRC =========="
docker cp "$TMP/delivery_web/dashboard_node.py" "$C:$SRC_DW/delivery_web/dashboard_node.py"
docker cp "$TMP/delivery_web/web_auth.py" "$C:$SRC_DW/delivery_web/web_auth.py"
docker cp "$TMP/delivery_web/blackbox" "$C:$SRC_DW/delivery_web/blackbox"
docker cp "$TMP/delivery_web/map_manager" "$C:$SRC_DW/delivery_web/map_manager"
docker cp "$TMP/www/index.html" "$C:$SRC_DW/www/index.html"
docker cp "$TMP/www/auth.js" "$C:$SRC_DW/www/auth.js"
docker cp "$TMP/www/alert_queue.js" "$C:$SRC_DW/www/alert_queue.js"
docker cp "$TMP/www/widgets.js" "$C:$SRC_DW/www/widgets.js"
[ -d "$TMP/www/v2" ] && docker cp "$TMP/www/v2" "$C:$SRC_DW/www/v2"
[ -f "$TMP/www/debug/index.html" ] && docker cp "$TMP/www/debug/index.html" "$C:$SRC_DW/www/debug/index.html"

echo "========== COPY INSTALL =========="
docker cp "$TMP/delivery_web/dashboard_node.py" "$C:$PY_DW/dashboard_node.py"
docker cp "$TMP/delivery_web/web_auth.py" "$C:$PY_DW/web_auth.py"
docker cp "$TMP/delivery_web/blackbox" "$C:$PY_DW/blackbox"
docker cp "$TMP/delivery_web/map_manager" "$C:$PY_DW/map_manager"
docker cp "$TMP/www/index.html" "$C:$WWW/index.html"
docker cp "$TMP/www/auth.js" "$C:$WWW/auth.js"
docker cp "$TMP/www/alert_queue.js" "$C:$WWW/alert_queue.js"
docker cp "$TMP/www/widgets.js" "$C:$WWW/widgets.js"
[ -d "$TMP/www/v2" ] && docker cp "$TMP/www/v2" "$C:$WWW/v2"
[ -f "$TMP/www/debug/index.html" ] && docker cp "$TMP/www/debug/index.html" "$C:$WWW/debug/index.html"

docker exec "$C" bash -lc "grep -m1 'VERSION = \"0.52.5\"' $PY_DW/dashboard_node.py" || fail "VERSION 0.52.5 not in install path"
docker exec "$C" bash -lc "test -f $PY_DW/blackbox/manager.py" || fail "blackbox package missing"
docker exec "$C" bash -lc "test -f $PY_DW/map_manager/manager.py" || fail "map_manager package missing"

echo "========== RESTART DASHBOARD =========="
PATTERN='install/delivery_web/lib/delivery_web/dashboard_node'
docker exec "$C" bash -lc "ps -eo pid,cmd | grep -F '$PATTERN' | grep -v grep | awk '{print \$1}' | xargs -r kill -9; ps -eo pid,cmd | grep -F 'ros2 run delivery_web dashboard_node' | grep -v grep | awk '{print \$1}' | xargs -r kill -9" || true
sleep 2

docker exec -d "$C" bash -lc 'export ROS_DOMAIN_ID=30 RMW_IMPLEMENTATION=rmw_fastrtps_cpp ARM_MODE=real ARM_REAL_MOTION=1 DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml MAPS_RW_DIR=/opt/delivery_ws/maps_rw BLACKBOX_DIR=/home/ubuntu/Pengfei.Hao/blackbox MAP_CACHE_DIR=/home/ubuntu/Pengfei.Hao/maps; source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; exec ros2 run delivery_web dashboard_node --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 -p stations_file:=/opt/delivery_ws/maps_rw/stations_from_smap.json >> /var/log/delivery/dashboard_node.log 2>&1'

for i in $(seq 1 20); do
  sleep 2
  if docker exec "$C" bash -lc 'curl -sf -m 2 http://127.0.0.1:19999/api/version' >/dev/null 2>&1; then
    ok "HTTP up"
    docker exec "$C" bash -lc 'curl -s http://127.0.0.1:19999/api/version | head -c 200'
    echo
    exit 0
  fi
done
fail "dashboard did not bind :19999"
docker exec "$C" tail -30 /var/log/delivery/dashboard_node.log
