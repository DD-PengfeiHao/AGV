#!/usr/bin/env bash
# V0.52.4 BlackBox-only NUC verification (NO navigate/arm/unlock)
set -eu
C="delivery_gazebo_soft"
BASE="http://127.0.0.1:19999"
USER="${BB_USER:-ubuntu}"
PASS="${BB_PASS:-ubuntu}"
WARM_SEC="${BB_WARM_SEC:-25}"

fail() { echo "VERIFY_FAIL: $*"; exit 1; }
ok() { echo "VERIFY_OK: $*"; }

echo "========== VERSION =========="
VER=$(docker exec "$C" bash -lc "curl -sf -m 5 $BASE/api/version") || fail "version endpoint"
echo "$VER" | grep -q '0.52.4' || fail "expected version 0.52.4: $VER"
ok "version 0.52.4"

echo "========== LOGIN =========="
LOGIN=$(docker exec "$C" bash -lc "curl -sf -m 8 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{\"username\":\"$USER\",\"password\":\"$PASS\"}'") || fail "login"
echo "$LOGIN" | grep -q '"success": true' || fail "login failed: $LOGIN"
TOKEN=$(echo "$LOGIN" | sed -n 's/.*"token": *"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || fail "no token"
ok "auth token"

echo "========== BLACKBOX STATUS (pre-warm) =========="
ST0=$(docker exec "$C" bash -lc "curl -sf -m 5 $BASE/api/blackbox/status -H 'Authorization: Bearer $TOKEN'") || fail "blackbox status"
echo "$ST0" | grep -q '"available": true' || fail "blackbox unavailable: $ST0"
ok "blackbox available"

echo "========== WARM BUFFER ${WARM_SEC}s =========="
sleep "$WARM_SEC"
ST1=$(docker exec "$C" bash -lc "curl -sf -m 5 $BASE/api/blackbox/status -H 'Authorization: Bearer $TOKEN'")
echo "$ST1" | head -c 400
echo
# camera retention_ok may be false if no camera frames — state buffer should have data
echo "$ST1" | grep -q '"state"' || fail "buffer_health missing"

echo "========== TRIGGER (API, not motion) =========="
TR=$(docker exec "$C" bash -lc "curl -sf -m 8 -X POST $BASE/api/blackbox/trigger -H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json' -d '{\"source\":\"nuc_verify\",\"key\":\"API\"}'") || fail "trigger"
echo "$TR"
echo "$TR" | grep -q '"success": true' || fail "trigger not success"
RID=$(echo "$TR" | sed -n 's/.*"record_id": *"\([^"]*\)".*/\1/p')
[ -n "$RID" ] || fail "no record_id"
ok "triggered $RID"

echo "========== WAIT CAPTURE (~25s) =========="
for i in $(seq 1 35); do
  sleep 1
  ST=$(docker exec "$C" bash -lc "curl -sf -m 5 $BASE/api/blackbox/status -H 'Authorization: Bearer $TOKEN'")
  echo "$ST" | grep -q '"state": "COMPLETE"' && break
  echo "$ST" | grep -q '"state": "FAILED"' && fail "capture failed: $ST"
done
ST=$(docker exec "$C" bash -lc "curl -sf -m 5 $BASE/api/blackbox/status -H 'Authorization: Bearer $TOKEN'")
echo "$ST" | grep -q '"state": "COMPLETE"' || fail "not COMPLETE: $ST"
ok "capture COMPLETE"

echo "========== MANIFEST ON DISK =========="
MANIFEST="/home/ubuntu/Pengfei.Hao/blackbox/${RID:0:8}/$RID/manifest.json"
docker exec "$C" bash -lc "test -f $MANIFEST" || fail "manifest missing: $MANIFEST"
docker exec "$C" bash -lc "python3 -c \"import json; m=json.load(open('$MANIFEST')); assert m.get('record_id')=='$RID'; assert m.get('duration_sec',0)>=40; print('manifest ok', m.get('sources'))\""
ok "manifest $MANIFEST"

echo "========== PRE/POST WINDOW FILES =========="
docker exec "$C" bash -lc "test -f /home/ubuntu/Pengfei.Hao/blackbox/${RID:0:8}/$RID/snapshot/state.json"
docker exec "$C" bash -lc "test -f /home/ubuntu/Pengfei.Hao/blackbox/${RID:0:8}/$RID/state/agv.jsonl"
docker exec "$C" bash -lc "wc -l /home/ubuntu/Pengfei.Hao/blackbox/${RID:0:8}/$RID/state/agv.jsonl"
ok "state jsonl present"

echo "========== BLACKBOX-ONLY PASS =========="
echo "Record: $RID"
echo "Skipped: navigate, arm, unlock, grasp"
