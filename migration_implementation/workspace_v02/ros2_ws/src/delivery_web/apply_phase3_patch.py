#!/usr/bin/env python3
"""Apply Phase 3 patches to dashboard_node.py."""
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "delivery_web" / "dashboard_node.py"


def patch(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


def main() -> None:
    text = TARGET.read_text(encoding="utf-8")

    text = patch(
        text,
        "import time\n",
        "import time\nimport uuid\n",
        "import uuid",
    )
    text = patch(
        text,
        "        self._t0 = time.time()\n        self._maps_dir",
        """        self._t0 = time.time()
        self._agv_last_seen = 0.0
        self._route_task: Dict[str, Any] = {
            "running": False,
            "task_id": "",
            "started_at": 0.0,
            "finished_at": 0.0,
            "current": "",
            "next": "",
            "queue": [],
            "completed": [],
            "index": 0,
            "results": [],
            "success": None,
            "message": "",
            "stations": [],
        }
        self._jason_web = None
        self._maps_dir""",
        "init vars",
    )
    text = patch(
        text,
        "        self.get_logger().info(\n            f\"Web DEMO  http://0.0.0.0:{demo_port}/  |  DEBUG http://0.0.0.0:{debug_port}/\"\n        )\n\n    def _tick_count",
        """        self.get_logger().info(
            f"Web DEMO  http://0.0.0.0:{demo_port}/  |  DEBUG http://0.0.0.0:{debug_port}/"
        )

    def _get_jason_web(self):
        if self._jason_web is None:
            from delivery_web.jason_camera_web import JasonCameraWebBridge

            self._jason_web = JasonCameraWebBridge(
                self, self._lock, _rgb8_to_jpeg, self.get_logger().info
            )
        return self._jason_web

    def _tick_count""",
        "jason lazy",
    )

    methods = '''
    def agv_link_status(self) -> Dict[str, Any]:
        now = time.time()
        with self._lock:
            last = self._agv_last_seen
        if last <= 0:
            return {"status": "OFFLINE", "last_seen_ms_ago": None}
        age_ms = int((now - last) * 1000)
        if now - last < 2.0:
            status = "ONLINE"
        elif now - last < 5.0:
            status = "WARNING"
        else:
            status = "OFFLINE"
        return {"status": status, "last_seen_ms_ago": age_ms}

    def list_stations_api(self) -> Dict[str, Any]:
        with self._lock:
            return {"success": True, "stations": dict(self._state.get("stations") or {})}

    def add_station(self, name: str, x: float, y: float, yaw: float = 0.0) -> Dict[str, Any]:
        name = str(name).strip()
        if not name:
            return {"success": False, "message": "name required"}
        path = Path(self.get_parameter("stations_file").value)
        with self._lock:
            stations = dict(self._state.get("stations") or {})
            if name in stations:
                return {"success": False, "message": f"station {name} already exists"}
            stations[name] = {"x": float(x), "y": float(y), "yaw": float(yaw)}
            self._state["stations"] = stations
            meta = dict(self._state.get("meta") or {})
        data = {
            "map_file": meta.get("map_file", ""),
            "map_name": meta.get("map_name", ""),
            "vehicle_model": meta.get("vehicle_model", "AMB-150"),
            "stations": stations,
        }
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as exc:
            return {"success": False, "message": f"save failed: {exc}"}
        return {"success": True, "station": stations[name], "stations": stations}

    def remove_station(self, name: str) -> Dict[str, Any]:
        name = str(name).strip()
        path = Path(self.get_parameter("stations_file").value)
        with self._lock:
            stations = dict(self._state.get("stations") or {})
            if name not in stations:
                return {"success": False, "message": f"station {name} not found"}
            stations.pop(name)
            self._state["stations"] = stations
            meta = dict(self._state.get("meta") or {})
        data = {
            "map_file": meta.get("map_file", ""),
            "map_name": meta.get("map_name", ""),
            "vehicle_model": meta.get("vehicle_model", "AMB-150"),
            "stations": stations,
        }
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"success": True, "stations": stations}

    def get_route_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "success": True,
                "route": dict(self._state.get("route") or {}),
                "route_task": dict(self._route_task),
            }

    def start_route_async(self, wait: bool = True) -> Dict[str, Any]:
        with self._lock:
            if self._route_task.get("running"):
                return {"success": False, "message": "route already running"}
            names = list((self._state.get("route") or {}).get("stations") or [])
            if not names:
                return {"success": False, "message": "route empty"}
            task_id = uuid.uuid4().hex[:12]
            self._state["route"] = {**(self._state.get("route") or {}), "active": True, "index": 0}
            self._route_task = {
                "running": True, "task_id": task_id, "started_at": time.time(),
                "finished_at": 0.0, "current": names[0],
                "next": names[1] if len(names) > 1 else "",
                "queue": names[2:], "completed": [], "index": 0,
                "results": [], "success": None, "message": "started", "stations": names,
            }

        def _worker() -> None:
            results = []
            for i, st in enumerate(names):
                with self._lock:
                    self._state["route"]["index"] = i
                    self._route_task.update({
                        "index": i, "current": st,
                        "next": names[i + 1] if i + 1 < len(names) else "",
                        "queue": names[i + 2:],
                    })
                out = self.navigate(st, wait=wait)
                results.append({"station": st, **out})
                with self._lock:
                    self._route_task["results"] = list(results)
                if not out.get("success"):
                    with self._lock:
                        self._route_task.update({
                            "running": False, "finished_at": time.time(),
                            "success": False, "message": f"stopped at {st}",
                        })
                        self._state["route"]["active"] = False
                    return
                with self._lock:
                    self._route_task["completed"] = list(self._route_task["completed"]) + [st]
            with self._lock:
                self._state["route"]["active"] = False
                self._route_task.update({
                    "running": False, "finished_at": time.time(), "success": True,
                    "message": "route complete", "current": "", "next": "", "queue": [],
                })

        threading.Thread(target=_worker, daemon=True).start()
        return {"success": True, "message": "route started", "task_id": task_id}

'''
    text = patch(
        text,
        "        return {\"success\": True, \"message\": \"route done\", \"results\": results}\n\n    def _on_agv",
        "        return {\"success\": True, \"message\": \"route done\", \"results\": results}\n" + methods + "\n    def _on_agv",
        "route methods",
    )
    text = patch(
        text,
        "    def _on_agv(self, msg: AgvStatus) -> None:\n        self._tick_count",
        "    def _on_agv(self, msg: AgvStatus) -> None:\n        self._agv_last_seen = time.time()\n        self._tick_count",
        "agv last seen",
    )
    text = patch(
        text,
        '            out["web_face_api"] = WEB_FACE_API\n            return out',
        '''            out["web_face_api"] = WEB_FACE_API
            out["agv_link"] = self.agv_link_status()
            out["route_task"] = dict(self._route_task)
            laser = out.get("laser") or {}
            src = str(laser.get("source") or "")
            laser["label"] = "SIMULATED LASER" if src in ("smap_cloud+obstacles", "sim_stub") else (
                "REAL LIDAR" if src == "robokit_1009" else "NO LIVE LIDAR"
            )
            laser["live_lidar"] = src == "robokit_1009"
            out["laser"] = laser
            return out''',
        "snapshot",
    )
    text = patch(
        text,
        '                "message": "sim from agv_downloaded smap",',
        '                "message": "NO LIVE LIDAR — simulated from smap + obstacles",',
        "laser msg",
    )

    # Jason + API GET routes
    text = patch(
        text,
        '                if path in ("/", "/index.html"):',
        '''                if path in ("/camera.html", "/camera"):
                    cam_html = node._www_demo / "camera.html"
                    if cam_html.is_file():
                        self._send(200, cam_html.read_bytes(), "text/html; charset=utf-8")
                        return
                if path == "/api/jason/camera/status":
                    self._json(200, node._get_jason_web().status())
                    return
                if path in ("/api/jason/status",):
                    self._json(200, node._get_jason_web().status())
                    return
                if path == "/api/jason/camera/snapshot":
                    jpg = node._get_jason_web().latest_jpeg()
                    if not jpg:
                        self._json(404, {"error": "no frame"})
                        return
                    self._send(200, jpg, _image_ctype(jpg))
                    return
                if path == "/api/jason/camera/stream":
                    self._jason_mjpeg()
                    return
                if path in ("/", "/index.html"):''',
        "jason get",
    )
    text = patch(
        text,
        '                if path == "/api/state":\n                    self._json(200, node.snapshot())\n                    return',
        '''                if path == "/api/state":
                    self._json(200, node.snapshot())
                    return
                if path == "/api/status":
                    st = node.snapshot()
                    self._json(200, {"success": True, "agv_link": st.get("agv_link"), "agv": st.get("agv"),
                                   "route_task": st.get("route_task"), "stations": st.get("stations")})
                    return
                if path == "/api/maps":
                    self._json(200, node.list_maps())
                    return
                if path == "/api/stations":
                    self._json(200, node.list_stations_api())
                    return
                if path == "/api/route/status":
                    self._json(200, node.get_route_status())
                    return''',
        "api get",
    )

    mjpeg = '''
            def _jason_mjpeg(self) -> None:
                self.send_response(200)
                self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                try:
                    while True:
                        jpg = node._get_jason_web().latest_jpeg()
                        if jpg:
                            ctype = _image_ctype(jpg)
                            self.wfile.write(b"--frame\\r\\n")
                            self.wfile.write(f"Content-Type: {ctype}\\r\\n".encode())
                            self.wfile.write(f"Content-Length: {len(jpg)}\\r\\n\\r\\n".encode())
                            self.wfile.write(jpg)
                            self.wfile.write(b"\\r\\n")
                        time.sleep(0.35)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    return

'''
    text = patch(
        text,
        "            def do_POST(self) -> None:  # noqa: N802\n",
        mjpeg + "            def do_POST(self) -> None:  # noqa: N802\n",
        "mjpeg",
    )

    text = patch(
        text,
        '                if path == "/api/detect_qr":',
        '''                if path == "/api/jason/qr/start":
                    self._json(200, node._get_jason_web().start_qr())
                    return
                if path == "/api/jason/qr/stop":
                    self._json(200, node._get_jason_web().stop_qr())
                    return
                if path == "/api/stations":
                    name = str(payload.get("name") or "").strip()
                    if not name:
                        self._json(400, {"success": False, "message": "name required"})
                        return
                    if str(payload.get("action") or "add") in ("remove", "delete"):
                        self._json(200, node.remove_station(name))
                        return
                    self._json(200, node.add_station(name, float(payload.get("x", 0)),
                                                      float(payload.get("y", 0)),
                                                      float(payload.get("yaw", 0) or 0)))
                    return
                if path == "/api/detect_qr":''',
        "post extras",
    )
    text = patch(
        text,
        '''                if path == "/api/sim/route":
                    stations = payload.get("stations") or []
                    if not isinstance(stations, list):
                        self._json(400, {"success": False, "message": "stations list required"})
                        return
                    out = node.set_route([str(s) for s in stations])
                    if out.get("success") and bool(payload.get("run")):
                        out = node.run_route(wait=bool(payload.get("wait", True)))
                    self._json(200, out)
                    return
                if path == "/api/sim/route/run":
                    self._json(200, node.run_route(wait=bool(payload.get("wait", True))))
                    return''',
        '''                if path in ("/api/route", "/api/sim/route"):
                    stations = payload.get("stations") or []
                    if not isinstance(stations, list):
                        self._json(400, {"success": False, "message": "stations list required"})
                        return
                    out = node.set_route([str(s) for s in stations])
                    if out.get("success") and bool(payload.get("run")):
                        if bool(payload.get("async", True)):
                            out = node.start_route_async(wait=bool(payload.get("wait", True)))
                        else:
                            out = node.run_route(wait=bool(payload.get("wait", True)))
                    self._json(200, out)
                    return
                if path in ("/api/route/start", "/api/sim/route/run"):
                    if bool(payload.get("async", True)):
                        self._json(200, node.start_route_async(wait=bool(payload.get("wait", True))))
                    else:
                        self._json(200, node.run_route(wait=bool(payload.get("wait", True))))
                    return''',
        "async route",
    )

    TARGET.write_text(text, encoding="utf-8", newline="\n")
    print("patched ok", TARGET)


if __name__ == "__main__":
    main()
