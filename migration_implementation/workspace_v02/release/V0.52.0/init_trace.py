#!/usr/bin/env python3
"""Trace dashboard __init__ vs HTTP bind on NUC."""
import socket
import threading
import time

import rclpy
from rclpy.executors import MultiThreadedExecutor

def port_open(port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        s.connect(("127.0.0.1", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def poll_ports(stop: threading.Event) -> None:
    for i in range(90):
        if stop.is_set():
            return
        print(
            f"t={i}s init_done={getattr(poll_ports, 'init_done', False)} "
            f"19999={port_open(19999)} 1999={port_open(1999)}",
            flush=True,
        )
        time.sleep(1)


def main() -> None:
    import os

    os.environ.setdefault("ROS_DOMAIN_ID", "30")
    os.environ.setdefault("RMW_IMPLEMENTATION", "rmw_fastrtps_cpp")
    os.environ.setdefault("ARM_MODE", "real")
    os.environ.setdefault("ARM_REAL_MOTION", "1")
    os.environ.setdefault(
        "DELIVERY_DEVICES_YAML",
        "/opt/delivery_ws/src/delivery_web/config/devices.nuc.release.yaml",
    )
    os.environ.setdefault("MAPS_RW_DIR", "/opt/delivery_ws/maps_rw")

    rclpy.init()
    stop = threading.Event()
    threading.Thread(target=poll_ports, args=(stop,), daemon=True).start()

    print("creating DashboardNode...", flush=True)
    from delivery_web.dashboard_node import DashboardNode

    node = DashboardNode()
    poll_ports.init_done = True
    print("INIT DONE — starting spin", flush=True)

    executor = MultiThreadedExecutor(num_threads=8)
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        executor.shutdown()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
