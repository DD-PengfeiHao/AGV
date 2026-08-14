#!/usr/bin/env bash
# Restart delivery_web dashboard inside delivery_gazebo_soft (safe recovery).
set -euo pipefail

CONTAINER="${CONTAINER:-delivery_gazebo_soft}"
ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
DELIVERY_ENV="${DELIVERY_ENV:-demo}"

docker exec "$CONTAINER" bash -lc "
  set -e
  pkill -9 -f dashboard_node 2>/dev/null || true
  sleep 2
  if ss -tlnp 2>/dev/null | grep -q ':19999'; then
    echo 'ERROR: port 19999 still in use'
    ss -tlnp | grep 19999 || true
    exit 1
  fi
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  export ROS_DOMAIN_ID=$ROS_DOMAIN_ID DELIVERY_ENV=$DELIVERY_ENV
  nohup ros2 run delivery_web dashboard_node > /var/log/delivery/dashboard_node.log 2>&1 &
  sleep 5
  if pgrep -f 'delivery_web/dashboard_node' >/dev/null; then
    echo 'dashboard_node started'
    curl -sf http://127.0.0.1:19999/api/health && echo
  else
    echo 'ERROR: dashboard failed to start — log tail:'
    tail -40 /var/log/delivery/dashboard_node.log 2>/dev/null || true
    exit 1
  fi
"
