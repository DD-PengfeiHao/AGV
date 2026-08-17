"""Arm manager — mock simulation + real xArm7 via ArmBridge."""

from __future__ import annotations

import os
import threading
from typing import Any, Callable, Dict, Optional

from rclpy.node import Node

from agv_bridge.arm.factory import create_arm_adapter
from agv_bridge.arm.models import ArmCommand, ArmMode
from agv_bridge.arm_bridge import ArmBridge


class ArmManager:
    def __init__(
        self,
        node: Node,
        get_env_mode: Callable[[], str],
        robot_ip: str = "172.31.0.123",
        default_arm_mode: str = "simulation",
        allow_real_motion: bool = False,
        service_unlock: str = "/unlock_and_home",
        service_pick_place: str = "/do_pick_place",
        service_gripper: str = "/set_gripper",
        ros_state_topic: str = "/pick_place_state",
        ros_joint_topic: str = "/joint_states",
        ros_domain_id: int = 30,
        get_agv_busy: Optional[Callable[[], bool]] = None,
    ) -> None:
        self._node = node
        self._get_env_mode = get_env_mode
        self._get_agv_busy = get_agv_busy or (lambda: False)
        self._robot_ip = robot_ip
        self._ros_domain_id = int(ros_domain_id)
        self._lock = threading.Lock()

        env_mode = os.environ.get("ARM_MODE", "").strip().lower()
        self._arm_mode = env_mode or (default_arm_mode or "simulation").strip().lower()

        env_motion = os.environ.get("ARM_REAL_MOTION", "").strip()
        if env_motion:
            self._real_motion_enabled = env_motion == "1"
        else:
            self._real_motion_enabled = bool(allow_real_motion)

        self._bridge_cfg = {
            "service_unlock": service_unlock,
            "service_pick_place": service_pick_place,
            "service_gripper": service_gripper,
            "ros_state_topic": ros_state_topic,
            "ros_joint_topic": ros_joint_topic,
            "ros_domain_id": self._ros_domain_id,
        }
        self._adapter = None
        self._bridge: Optional[ArmBridge] = None
        self._op_lock = threading.Lock()
        self._op_running = False
        self._op_kind = ""
        self._op_result: Optional[Dict[str, Any]] = None
        self._refresh_adapter()

    def _ensure_bridge(self) -> ArmBridge:
        if self._bridge is None:
            self._bridge = ArmBridge(self._node, robot_ip=self._robot_ip, **self._bridge_cfg)
        return self._bridge

    def _operation_status(self) -> Dict[str, Any]:
        with self._op_lock:
            return {
                "op_running": self._op_running,
                "op_kind": self._op_kind,
                "last_op_result": dict(self._op_result) if self._op_result else None,
            }

    def _start_async(self, kind: str, fn, *args, **kwargs) -> Dict[str, Any]:
        with self._op_lock:
            if self._op_running:
                return {
                    "success": False,
                    "accepted": False,
                    "busy": True,
                    "message": f"机械臂正在执行 {self._op_kind}，请等待完成",
                    "op_kind": self._op_kind,
                }
            self._op_running = True
            self._op_kind = kind
            self._op_result = None

        def _worker() -> None:
            try:
                result = fn(*args, **kwargs)
            except Exception as exc:  # noqa: BLE001
                result = {"success": False, "message": str(exc)}
            with self._op_lock:
                self._op_result = result if isinstance(result, dict) else {"success": False, "message": str(result)}
                self._op_running = False
                self._op_kind = ""

        threading.Thread(target=_worker, daemon=True, name=f"arm-{kind}").start()
        labels = {"unlock": "解锁归位", "pick_place": "抓取", "gripper": "夹爪"}
        return {
            "success": True,
            "accepted": True,
            "async": True,
            "op_kind": kind,
            "message": f"{labels.get(kind, kind)} 已启动，请等待完成",
        }

    def _refresh_adapter(self) -> None:
        use_real = self._arm_mode in ("real", "hardware", "live")
        if use_real:
            self._ensure_bridge()
            self._adapter = create_arm_adapter(
                "real",
                node=self._node,
                robot_ip=self._robot_ip,
                real_motion_enabled=self._real_motion_enabled,
            )
        else:
            self._adapter = create_arm_adapter("simulation", robot_ip=self._robot_ip)

    def set_arm_mode(self, mode: str) -> Dict[str, Any]:
        with self._lock:
            self._arm_mode = (mode or "simulation").strip().lower()
            self._refresh_adapter()
        return self.status_meta()

    def set_real_motion(self, enabled: bool) -> Dict[str, Any]:
        with self._lock:
            self._real_motion_enabled = bool(enabled)
            self._refresh_adapter()
        return self.status_meta()

    def status_meta(self) -> Dict[str, Any]:
        return {
            "success": True,
            "arm_mode": self._arm_mode,
            "real_motion_enabled": self._real_motion_enabled,
        }

    def _is_real(self) -> bool:
        return self._arm_mode in ("real", "hardware", "live")

    def _normalize_mock_status(self, raw: Dict[str, Any]) -> Dict[str, Any]:
        motion = str(raw.get("motion", "OFFLINE")).upper()
        state = "idle"
        if not raw.get("online"):
            state = "offline"
        elif raw.get("busy") or motion == "MOVING":
            state = "running"
        elif motion == "ERROR":
            state = "error"
        joints = raw.get("joints") or {}
        grip = raw.get("gripper") or {}
        gs = str(grip.get("state", "unknown")).lower()
        if gs in ("open", "opened"):
            gripper_state = "open"
        elif gs in ("close", "closed"):
            gripper_state = "closed"
        else:
            gripper_state = "unknown"
        out = dict(raw)
        out.update({
            "state": state,
            "joints_deg": list(joints.get("positions_deg") or []),
            "gripper_state": gripper_state,
            "is_busy": bool(raw.get("busy")),
            "state_text": raw.get("last_text") or "mock idle",
            "current_block": None,
            "state_history": [],
        })
        return out

    def status(self) -> Dict[str, Any]:
        if self._is_real():
            st = self._ensure_bridge().get_status()
        else:
            with self._lock:
                assert self._adapter is not None
                st = self._normalize_mock_status(self._adapter.get_state().to_dict())
        st.update(self.status_meta())
        st.update(self._operation_status())
        if self._is_real() and not self._real_motion_enabled:
            st["motion_blocked"] = True
            st["motion_block_reason"] = "REAL motion disabled — enable via ARM_REAL_MOTION=1 or Web toggle"
        else:
            st["motion_blocked"] = False
            st["motion_block_reason"] = ""
        return st

    def pose(self) -> Dict[str, Any]:
        if self._is_real():
            return self._ensure_bridge().get_pose()
        with self._lock:
            assert self._adapter is not None
            s = self._adapter.get_state()
            return {
                "online": s.online,
                "joints_deg": list(s.joints.positions_deg),
                "joints_rad": [d * 3.14159265 / 180.0 for d in s.joints.positions_deg],
                "joint_names": list(s.joints.names),
            }

    def _motion_gate(self) -> Optional[Dict[str, Any]]:
        if not self._is_real():
            return None
        if not self._real_motion_enabled:
            return {
                "success": False,
                "message": "真实运动未启用 — 请在 Web 开启「允许真机运动」或设置 ARM_REAL_MOTION=1 后重启",
                "blocked": True,
                "motion_blocked": True,
            }
        if self._get_agv_busy():
            return {"success": False, "message": "AGV 正在导航中，请先停车", "blocked": True}
        return None

    def unlock(self) -> Dict[str, Any]:
        gate = self._motion_gate()
        if gate:
            return gate
        if self._is_real():
            return self._start_async("unlock", self._ensure_bridge().call_unlock)
        return {"success": True, "message": "mock unlock OK", "mock": True}

    def pick_place(self, cycles: int = 1) -> Dict[str, Any]:
        gate = self._motion_gate()
        if gate:
            return gate
        if self._is_real():
            return self._start_async("pick_place", self._ensure_bridge().call_pick_place, cycles=cycles)
        with self._lock:
            assert self._adapter is not None
        return {
            "success": True,
            "message": f"Mock pick_place x{cycles}",
            "mock": True,
            "duration_s": 0.1,
            "warning": "Simulation only",
        }

    def gripper_get(self) -> Dict[str, Any]:
        if self._is_real():
            st = self._ensure_bridge().get_status()
            return {"state": st.get("gripper_state", "unknown")}
        return {"state": "open", "mock": True}

    def gripper_set(self, open_cmd: bool) -> Dict[str, Any]:
        gate = self._motion_gate()
        if gate:
            return gate
        if self._is_real():
            return self._start_async(
                "gripper",
                self._ensure_bridge().call_gripper,
                open_cmd,
            )
        return {"success": True, "message": f"mock gripper {'open' if open_cmd else 'close'}", "mock": True}

    def set_cycles(self, cycles: int) -> Dict[str, Any]:
        if self._is_real():
            return self._ensure_bridge().set_cycles(cycles)
        return {"success": True, "cycles": cycles, "mock": True}

    def stop(self) -> Dict[str, Any]:
        if self._is_real():
            return self._ensure_bridge().call_stop()
        with self._lock:
            assert self._adapter is not None
            return self._adapter.stop()

    def command(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        cmd = ArmCommand.from_dict(payload)
        with self._lock:
            assert self._adapter is not None
            kind = cmd.kind.lower()
            if kind == "move_joint":
                return self._adapter.move_joint(cmd)
            if kind == "move_tcp":
                return self._adapter.move_tcp(cmd)
            if kind == "jog_joint":
                return self._adapter.jog_joint(cmd)
            if kind == "jog_tcp":
                return self._adapter.jog_tcp(cmd)
            if kind == "stop":
                return self.stop()
            if kind == "enable":
                return self._adapter.enable()
            if kind == "disable":
                return self._adapter.disable()
        return {"success": False, "message": f"unknown arm command: {cmd.kind}"}
