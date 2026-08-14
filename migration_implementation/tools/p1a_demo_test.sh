#!/bin/bash
set -e
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"mode":"demo","agv_host":"192.168.18.198"}' \
  http://127.0.0.1:19999/api/env
echo
sleep 4
curl -s -m 8 http://127.0.0.1:19999/api/state | head -c 900
echo
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"mode":"dev"}' \
  http://127.0.0.1:19999/api/env
echo
