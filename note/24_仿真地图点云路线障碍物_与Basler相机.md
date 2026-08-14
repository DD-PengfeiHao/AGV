# 24 仿真地图 / 点云 / 路线 / 障碍物 · 与 Basler 相机

> 2026-08-07 · 资料根目录：`/home/ubuntu/Pengfei.Hao/note/`

---

## 1. 相机（纠正）

`note/camera.jpg` 写明栈为：

| 组件 | 型号/版本 |
|------|-----------|
| 边缘主机 | Jetson Xavier NX |
| 工业相机 | **Basler acA2440-20gm（GigE）** |
| 采集 | **Aravis 0.6** |
| 推理 | TensorRT 8.4.1.5 / CUDA 11.4 |

**不是 Intel RealSense。**  
开发环境：`xavier_cam_front_bridge` 拉 `http://192.168.0.225:8080/stream`（Xavier 上 `basler_live_demo` / `_agv_dev_stream.py`，优先 Basler `192.168.0.100`）。

---

## 2. 仿真资产（`note/agv_downloaded`）

| 目录 | 内容 |
|------|------|
| `maps/*.smap` | 站点 `advancedPointList`、路线 `advancedCurveList`、点云 `normalPosList` |
| `maps/*.rawmap` | Robokit 原始点云/建图数据 |
| `models/` | `robot.model` `action.model` `safe.model` 等 |
| `params/` | `robot.param` `personalized.param` |

已同步到运行挂载：`/data/agv_downloaded`（`.run/agv_downloaded`）。

默认地图：`20260723112931750.smap`（LM1–LM7/LM10 + 16 条路线 + 2.4 万点云）。

参考：`note/AGV智能送货机器人API`（导航/激光/障碍查询等 TCP API）、`note/Roboshop使用手册`（地图编辑、视觉、调度）。

---

## 3. 开发环境可做的仿真操作

Web「地图/轨迹」Tab（强刷 `:19999`）：

- 显示 smap **点云** + **预设路线** + 激光
- **点击地图**放置障碍物（挡导航直线）
- 选图加载其它 `.smap`
- 输入站点序列设置/执行路线，如 `LM1,LM2,LM3,LM4`

HTTP：

```bash
GET  /api/sim/maps
POST /api/sim/map          {"smap":"20260723112931750.smap"}
POST /api/sim/obstacles    {"x":8.2,"y":-0.66,"w":1,"h":1}
POST /api/sim/obstacles    {"action":"clear"}
POST /api/sim/route        {"stations":["LM1","LM2","LM3"],"run":true}
```

激光源（dev）：`smap_cloud+obstacles`（由地图点云 + 仿真障碍射线）。

---

## 4. 真机 Basler 出图条件

1. Basler 供电 + 网线接到 Xavier（`eth1` 当前常为 NO-CARRIER）
2. 相机 IP `192.168.0.100` 与 Xavier 同网段
3. Xavier：`python3 basler_live_demo.py` 或 `_agv_dev_stream.py`
4. NUC Web 相机2 `transport=xavier_mjpeg`，分辨率应接近实机缩放后 640×480
