#!/bin/bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"mode":"demo","agv_host":"192.168.18.198"}' \
  http://127.0.0.1:19999/api/env
echo
sleep 6
curl -s -m 8 http://127.0.0.1:19999/api/state > /tmp/demo_state.json
grep -o '"source":"[^"]*"' /tmp/demo_state.json | head -1
grep -o '"mode":"[^"]*"' /tmp/demo_state.json | head -3
grep -o '"beam_count":[0-9]*' /tmp/demo_state.json | head -1
grep -o '"agv_host":"[^"]*"' /tmp/demo_state.json | head -1
curl -s -X POST -H 'Content-Type: application/json' -d '{"mode":"dev"}' http://127.0.0.1:19999/api/env
echo
