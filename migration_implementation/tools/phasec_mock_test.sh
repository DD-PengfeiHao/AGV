#!/bin/bash
set -e
echo "=== Phase C mock validation ==="
curl -s -X POST -H 'Content-Type: application/json' -d '{"mode":"mock","agv_host":"127.0.0.1"}' http://127.0.0.1:19999/api/env
echo
curl -s -X POST -H 'Content-Type: application/json' -d '{"device":"floor_qr_scanner","online":true,"qr_id":"floor_qr_001"}' http://127.0.0.1:19999/api/mock/vision
echo
curl -s -X POST -H 'Content-Type: application/json' -d '{"device":"wrist_camera","online":true,"detected_type":"AprilTag","detected_id":"TAG-12"}' http://127.0.0.1:19999/api/mock/vision
echo
sleep 2
curl -s -o /dev/null -w "state:%{http_code}\n" http://127.0.0.1:19999/api/state
curl -s http://127.0.0.1:19999/api/state | tr ',' '\n' | grep -E 'floor_qr|wrist_camera|leo_face|localization_ok|beam_count' | head -20
curl -s -X POST -H 'Content-Type: application/json' -d '{"mode":"dev"}' http://127.0.0.1:19999/api/env
echo
