#!/usr/bin/env bash
# Standalone Jason Basler camera + QR launcher (NOT wired into boot_gazebo_lite.sh).
# Usage inside delivery_gazebo_soft:
#   bash /boot_jason_camera.sh camera   # Stage 6-9
#   bash /boot_jason_camera.sh qr       # Stage 10-12 (camera must already stream)
#   bash /boot_jason_camera.sh both     # combined (verify single wechat_qr_node)
set -euo pipefail

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
export PYLON_ROOT="${PYLON_ROOT:-/opt/pylon}"
export GENICAM_GENTL64_PATH="${GENICAM_GENTL64_PATH:-/opt/pylon/lib/gentlproducer/gtl}"

source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash

MODE="${1:-camera}"

case "$MODE" in
  camera)
    exec ros2 launch delivery_bringup jason_camera.launch.py
    ;;
  qr)
    exec ros2 launch qrcode_detector qrcode_detector.launch.py \
      image_topic:=/my_camera/pylon_ros2_camera_node/image_raw
    ;;
  both)
    exec ros2 launch delivery_bringup jason_camera_qr.launch.py
    ;;
  *)
    echo "Usage: $0 {camera|qr|both}" >&2
    exit 2
    ;;
esac
