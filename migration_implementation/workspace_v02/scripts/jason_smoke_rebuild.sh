#!/usr/bin/env bash
# Rebuild AGV Docker after placing official Pylon 8.0.0 package in docker/vendor/pylon/
set -euo pipefail
PKG_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$PKG_ROOT/docker/vendor/pylon"
RUN="$PKG_ROOT/../.run/workspace_v02"

echo "[jason-smoke] Checking Pylon vendor..."
if ! find "$VENDOR" -maxdepth 1 -type f \( -name 'pylon-8.0.0*debs*.tar.gz' -o -name 'pylon-8.0.0*setup*.tar.gz' \) | grep -q .; then
  echo "ERROR: No official Pylon 8.0.0 tar.gz in $VENDOR" >&2
  echo "See docker/vendor/pylon/README.md" >&2
  exit 1
fi

mkdir -p "$RUN/docker/vendor/pylon"
cp -a "$VENDOR"/* "$RUN/docker/vendor/pylon/"
cp -a "$PKG_ROOT/docker/Dockerfile.lite" "$RUN/docker/Dockerfile.lite"

echo "[jason-smoke] DNS precheck..."
getent hosts packages.ros.org
getent hosts mirrors.aliyun.com

cd "$RUN"
echo "[jason-smoke] docker compose build..."
docker compose -f docker/docker-compose.yml --profile sim-soft build
echo "[jason-smoke] recreate container..."
docker compose -f docker/docker-compose.yml --profile sim-soft up -d --force-recreate
echo "[jason-smoke] done. Verify: docker exec delivery_gazebo_soft test -f /opt/pylon/lib/libpylonbase.so.9"
