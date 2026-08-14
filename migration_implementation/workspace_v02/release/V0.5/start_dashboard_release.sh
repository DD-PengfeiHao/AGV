#!/usr/bin/env bash
# AGV Web V0.5 RELEASE — start dashboard inside delivery_gazebo_soft (NUC)
set -euo pipefail

export ROS_DOMAIN_ID=30
export DELIVERY_ENV="${DELIVERY_ENV:-demo}"
export ARM_MODE="${ARM_MODE:-real}"
export ARM_REAL_MOTION="${ARM_REAL_MOTION:-0}"
export USE_SIM_CAMERAS="${USE_SIM_CAMERAS:-0}"
export DELIVERY_DEVICES_YAML="${DELIVERY_DEVICES_YAML:-/opt/delivery_ws/src/delivery_web/config/devices.nuc.yaml}"
export VERBOSE_LOG_DIR="${VERBOSE_LOG_DIR:-/var/log/delivery/verbose}"
export SYSTEM_LOG_DIR="${SYSTEM_LOG_DIR:-/var/log/delivery/system}"

source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash

# Vision helpers (Keyence floor scanner — separate Ethernet device at 172.31.0.91)
if ! pgrep -f keyence_sr_node >/dev/null 2>&1; then
  nohup ros2 launch keyence_sr_wrapper keyence_sr_node.launch.py \
    scanner_ip:=172.31.0.91 scanner_port:=9004 \
    > /var/log/delivery/keyence_sr_node.log 2>&1 &
  sleep 2
fi

exec ros2 run delivery_web dashboard_node \
  --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:=/data/agv_downloaded/maps/stations_from_smap.json \
  -p face_peer:=192.168.0.225
