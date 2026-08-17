#!/usr/bin/env bash
# V0.52.0 NUC Release Candidate — deploy + read-only verify + 60s stability
set -u

TMP="${1:-/tmp/v052_rc}"
C="delivery_gazebo_soft"
PY_DW="/opt/delivery_ws/install/delivery_web/lib/python3.10/site-packages/delivery_web"
WWW="/opt/delivery_ws/install/delivery_web/share/delivery_web/www"
PY_AGV="/opt/delivery_ws/install/agv_bridge/lib/python3.10/site-packages/agv_bridge/agv_adapter"
SRC_DW="/opt/delivery_ws/src/delivery_web"
SRC_VISION="$SRC_DW/delivery_web/vision"
INST_VISION="$PY_DW/vision"
SRC_AGV="/opt/delivery_ws/src/agv_bridge/agv_bridge/agv_adapter"
LOG="/var/log/delivery/dashboard_node.log"

fail() { echo "FAIL: $*"; exit 1; }
ok()   { echo "OK: $*"; }

echo "========== DEPLOY V0.52.0 =========="
for f in dw/dashboard_node.py dw/stack_supervisor.py dw/wrist_camera.py \
         www/index.html www/alert_queue.js www/widgets.js \
         agv/models.py agv/real.py; do
  [ -f "$TMP/$f" ] || fail "missing $TMP/$f"
done

docker cp "$TMP/dw/dashboard_node.py"   "$C:$SRC_DW/delivery_web/dashboard_node.py"
docker cp "$TMP/dw/stack_supervisor.py"  "$C:$SRC_DW/delivery_web/stack_supervisor.py"
docker cp "$TMP/dw/wrist_camera.py"      "$C:$SRC_VISION/wrist_camera.py"
docker cp "$TMP/www/index.html"          "$C:$SRC_DW/www/index.html"
docker cp "$TMP/www/alert_queue.js"      "$C:$SRC_DW/www/alert_queue.js"
docker cp "$TMP/www/widgets.js"          "$C:$SRC_DW/www/widgets.js"
docker cp "$TMP/agv/models.py"           "$C:$SRC_AGV/models.py"
docker cp "$TMP/agv/real.py"             "$C:$SRC_AGV/real.py"

docker cp "$TMP/dw/dashboard_node.py"   "$C:$PY_DW/dashboard_node.py"
docker cp "$TMP/dw/stack_supervisor.py"  "$C:$PY_DW/stack_supervisor.py"
docker cp "$TMP/dw/wrist_camera.py"      "$C:$INST_VISION/wrist_camera.py"
docker cp "$TMP/www/index.html"          "$C:$WWW/index.html"
docker cp "$TMP/www/alert_queue.js"      "$C:$WWW/alert_queue.js"
docker cp "$TMP/www/widgets.js"          "$C:$WWW/widgets.js"
docker cp "$TMP/agv/models.py"           "$C:$PY_AGV/models.py"
docker cp "$TMP/agv/real.py"             "$C:$PY_AGV/real.py"

docker exec "$C" bash -lc "grep -m1 '_qr_busy = False' $INST_VISION/wrist_camera.py" \
  || fail "wrist_camera _qr_busy fix not in install path"
docker exec "$C" bash -lc "grep -m1 VERSION $PY_DW/dashboard_node.py" \
  || fail "dashboard_node VERSION line missing"

echo "========== STOP OLD INSTANCES =========="
PATTERN='install/delivery_web/lib/delivery_web/dashboard_node'
_count_dashboard() {
  docker exec "$C" bash -lc "ps -eo cmd | grep -F '$PATTERN' | grep -v grep | wc -l"
}
_kill_dashboard() {
  docker exec "$C" bash -lc "ps -eo pid,cmd | grep -F '$PATTERN' | grep -v grep | awk '{print \$1}' | xargs -r kill -9; ps -eo pid,cmd | grep -F 'ros2 run delivery_web dashboard_node' | grep -v grep | awk '{print \$1}' | xargs -r kill -9"
}
_kill_dashboard
sleep 2
cnt=$(_count_dashboard)
cnt=${cnt// /}
[ "$cnt" = "0" ] || fail "dashboard_node still running after kill: $cnt"

echo "========== START DASHBOARD =========="
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
  >> '"$LOG"' 2>&1'

for i in $(seq 1 30); do
  sleep 2
  if curl -sf -m 2 http://127.0.0.1:19999/api/version >/dev/null 2>&1; then
    ok "HTTP up after ${i}x2s"
    break
  fi
  [ "$i" = "30" ] && fail "HTTP never came up — tail log:" && docker exec "$C" tail -20 "$LOG"
done

echo "========== P0: wrist_camera import path =========="
docker exec "$C" bash -lc 'source /opt/ros/humble/setup.bash; source /opt/delivery_ws/install/setup.bash; python3 -c "
import delivery_web.vision.wrist_camera as m
print(\"IMPORT_FILE=\", m.__file__)
import inspect
src = inspect.getsourcefile(m.WristCameraBridge)
print(\"CLASS_FILE=\", src)
assert \"_qr_busy = False\" in open(m.__file__).read(), \"_qr_busy fix missing in loaded module\"
print(\"QR_BUSY_FIX=YES\")
"'

echo "========== P0: /api/version =========="
VER=$(curl -sf -m 3 http://127.0.0.1:19999/api/version)
echo "$VER"
echo "$VER" | grep -q '0.52.1' || fail "/api/version is not 0.52.1: $VER"

echo "========== P0: GET /api/restart/components (read-only) =========="
RESTART=$(curl -sf -m 3 http://127.0.0.1:19999/api/restart/components)
echo "$RESTART" | head -c 800
echo
echo "$RESTART" | grep -q '"components"' || fail "restart/components missing components key"
echo "$RESTART" | grep -q 'dashboard_node\|pick_place\|xarm' || fail "restart whitelist entries missing"

echo "========== P0: /api/state + alerts =========="
STATE=$(curl -sf -m 15 http://127.0.0.1:19999/api/state)
echo "$STATE" | head -c 600
echo
echo "$STATE" | grep -q '"alerts"' || fail "/api/state missing alerts"
# raw field optional if no active alerts
echo "$STATE" | grep -q '"agv"' || fail "/api/state missing agv block"

echo "========== P0: single instance =========="
INST=$(_count_dashboard)
INST=${INST// /}
echo "dashboard_node processes: $INST"
[ "$INST" = "1" ] || fail "expected exactly 1 dashboard_node, got $INST"

echo "========== P1: 60s stability (every 10s) =========="
START_PID=$(docker exec "$C" bash -lc "ps -eo pid,cmd | grep -F '$PATTERN' | grep -v grep | awk '{print \$1}' | head -1")
echo "baseline PID=$START_PID"
for t in 10 20 30 40 50 60; do
  sleep 10
  PID=$(docker exec "$C" bash -lc "ps -eo pid,cmd | grep -F '$PATTERN' | grep -v grep | awk '{print \$1}' | head -1" || true)
  PORT=$(ss -lntp 2>/dev/null | grep ':19999' || true)
  VER2=$(curl -sf -m 2 http://127.0.0.1:19999/api/version || echo FAIL)
  echo "t=${t}s PID=$PID PORT=${PORT:-NONE} version=$VER2"
  [ -n "$PID" ] || fail "PID gone at t=${t}s"
  [ "$PID" = "$START_PID" ] || fail "PID changed at t=${t}s ($START_PID -> $PID)"
  echo "$PORT" | grep -q ':19999' || fail "port 19999 gone at t=${t}s"
  echo "$VER2" | grep -q '0.52.1' || fail "/api/version failed at t=${t}s"
done

echo "========== P1: startup traceback check =========="
LOG_SINCE=$(docker exec "$C" bash -lc "grep -n 'Web DEMO' $LOG | tail -1 | cut -d: -f1" || true)
if [ -n "$LOG_SINCE" ]; then
  docker exec "$C" bash -lc "tail -n +$LOG_SINCE $LOG | grep -i traceback && exit 1 || exit 0" \
    && ok "no traceback since last Web DEMO" \
    || fail "traceback since last start"
else
  docker exec "$C" bash -lc "tail -40 $LOG" | grep -i traceback && fail "traceback in log" || ok "no traceback in last 40 log lines"
fi

echo ""
echo "=========================================="
echo " V0.52.1 NUC READY — all checks passed"
echo "=========================================="
