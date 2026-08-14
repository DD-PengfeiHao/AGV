#!/usr/bin/env bash
# DEPRECATED on ALPHA VM — host has no ROS. Use start_pylon_in_container.sh instead.
# Start Pylon wrist camera inside delivery_gazebo_soft (network_mode: host).

set -euo pipefail
export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"

WS="${PYLON_WS:-/home/ubuntu/ros2_ws}"
CFG="${PYLON_CFG:-$WS/src/pylon_ros2_camera_wrapper/config/aca2500_106611_18.tuned_v3.yaml}"

if [[ ! -f "$CFG" ]]; then
  echo "ERROR: config not found: $CFG"
  echo "Try: ls $WS/src/pylon_ros2_camera_wrapper/config/"
  exit 1
fi

cd "$WS"
source /opt/ros/humble/setup.bash
source install/setup.bash

echo "ROS_DOMAIN_ID=$ROS_DOMAIN_ID"
echo "Config: $CFG"
echo "Starting Pylon — leave this terminal open"

ros2 launch pylon_ros2_camera_wrapper pylon_ros2_camera.launch.py "config_file:=$CFG"
