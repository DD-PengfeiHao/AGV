#!/bin/bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"mode":"demo","agv_host":"192.168.18.198"}' \
  http://127.0.0.1:19999/api/env
echo
sleep 8
curl -s http://127.0.0.1:19999/api/state | tr ',' '\n' | grep -E 'source|laser|agv_host|beam_count|"ok"' | head -15
curl -s -X POST -H 'Content-Type: application/json' -d '{"mode":"dev"}' http://127.0.0.1:19999/api/env
echo
