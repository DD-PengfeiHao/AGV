#!/usr/bin/env bash
# AGV Web Alpha stack launcher (run inside delivery_gazebo_soft)
set -e

export ROS_DOMAIN_ID=30
export ROS_LOCALHOST_ONLY=0
export DELIVERY_ENV=demo
export ARM_MODE=real
export ARM_REAL_MOTION=1
export USE_SIM_CAMERAS=0
export STACK_AUTO_START=1
export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.yaml
export VERBOSE_LOG_DIR=/var/log/delivery/verbose
export PYLON_ROOT="${PYLON_ROOT:-/opt/pylon}"
export GENICAM_GENTL64_PATH="${GENICAM_GENTL64_PATH:-/opt/pylon/lib/gentlproducer/gtl}"

set +u
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash

mkdir -p /var/log/delivery

if ! python3 -c "from pyzbar.pyzbar import decode" >/dev/null 2>&1; then
  echo "[alpha] installing pyzbar (Jason OpenCV 4.5.4 has no QUIRC)"
  if ls /opt/delivery_ws/src/delivery_web/scripts/debs/*.deb >/dev/null 2>&1; then
    dpkg -i /opt/delivery_ws/src/delivery_web/scripts/debs/*.deb || apt-get install -y -f || true
  else
    apt-get update -qq && apt-get install -y python3-pyzbar libzbar0 || true
  fi
fi

ros_setup() {
  set +u
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
}

start_if_missing() {
  local pattern="$1"
  local logfile="$2"
  shift 2
  if pgrep -f "$pattern" >/dev/null 2>&1; then
    echo "[alpha] already running: $pattern"
    return 0
  fi
  echo "[alpha] starting: $*"
  nohup bash -c "$(declare -f ros_setup); ros_setup; $*" >>"$logfile" 2>&1 &
  sleep 2
}

pkill -f "delivery_web/dashboard_node" 2>/dev/null || true
sleep 1

start_if_missing keyence_sr_node /var/log/delivery/keyence_sr_node.log \
  "ros2 launch keyence_sr_wrapper keyence_sr_node.launch.py scanner_ip:=172.31.0.91 scanner_port:=9004"

start_if_missing pylon_ros2_camera /var/log/delivery/jason_camera.log \
  "ros2 launch delivery_bringup jason_camera.launch.py"

sleep 3

start_if_missing qrcode_node /var/log/delivery/wrist_qr.log \
  "ros2 launch qrcode_detector qrcode_detector.launch.py image_topic:=/my_camera/pylon_ros2_camera_node/image_raw"

start_if_missing apriltag_node /var/log/delivery/wrist_apriltag.log \
  "ros2 run apriltag_ros apriltag_node --ros-args -r image_rect:=/my_camera/pylon_ros2_camera_node/image_raw -r camera_info:=/my_camera/pylon_ros2_camera_node/camera_info --params-file /opt/delivery_ws/src/delivery_web/config/apriltag_36h11.yaml"

exec ros2 run delivery_web dashboard_node \
  --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:=/data/agv_downloaded/maps/stations_from_smap.json
