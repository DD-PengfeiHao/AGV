import socket
try:
    s = socket.socket()
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", 19999))
    print("bind_ok")
    s.close()
except OSError as e:
    print("bind_fail", e)
