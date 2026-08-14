# AGV Web V0.5.0 Release Notes

**Release date:** 2026-08-14  
**Release target:** NUC `172.31.0.84` (ubuntu, Docker `delivery_gazebo_soft` + `xarm7_real`)  
**Alpha target:** VM `172.31.0.111` (开发迭代)

## 版本划分

| 渠道 | 主机 | 用途 |
|------|------|------|
| **Release** | NUC 84 | 现场运行，与 Zack xArm 同机 |
| **Alpha** | VM 111 | UI/功能开发、Mock 验收 |

## V0.5.0 新特性

1. **IndustrialNext UI** — 白底毛玻璃、品牌色、可缩放 Widget
2. **组件系统** — 10 个可拖拽悬浮组件，localStorage 布局持久化
3. **xArm7 集成** — ArmBridge + 机械臂控制卡片 + HTTP API
4. **全量日志** — 9 模块 VerboseLogger（默认关闭）
5. **相机回退** — Alpha 环境 `use_sim_cameras` 时自动 Gazebo/Mock 回退

## NUC Release 配置要点

- `ROS_DOMAIN_ID=30`（与 xarm7_real 一致）
- `devices.nuc.release.yaml`：本机 `127.0.0.1` 相机/机械臂
- `ARM_MODE=real`，`ARM_REAL_MOTION=0`（默认安全）
- `use_sim_cameras=false`（真实相机，不走仿真回退）

## 部署

```bash
bash scripts/deploy_v05_release_nuc.sh
```

## 验证清单

- [ ] `GET /api/version` → `0.5.0`
- [ ] `GET /api/vision/wrist_camera/snapshot` → HTTP 200 + JPEG
- [ ] `GET /api/arm/status` → 在线/关节数据
- [ ] Web UI 显示 IndustrialNext Logo + Widget 面板
- [ ] xarm7_real 容器运行中，`ros2 topic echo /pick_place_state` 有数据
