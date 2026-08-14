#!/usr/bin/env bash
# Full NUC alpha stack: delivery container + Zack xArm pick_place
set -euo pipefail

NUC="${NUC:-172.31.0.84}"
USER="${USER:-ubuntu}"
CONTAINER="${CONTAINER:-delivery_gazebo_soft}"
ALPHA_META="/home/ubuntu/Pengfei.Hao/AGV/alpha"

ssh -o BatchMode=yes "${USER}@${NUC}" bash -s <<'REMOTE'
set -euo pipefail
CONTAINER="delivery_gazebo_soft"
ALPHA_META="/home/ubuntu/Pengfei.Hao/AGV/alpha"

docker exec -d "$CONTAINER" bash -lc '
  export ROS_DOMAIN_ID=30 ROS_LOCALHOST_ONLY=0 STACK_AUTO_START=1
  export DELIVERY_ENV=demo ARM_MODE=real ARM_REAL_MOTION=0 USE_SIM_CAMERAS=0
  export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.yaml
  export PYLON_ROOT=/opt/pylon
  export GENICAM_GENTL64_PATH=/opt/pylon/lib/gentlproducer/gtl
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  mkdir -p /var/log/delivery
  pkill -f dashboard_node || true
  sleep 1
  bash '"$ALPHA_META"'/start_dashboard_alpha.sh > /var/log/delivery/alpha_stack.log 2>&1 &
'

if docker ps --format '{{.Names}}' | grep -qx xarm7_real; then
  docker exec -d xarm7_real bash -lc '
    export ROS_DOMAIN_ID=30 ROS_LOCALHOST_ONLY=0
    source /opt/ros/humble/setup.bash
    mkdir -p /home/xarm/logs
    if ! pgrep -f pick_place_node.py >/dev/null 2>&1; then
      nohup python3 /home/xarm/share/pick_place_node.py > /home/xarm/logs/pick_place_node.log 2>&1 &
    fi
  '
fi

sleep 10
curl -sf http://127.0.0.1:19999/api/version || true
echo
curl -sf http://127.0.0.1:19999/api/stack/status || true
echo
REMOTE

echo "Alpha stack start requested on $NUC"
