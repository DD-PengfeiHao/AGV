#!/usr/bin/env bash
# Deploy AGV Web V0.3 to VM 172.31.0.111
# Usage: SSHPASS=ubuntu ./deploy_v03_to_vm.sh

set -euo pipefail
VM=172.31.0.111
USER=ubuntu
SRC="$(cd "$(dirname "$0")/../migration_implementation/workspace_v02/ros2_ws/src" && pwd)"
VM_BASE="/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/AGV_Delivery_v0.2.0_20260807_0921/.run/workspace_v02/ros2_ws/src"
CONTAINER=delivery_gazebo_soft

run_ssh() {
  if command -v sshpass >/dev/null 2>&1 && [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e ssh -o StrictHostKeyChecking=no "${USER}@${VM}" "$@"
  else
    ssh -o StrictHostKeyChecking=no "${USER}@${VM}" "$@"
  fi
}

run_scp() {
  if command -v sshpass >/dev/null 2>&1 && [[ -n "${SSHPASS:-}" ]]; then
    sshpass -e scp -o StrictHostKeyChecking=no -r "$@"
  else
    scp -o StrictHostKeyChecking=no -r "$@"
  fi
}

echo "==> Copy delivery_web + agv_bridge"
run_scp "${SRC}/delivery_web" "${SRC}/agv_bridge" "${USER}@${VM}:${VM_BASE}/"

echo "==> Build inside container"
run_ssh "docker exec ${CONTAINER} bash -lc 'source /opt/ros/humble/setup.bash && cd /opt/delivery_ws && colcon build --packages-select agv_bridge delivery_web --symlink-install'"

echo "==> Restart dashboard (mock mode default)"
run_ssh "docker exec ${CONTAINER} bash -lc 'pkill -f dashboard_node || true; sleep 1; source /opt/ros/humble/setup.bash && source /opt/delivery_ws/install/setup.bash && export ROS_DOMAIN_ID=30 AGV_ENV_MODE=mock && nohup ros2 run delivery_web dashboard_node > /tmp/dashboard.log 2>&1 &'"

sleep 3
curl -sf "http://${VM}:19999/api/state" | head -c 200
echo ""
echo "Done. Open http://${VM}:19999/"
