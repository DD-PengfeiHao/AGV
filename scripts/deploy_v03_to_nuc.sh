#!/usr/bin/env bash
# Deploy AGV Web V0.3 to test NUC 172.31.0.84
# Prereq: SSH key to both dev (111) and NUC (84)
set -euo pipefail

DEV=172.31.0.111
NUC=172.31.0.84
USER=ubuntu
NUC_BASE="/home/ubuntu/Pengfei.Hao/AGV/V0.3"
DEV_RUN="/home/ubuntu/Pengfei.Hao/AGV_Delivery_v0.2.0_20260807_0921/AGV_Delivery_v0.2.0_20260807_0921/.run"
IMAGE="delivery-ros2:humble-gazebo-v02"

ssh_nuc() { ssh -o StrictHostKeyChecking=no "${USER}@${NUC}" "$@"; }

echo "==> [1/5] Install Docker on NUC"
ssh_nuc "echo ubuntu | sudo -S apt-get update -qq && echo ubuntu | sudo -S apt-get install -y -qq docker.io docker-compose-plugin 2>/dev/null || echo ubuntu | sudo -S apt-get install -y -qq docker.io"
ssh_nuc "echo ubuntu | sudo -S usermod -aG docker ubuntu 2>/dev/null || true"

echo "==> [2/5] Sync workspace from dev ($DEV) -> NUC ($NUC_BASE)"
ssh_nuc "mkdir -p ${NUC_BASE}"
ssh -o StrictHostKeyChecking=no "${USER}@${DEV}" \
  "tar czf - -C ${DEV_RUN} workspace_v02 agv_downloaded docker_data" \
  | ssh_nuc "tar xzf - -C ${NUC_BASE}"

echo "==> [3/5] Transfer Docker image (~2.4GB, may take several minutes)"
ssh -o StrictHostKeyChecking=no "${USER}@${DEV}" "docker save ${IMAGE}" \
  | ssh_nuc "echo ubuntu | sudo -S docker load"

echo "==> [4/5] Start container"
ssh_nuc "cd ${NUC_BASE}/workspace_v02 && echo ubuntu | sudo -S docker compose -f docker/docker-compose.yml --profile sim-soft up -d"

echo "==> [5/5] Build V0.3 packages + restart dashboard (demo mode)"
sleep 15
ssh_nuc "echo ubuntu | sudo -S docker exec delivery_gazebo_soft bash -lc 'source /opt/ros/humble/setup.bash && cd /opt/delivery_ws && colcon build --packages-select delivery_web agv_bridge --symlink-install'"
ssh_nuc "echo ubuntu | sudo -S docker exec delivery_gazebo_soft pkill -f delivery_web/dashboard_node || true"
sleep 2
ssh_nuc "echo ubuntu | sudo -S docker exec -d delivery_gazebo_soft bash -lc 'source /opt/ros/humble/setup.bash && source /opt/delivery_ws/install/setup.bash && export ROS_DOMAIN_ID=30 DELIVERY_ENV=demo && exec ros2 run delivery_web dashboard_node >> /var/log/delivery/dashboard_node.log 2>&1'"

sleep 8
curl -sf "http://${NUC}:19999/api/health" | head -c 200 || true
echo ""
echo "Done. Open http://${NUC}:19999/"
