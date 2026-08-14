#!/usr/bin/env bash
# Start Zack xArm7 pick_place_node inside xarm7_real container (NUC host script)
set -euo pipefail

CONTAINER="${CONTAINER:-xarm7_real}"
ROBOT_IP="${ROBOT_IP:-172.31.0.123}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running" >&2
  exit 1
fi

docker exec -d "$CONTAINER" bash -lc "
  export ROS_DOMAIN_ID=30
  export ROS_LOCALHOST_ONLY=0
  source /opt/ros/humble/setup.bash
  mkdir -p /home/xarm/logs
  if pgrep -f pick_place_node.py >/dev/null 2>&1; then
    echo 'pick_place already running'
    exit 0
  fi
  nohup python3 /home/xarm/share/pick_place_node.py \
    > /home/xarm/logs/pick_place_node.log 2>&1 &
  sleep 2
  pgrep -af pick_place_node || true
"

echo "Zack pick_place_node start requested in $CONTAINER (robot $ROBOT_IP)"
