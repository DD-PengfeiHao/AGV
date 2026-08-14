# AGV Web V0.5 RELEASE

| 项目 | 值 |
|------|-----|
| 版本 | **0.5.0** |
| 渠道 | **Release**（NUC 172.31.0.84） |
| Alpha | VM 172.31.0.111（开发/验收） |
| Web | http://172.31.0.84:19999/ |
| ROS_DOMAIN_ID | **30** |

## 与 Zack xArm 共存（同机，非跨机 IP）

| 项目 | 路径 / 容器 |
|------|-------------|
| AGV Release | `/home/ubuntu/Pengfei.Hao/AGV` |
| Zack xArm | `/home/ubuntu/Zack.Li/AGV/v43` → 容器 `xarm7_real` |
| AGV 容器 | `delivery_gazebo_soft` |

两台容器均 **host 网络** + **ROS_DOMAIN_ID=30**。机械臂走本机 ROS2 DDS，不走 VM 那种跨机 IP：

- `/joint_states`、`/pick_place_state`
- `/unlock_and_home`、`/do_pick_place`、`/set_gripper`

`xarm7.host: 172.31.0.123` 是 **UFACTORY 机械臂控制器 IP**（与 Zack `docker-compose` 一致），不是 ROS 主控地址。

默认 `ARM_MODE=real`，`ARM_REAL_MOTION=0`，`USE_SIM_CAMERAS=0`。

## 部署路径

```
/home/ubuntu/Pengfei.Hao/AGV/V0.5_RELEASE/                         # Release 元数据 + 启动脚本
/home/ubuntu/Pengfei.Hao/AGV/V0.3/workspace_v02/ros2_ws/src/     # 源码（Docker bind mount）
/home/ubuntu/Zack.Li/AGV/v43/                                     # Zack 机械臂栈（独立维护）
```

## 快速命令

```bash
# 重启 Release Dashboard
docker exec delivery_gazebo_soft pkill -f dashboard_node || true
sleep 2
docker exec -d delivery_gazebo_soft bash /opt/delivery_ws/src/delivery_web/config/../../../../../V0.5_RELEASE/start_dashboard_release.sh

# 或（容器内路径）
docker exec -d delivery_gazebo_soft bash -lc '
  source /opt/ros/humble/setup.bash
  source /opt/delivery_ws/install/setup.bash
  export ROS_DOMAIN_ID=30 DELIVERY_ENV=demo ARM_MODE=real ARM_REAL_MOTION=0
  export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
  nohup ros2 run delivery_web dashboard_node > /var/log/delivery/dashboard_node.log 2>&1 &
'

# 验证
curl http://172.31.0.84:19999/api/version
curl http://172.31.0.84:19999/api/arm/status
curl -o /tmp/w.jpg http://172.31.0.84:19999/api/vision/wrist_camera/snapshot
```

## V0.5 功能清单

- IndustrialNext 白底毛玻璃 UI
- 可拖拽/八向缩放 Widget 组件系统
- xArm7 机械臂控制卡片 + ArmBridge
- 全量日志系统（VerboseLogger，默认关闭）
- 相机仿真回退（仅 `use_sim_cameras=true` 时；Release 默认关闭）

## 开启真实机械臂运动

```bash
export ARM_REAL_MOTION=1   # 需安全确认后
```
