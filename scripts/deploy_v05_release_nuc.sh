#!/usr/bin/env bash
# Deploy AGV Web V0.5 RELEASE to NUC 172.31.0.84
set -euo pipefail

NUC=172.31.0.84
USER=ubuntu
LOCAL_WS="$(cd "$(dirname "$0")/../migration_implementation/workspace_v02" && pwd)"
NUC_ROOT="/home/ubuntu/Pengfei.Hao/AGV"
ALPHA_SRC="${NUC_ROOT}/alpha/workspace_v02/ros2_ws/src"
ALPHA_META="${NUC_ROOT}/alpha"
RELEASE_META="${NUC_ROOT}/release"
ZACK_STACK="/home/ubuntu/Zack.Li/AGV/v43"
CONTAINER="delivery_gazebo_soft"

ssh_nuc() { ssh -o BatchMode=yes -o StrictHostKeyChecking=no "${USER}@${NUC}" "$@"; }

echo "==> [1/6] Prepare NUC directories"
ssh_nuc "mkdir -p ${ALPHA_SRC}/delivery_web ${ALPHA_SRC}/agv_bridge ${RELEASE_META}"

echo "==> [2/6] Sync delivery_web + agv_bridge (alpha workspace)"
tar czf - -C "${LOCAL_WS}/ros2_ws/src" delivery_web agv_bridge \
  | ssh_nuc "tar xzf - -C ${ALPHA_SRC}"

echo "==> [3/6] Install release scripts"
scp -o BatchMode=yes "${LOCAL_WS}/release/V0.5/start_dashboard_release.sh" \
  "${USER}@${NUC}:${RELEASE_META}/"
ssh_nuc "chmod +x ${RELEASE_META}/start_dashboard_release.sh"
echo "0.5.0" | ssh_nuc "tee ${RELEASE_META}/VERSION"

echo "==> [4/6] colcon build (delivery_web + agv_bridge + keyence_sr_wrapper)"
ssh_nuc "docker exec ${CONTAINER} bash -lc 'source /opt/ros/humble/setup.bash && cd /opt/delivery_ws && colcon build --packages-select delivery_web agv_bridge keyence_sr_wrapper 2>&1'"

echo "==> [5/6] Restart dashboard (V0.5 RELEASE profile)"
ssh_nuc "docker exec ${CONTAINER} pkill -f dashboard_node || true"
ssh_nuc "docker exec ${CONTAINER} pkill -f keyence_sr_node || true"
sleep 3
ssh_nuc "docker exec -d ${CONTAINER} bash -lc '
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  export ROS_DOMAIN_ID=30
  export DELIVERY_ENV=demo
  export ARM_MODE=real
  export ARM_REAL_MOTION=0
  export USE_SIM_CAMERAS=0
  export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
  export VERBOSE_LOG_DIR=/var/log/delivery/verbose
  nohup ros2 launch keyence_sr_wrapper keyence_sr_node.launch.py scanner_ip:=172.31.0.91 scanner_port:=9004 > /var/log/delivery/keyence_sr_node.log 2>&1 &
  sleep 2
  nohup ros2 run delivery_web dashboard_node \
    --ros-args -p http_host:=0.0.0.0 -p demo_port:=19999 -p debug_port:=1999 \
    -p stations_file:=/data/agv_downloaded/maps/stations_from_smap.json \
    > /var/log/delivery/dashboard_node.log 2>&1 &
'"

echo "==> [6/6] Verify"
sleep 8
curl -sf "http://${NUC}:19999/api/version" && echo ""
curl -sf -o /dev/null -w "wrist_snapshot: HTTP %{http_code} %{size_download} bytes\n" \
  "http://${NUC}:19999/api/vision/wrist_camera/snapshot" || true
curl -sf "http://${NUC}:19999/api/arm/status" | head -c 300 && echo ""
echo ""
echo "Done. Release: http://${NUC}:19999/  (V0.5.0)"
