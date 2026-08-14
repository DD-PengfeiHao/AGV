# Basler Pylon SDK 8.0.0 — AGV Docker vendor

Jason Camera Smoke Test **requires** official Pylon **8.0.0** for Linux x86_64 (Ubuntu 22.04 / Docker).

## Manual download (required as of 2026-08-13)

Jason's old direct URL returns **HTTP 404**. Basler CDN direct links also return **404**.
Downloads from Basler portal require **Basler ID** login and license acceptance.

### Official portal

1. Open: https://www.baslerweb.com/en/downloads/software-downloads/
2. Filter: **Operating system = Linux x86 (64-bit)**, **Software = pylon**
3. Search for: **pylon 8.0.0** (not 8.0.1 / 8.0.2 / 26.xx unless compatibility review approved)
4. Log in with **Basler ID** if prompted
5. Accept license terms
6. Download **one** of these official formats:
   - **Preferred (Jason Dockerfile convention):** `pylon-8.0.0-linux-x86_64_debs.tar.gz`
   - **Also supported:** `pylon-8.0.0-linux-x86_64_setup.tar.gz`
   - **Or:** any official `pylon-8.0.0*debs*.tar.gz` / `pylon-8.0.0*setup*.tar.gz` — **keep original filename**

### Release notes (verify version)

https://docs.baslerweb.com/pylon-software-suite-release-notes → **pylon Software Suite 8.0.0**

### Place file here

```
workspace_v02/docker/vendor/pylon/<official-filename>.tar.gz
```

Sync to runtime tree:

```bash
cp workspace_v02/docker/vendor/pylon/* \
  .run/workspace_v02/docker/vendor/pylon/
```

### Rebuild AGV Docker

```bash
cd .run/workspace_v02
docker compose -f docker/docker-compose.yml --profile sim-soft build
docker compose -f docker/docker-compose.yml --profile sim-soft up -d --force-recreate
```

### Verify inside container

```bash
docker exec -it delivery_gazebo_soft bash
test -f /opt/pylon/lib64/libpylon.so && echo OK
ros2 pkg list | grep pylon
```

Do **not** use third-party mirrors or unknown GitHub attachments.
