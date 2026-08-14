#!/usr/bin/env python3
"""Patch dashboard_node.py for Jason camera web integration."""

from pathlib import Path

TARGET = Path(__file__).resolve().parent / "delivery_web" / "dashboard_node.py"

IMPORT_SNIPPET = "from delivery_web.jason_camera_web import JasonCameraWebBridge\n"

INIT_SNIPPET = """
        self._jason_web = JasonCameraWebBridge(
            self,
            self._lock,
            _rgb8_to_jpeg,
            self.get_logger().info,
        )
"""

GET_SNIPPETS = [
    (
        '                if path in ("/", "/index.html"):',
        '                if path in ("/camera.html", "/camera"):\n'
        '                    cam_html = node._www_demo / "camera.html"\n'
        '                    if cam_html.is_file():\n'
        '                        self._send(200, cam_html.read_bytes(), "text/html; charset=utf-8")\n'
        '                        return\n'
        '                if path == "/api/jason/camera/status":\n'
        '                    self._json(200, node._jason_web.status())\n'
        '                    return\n'
        '                if path == "/api/jason/camera/snapshot":\n'
        '                    st = node._jason_web.status()\n'
        '                    jpg = node._jason_web.latest_jpeg()\n'
        '                    if not jpg or st.get("status") == "OFFLINE":\n'
        '                        self._json(404, {"error": "no frame", "status": st})\n'
        '                        return\n'
        '                    self._send(200, jpg, _image_ctype(jpg))\n'
        '                    return\n'
        '                if path == "/api/jason/camera/stream":\n'
        '                    self._jason_mjpeg()\n'
        '                    return\n'
        '                if path in ("/", "/index.html"):',
    ),
]

MJPEG_SNIPPET = """
            def _jason_mjpeg(self) -> None:
                self.send_response(200)
                self.send_header(
                    "Content-Type", "multipart/x-mixed-replace; boundary=frame"
                )
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                try:
                    while True:
                        st = node._jason_web.status()
                        jpg = node._jason_web.latest_jpeg()
                        if jpg and st.get("status") == "ONLINE":
                            ctype = _image_ctype(jpg)
                            self.wfile.write(b"--frame\\r\\n")
                            self.wfile.write(f"Content-Type: {ctype}\\r\\n".encode())
                            self.wfile.write(
                                f"Content-Length: {len(jpg)}\\r\\n\\r\\n".encode()
                            )
                            self.wfile.write(jpg)
                            self.wfile.write(b"\\r\\n")
                        time.sleep(0.35)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                    return

"""

POST_SNIPPET = (
    '                if path == "/api/detect_qr":',
    '                if path == "/api/jason/qr/start":\n'
    '                    self._json(200, node._jason_web.start_qr())\n'
    '                    return\n'
    '                if path == "/api/jason/qr/stop":\n'
    '                    self._json(200, node._jason_web.stop_qr())\n'
    '                    return\n'
    '                if path == "/api/detect_qr":',
)


def main() -> None:
    text = TARGET.read_text(encoding="utf-8")
    if "JasonCameraWebBridge" in text:
        print("already patched")
        return

    if "from delivery_web.system_logger import" in text:
        text = text.replace(
            "from delivery_web.system_logger import SystemJsonlLogger, load_env_file, save_env_file\n",
            "from delivery_web.system_logger import SystemJsonlLogger, load_env_file, save_env_file\n"
            + IMPORT_SNIPPET,
        )
    else:
        raise SystemExit("import anchor missing")

    anchor = "        self.create_timer(2.0, self._camera_diag_tick)\n"
    if anchor not in text:
        raise SystemExit("init anchor missing")
    text = text.replace(anchor, anchor + INIT_SNIPPET)

    old, new = GET_SNIPPETS[0]
    if old not in text:
        raise SystemExit("GET anchor missing")
    text = text.replace(old, new)

    mjpeg_anchor = "            def do_POST(self) -> None:  # noqa: N802\n"
    if "_jason_mjpeg" not in text:
        text = text.replace(mjpeg_anchor, MJPEG_SNIPPET + mjpeg_anchor)

    old, new = POST_SNIPPET
    if old not in text:
        raise SystemExit("POST anchor missing")
    text = text.replace(old, new)

    TARGET.write_text(text, encoding="utf-8", newline="\n")
    print("patched", TARGET)


if __name__ == "__main__":
    main()
