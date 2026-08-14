#!/usr/bin/env bash
# Deploy AGV Web Alpha to NUC /home/ubuntu/Pengfei.Hao/AGV/alpha
set -euo pipefail

NUC=172.31.0.84
USER=ubuntu
LOCAL_WS="$(cd "$(dirname "$0")/../migration_implementation/workspace_v02" && pwd)"
NUC_ROOT="/home/ubuntu/Pengfei.Hao/AGV"
ALPHA_SRC="${NUC_ROOT}/alpha/workspace_v02/ros2_ws/src"
ALPHA_META="${NUC_ROOT}/alpha"
CONTAINER="delivery_gazebo_soft"

ssh_nuc() { ssh -o BatchMode=yes -o StrictHostKeyChecking=no "${USER}@${NUC}" "$@"; }

echo "==> [1/5] Sync delivery_web to alpha"
tar czf - -C "${LOCAL_WS}/ros2_ws/src" delivery_web agv_bridge \
  | ssh_nuc "tar xzf - -C ${ALPHA_SRC}"

echo "==> [2/5] Install alpha scripts"
scp -o BatchMode=yes "${LOCAL_WS}/release/alpha/start_dashboard_alpha.sh" \
  "${USER}@${NUC}:${ALPHA_META}/"
ssh_nuc "chmod +x ${ALPHA_META}/start_dashboard_alpha.sh"
echo "0.5.0-alpha" | ssh_nuc "tee ${ALPHA_META}/VERSION"

echo "==> [3/5] colcon build"
ssh_nuc "docker exec ${CONTAINER} bash -lc 'source /opt/ros/humble/setup.bash && cd /opt/delivery_ws && colcon build --packages-select delivery_web agv_bridge keyence_sr_wrapper 2>&1'"

echo "==> [4/5] Restart alpha stack (camera + scanner + dashboard + xarm)"
ssh_nuc "docker exec ${CONTAINER} pkill -f dashboard_node || true"
sleep 2
scp -o BatchMode=yes "${LOCAL_WS}/release/alpha/start_dashboard_alpha.sh" \
  "${USER}@${NUC}:${ALPHA_META}/"
ssh_nuc "chmod +x ${ALPHA_META}/start_dashboard_alpha.sh"
ssh_nuc "docker exec ${CONTAINER} sed -i 's/\\r$//' /opt/delivery_ws/src/delivery_web/scripts/start_dashboard_alpha.sh 2>/dev/null || true"
ssh_nuc "docker exec -d ${CONTAINER} bash -lc '
  chmod +x /opt/delivery_ws/src/delivery_web/scripts/start_dashboard_alpha.sh 2>/dev/null || true
  nohup bash /opt/delivery_ws/src/delivery_web/scripts/start_dashboard_alpha.sh > /var/log/delivery/alpha_stack.log 2>&1 &
'"
ssh_nuc "if docker ps --format '{{.Names}}' | grep -qx xarm7_real; then docker exec -d xarm7_real bash -lc '
  export ROS_DOMAIN_ID=30 ROS_LOCALHOST_ONLY=0
  source /opt/ros/humble/setup.bash
  mkdir -p /home/xarm/logs
  if ! pgrep -f pick_place_node.py >/dev/null 2>&1; then
    nohup python3 /home/xarm/share/pick_place_node.py > /home/xarm/logs/pick_place_node.log 2>&1 &
  fi
'; fi"

echo "==> [5/5] Verify"
sleep 8
curl -sf "http://${NUC}:19999/api/version" && echo ""
echo "Alpha: http://${NUC}:19999/"
