#!/usr/bin/env bash
# v0.2 soft smoke without gzserver (physics proxy + same ROS APIs)
set -eo pipefail
export AMENT_TRACE_SETUP_FILES="${AMENT_TRACE_SETUP_FILES:-}"
export COLCON_TRACE="${COLCON_TRACE:-}"
export AMENT_PYTHON_EXECUTABLE="${AMENT_PYTHON_EXECUTABLE:-}"
# shellcheck disable=SC1091
source /opt/ros/humble/setup.bash
# shellcheck disable=SC1091
source /opt/delivery_ws/install/setup.bash

export ROS_DOMAIN_ID="${ROS_DOMAIN_ID:-30}"
export ROS_LOCALHOST_ONLY="${ROS_LOCALHOST_ONLY:-0}"
export FACE_BACKEND="${FACE_BACKEND:-stub}"
export FACE_JETSON_IP="${FACE_JETSON_IP:-192.168.0.225}"
export FACE_CAMERA_NAME="${FACE_CAMERA_NAME:-cam_front}"
export FACE_LOG_DIR="${FACE_LOG_DIR:-/var/log/delivery/face}"
export FACE_LOG_LEVEL="${FACE_LOG_LEVEL:-DEBUG}"
# cam_front: ros2 (正式) | xavier/mjpeg (legacy HTTP) | gazebo
export CAM_FRONT_SOURCE="${CAM_FRONT_SOURCE:-ros2}"
export XAVIER_CAM_STREAM_URL="${XAVIER_CAM_STREAM_URL:-http://${FACE_JETSON_IP}:8080/stream}"
mkdir -p "$FACE_LOG_DIR"
STATIONS="${STATIONS_FILE:-/data/agv_downloaded/maps/stations_from_smap.json}"

LM1_X=6.26
LM1_Y=-0.659
if [ -f "$STATIONS" ]; then
  LM1_X=$(python3 -c "import json;d=json.load(open('$STATIONS',encoding='utf-8-sig'));print(d['stations']['LM1']['x'])")
  LM1_Y=$(python3 -c "import json;d=json.load(open('$STATIONS',encoding='utf-8-sig'));print(d['stations']['LM1']['y'])")
fi

echo "[v0.2-lite] physics proxy + bridges (gzserver not installed)"
GZ_SKIP=()
if [ "$CAM_FRONT_SOURCE" = "ros2" ] || [ "$CAM_FRONT_SOURCE" = "xavier" ] || [ "$CAM_FRONT_SOURCE" = "mjpeg" ]; then
  GZ_SKIP+=(-p "skip_cameras:=[\"cam_front\"]")
fi
ros2 run delivery_gazebo gz_physics_proxy --ros-args \
  -p start_x:="$LM1_X" -p start_y:="$LM1_Y" \
  "${GZ_SKIP[@]}" &

ros2 run delivery_gazebo agv_gazebo_nav --ros-args \
  -p stations_file:="$STATIONS" \
  -p cmd_vel_topic:=/agv/cmd_vel \
  -p odom_topic:=/agv/odom \
  -p vehicle_id:=GZ-AMB-150 &

ros2 run delivery_gazebo arm_gazebo_driver &
QR_SKIP=()
if [ "$CAM_FRONT_SOURCE" = "ros2" ] || [ "$CAM_FRONT_SOURCE" = "xavier" ] || [ "$CAM_FRONT_SOURCE" = "mjpeg" ]; then
  QR_SKIP+=(-p "skip_info_cameras:=[\"cam_front\"]")
fi
ros2 run delivery_gazebo camera_gazebo_qr --ros-args "${QR_SKIP[@]}" &

ros2 run delivery_web dashboard_node --ros-args \
  -p http_host:=0.0.0.0 \
  -p demo_port:=19999 \
  -p debug_port:=1999 \
  -p stations_file:="$STATIONS" \
  -p face_peer:="$FACE_JETSON_IP" &

# Face bridge (docs/18): stub now; afternoon switch FACE_BACKEND=remote_topics
ros2 run face_bridge face_bridge_node --ros-args \
  -p backend:="$FACE_BACKEND" \
  -p jetson_ip:="$FACE_JETSON_IP" \
  -p primary_camera:="$FACE_CAMERA_NAME" \
  -p log_dir:="$FACE_LOG_DIR" \
  -p log_level:="$FACE_LOG_LEVEL" \
  -p domain_id:="$ROS_DOMAIN_ID" &

if [ "$CAM_FRONT_SOURCE" = "ros2" ]; then
  echo "[v0.2-lite] cam_front <- ROS2 ingress (docs/25) peer=$FACE_JETSON_IP"
  ros2 run camera_bridge camera_ingress_node --ros-args \
    -p camera_name:=cam_front \
    -p heartbeat_timeout_sec:=1.5 &
elif [ "$CAM_FRONT_SOURCE" = "xavier" ] || [ "$CAM_FRONT_SOURCE" = "mjpeg" ]; then
  echo "[v0.2-lite] cam_front <- LEGACY MJPEG $XAVIER_CAM_STREAM_URL"
  ros2 run camera_bridge xavier_cam_front_bridge --ros-args \
    -p stream_url:="$XAVIER_CAM_STREAM_URL" \
    -p camera_name:=cam_front &
fi

# Jason Basler real camera — always on; QR controlled separately via Web
if [ "${JASON_CAMERA:-1}" != "0" ]; then
  echo "[v0.2-lite] Jason Basler camera (REAL) launch"
  nohup ros2 launch delivery_bringup jason_camera.launch.py > /var/log/delivery/jason_camera.log 2>&1 &
fi

echo "[v0.2-lite] Demo http://0.0.0.0:19999  Debug http://0.0.0.0:1999"
echo "[v0.2-lite] Jason Camera page http://0.0.0.0:19999/camera.html"
echo "[v0.2-lite] face_bridge backend=$FACE_BACKEND peer=$FACE_JETSON_IP log=$FACE_LOG_DIR"
echo "[v0.2-lite] CAM_FRONT_SOURCE=$CAM_FRONT_SOURCE domain=$ROS_DOMAIN_ID"
wait
