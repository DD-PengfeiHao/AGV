# Xavier cam_front ROS2 节点 · Humble Docker 简要步骤

> 配合 `docs/25_相机ROS2工业契约.md`

## 1. 网络

```bash
# eth1 必须 Link detected: yes
sudo ip addr add 192.168.1.1/24 dev eth1
sudo ip link set eth1 up
# 不要: sudo ip route add default via ... eth1
ping -c1 192.168.1.100
```

## 2. Humble 容器（示例）

```bash
# 将仓库 delivery_interfaces + camera_bridge 源码挂进容器后 colcon build
docker run --rm -it --network host --runtime nvidia \
  -e ROS_DOMAIN_ID=30 -e ROS_LOCALHOST_ONLY=0 \
  -v /path/to/ros2_ws:/ws \
  ros:humble-ros-base \
  bash -lc 'source /opt/ros/humble/setup.bash && cd /ws && colcon build --packages-select delivery_interfaces camera_bridge && source install/setup.bash && ros2 run camera_bridge cam_front_ros_node --ros-args -p camera_id:=192.168.1.100'
```

Jetson 上若需 Aravis/OpenCV，请换含系统库的镜像或 `--privileged` + 挂载 `/dev`，按现场镜像调整。

## 3. 验收

在 Xavier 与 NUC 上均执行：

```bash
export ROS_DOMAIN_ID=30
ros2 topic echo /camera/cam_front/heartbeat --once
ros2 topic hz /camera/cam_front/image_raw/compressed
```
