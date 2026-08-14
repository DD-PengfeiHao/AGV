#!/bin/bash
set -e
BASE=http://127.0.0.1:19999
echo "=== version ==="
curl -s "$BASE/api/version"
echo
echo "=== switch mock ==="
curl -s -X POST -H "Content-Type: application/json" -d '{"mode":"mock"}' "$BASE/api/env"
echo
echo "=== floor qr trigger ==="
curl -s -X POST "$BASE/api/vision/floor_qr/trigger"
echo
echo "=== wrist qr trigger ==="
curl -s -X POST "$BASE/api/vision/wrist_camera/trigger/qr"
echo
echo "=== wrist apriltag trigger ==="
curl -s -X POST "$BASE/api/vision/wrist_camera/trigger/apriltag"
echo
echo "=== leo trigger ==="
curl -s -X POST "$BASE/api/vision/leo_face/trigger"
echo
echo "=== arm move joint ==="
curl -s -X POST -H "Content-Type: application/json" -d '{"kind":"move_joint","joint_index":0,"delta_deg":10}' "$BASE/api/arm/command"
echo
echo "=== arm status joints ==="
curl -s "$BASE/api/arm/status" | python3 -c "import sys,json;d=json.load(sys.stdin);print('J1=',d['joints']['positions_deg'][0],'motion=',d.get('motion'),'online=',d.get('online'))"
echo "=== state arm in snapshot ==="
curl -s "$BASE/api/state" | python3 -c "import sys,json;d=json.load(sys.stdin);a=d.get('arm',{});print('arm online',a.get('online'),'mode',a.get('mode'))"
echo "=== page title ==="
curl -s "$BASE/" | grep -o 'AGV Console v[0-9.]*' | head -1
