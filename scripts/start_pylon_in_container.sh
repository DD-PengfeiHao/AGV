#!/usr/bin/env bash
# Start Jason Basler Pylon camera INSIDE delivery_gazebo_soft (VM host has no ROS).
# Container uses network_mode: host — GigE camera is reachable from here.

set -euo pipefail

CONTAINER="${CONTAINER:-delivery_gazebo_soft}"

docker exec "$CONTAINER" bash -lc '
  export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
  export PYLON_ROOT="${PYLON_ROOT:-/opt/pylon}"
  export GENICAM_GENTL64_PATH="${GENICAM_GENTL64_PATH:-/opt/pylon/lib/gentlproducer/gtl}"
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash

  if pgrep -f pylon_ros2_camera_wrapper >/dev/null 2>&1; then
    echo "Pylon already running:"
    pgrep -af pylon_ros2_camera_wrapper
    exit 0
  fi

  echo "Starting Jason camera (delivery_bringup jason_camera.launch.py)..."
  nohup ros2 launch delivery_bringup jason_camera.launch.py \
    > /var/log/delivery/jason_camera.log 2>&1 &
  sleep 3
  echo "--- tail jason_camera.log ---"
  tail -30 /var/log/delivery/jason_camera.log || true
  echo "--- publisher check ---"
  ros2 topic info /my_camera/pylon_ros2_camera_node/image_raw 2>/dev/null || true
'
