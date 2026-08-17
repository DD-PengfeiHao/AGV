#!/bin/bash
set -eu
C="delivery_gazebo_soft"

echo "=== stations file (maps_rw) ==="
docker exec "$C" ls -la /opt/delivery_ws/maps_rw/stations_from_smap.json 2>&1 || true

echo "=== stations file (data default) ==="
docker exec "$C" ls -la /data/agv_downloaded/maps/stations_from_smap.json 2>&1 || true

echo "=== devices yaml ==="
docker exec "$C" ls -la /opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml 2>&1 || true

echo "=== log dir ==="
docker exec "$C" ls -lad /var/log/delivery 2>&1 || true

echo "=== dashboard processes ==="
docker exec "$C" pgrep -af dashboard_node 2>&1 || echo "none"

echo "=== listening ports ==="
ss -tlnp 2>/dev/null | grep 19999 || echo "no 19999"
ss -tlnp 2>/dev/null | grep ':1999 ' || echo "no 1999"

echo "=== try python load stations ==="
docker exec "$C" bash -lc '
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
python3 <<PY
import json
from pathlib import Path
for p in [
    "/opt/delivery_ws/maps_rw/stations_from_smap.json",
    "/data/agv_downloaded/maps/stations_from_smap.json",
]:
    path = Path(p)
    print(p, "exists=", path.is_file())
    if path.is_file():
        data = json.loads(path.read_text(encoding="utf-8"))
        print("  keys=", list(data.keys())[:5], "count=", len(data) if isinstance(data, dict) else type(data))
PY
'

echo "=== try DeviceConfig load ==="
docker exec "$C" bash -lc '
export DELIVERY_DEVICES_YAML=/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
python3 -c "from delivery_web.device_config import DeviceConfig; c=DeviceConfig.load(); print(\"ok\", c.agv_host, c.xarm_default_mode)"
'
