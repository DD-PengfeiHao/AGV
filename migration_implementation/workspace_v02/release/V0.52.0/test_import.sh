#!/bin/bash
source /opt/ros/humble/setup.bash
source /opt/delivery_ws/install/setup.bash
python3 <<'PY'
import traceback
try:
    import delivery_web.dashboard_node as d
    print("VERSION", d.VERSION)
except Exception:
    traceback.print_exc()
PY
