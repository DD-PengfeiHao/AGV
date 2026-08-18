"""Session auth for AGV Web — admin + registered users (PBKDF2, rate-limit)."""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

ADMIN_USERNAME = "ubuntu"
ADMIN_DEFAULT_PASSWORD = os.environ.get("WEB_AUTH_ADMIN_PASSWORD", "ubuntu")
PBKDF2_ITERATIONS = 120_000
SESSION_TTL_SEC = int(os.environ.get("WEB_AUTH_SESSION_TTL_SEC", str(86400 * 2)))  # 48h default
LOGIN_MAX_ATTEMPTS = 8
LOGIN_WINDOW_SEC = 300


def _legacy_hash(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2:{PBKDF2_ITERATIONS}:{dk.hex()}"


def _verify_password(password: str, salt: str, stored: str) -> bool:
    pwd = str(password or "")
    if stored.startswith("pbkdf2:"):
        try:
            _, iters_s, expected = stored.split(":", 2)
            iters = int(iters_s)
            dk = hashlib.pbkdf2_hmac(
                "sha256",
                pwd.encode("utf-8"),
                salt.encode("utf-8"),
                iters,
            )
            return secrets.compare_digest(dk.hex(), expected)
        except Exception:  # noqa: BLE001
            return False
    return secrets.compare_digest(_legacy_hash(pwd, salt), stored)


class WebAuth:
    def __init__(self, users_file: Optional[str] = None) -> None:
        maps_rw = os.environ.get("MAPS_RW_DIR", "/opt/delivery_ws/maps_rw")
        self._path = Path(users_file or os.environ.get("WEB_USERS_FILE", f"{maps_rw}/web_users.json"))
        self._lock = threading.Lock()
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._users: Dict[str, Dict[str, Any]] = {}
        self._login_attempts: Dict[str, List[float]] = {}
        self._load()

    def _load(self) -> None:
        with self._lock:
            if self._path.is_file():
                try:
                    data = json.loads(self._path.read_text(encoding="utf-8"))
                    users = data.get("users") or []
                    self._users = {str(u["username"]): u for u in users if u.get("username")}
                except Exception:  # noqa: BLE001
                    self._users = {}
            if ADMIN_USERNAME not in self._users:
                salt = secrets.token_hex(16)
                self._users[ADMIN_USERNAME] = {
                    "username": ADMIN_USERNAME,
                    "role": "admin",
                    "salt": salt,
                    "password_hash": _hash_password(ADMIN_DEFAULT_PASSWORD, salt),
                    "must_change_password": True,
                }
                self._save_unlocked()

    def _save_unlocked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"users": list(self._users.values())}
        self._path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            pass

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [t for t, s in self._sessions.items() if float(s.get("expires", 0)) <= now]
        for t in expired:
            self._sessions.pop(t, None)

    def _check_rate_limit(self, username: str) -> Optional[str]:
        key = str(username or "").strip().lower()
        now = time.time()
        with self._lock:
            attempts = [t for t in self._login_attempts.get(key, []) if now - t < LOGIN_WINDOW_SEC]
            self._login_attempts[key] = attempts
            if len(attempts) >= LOGIN_MAX_ATTEMPTS:
                return "登录尝试过多，请 5 分钟后再试"
        return None

    def _record_failed_login(self, username: str) -> None:
        key = str(username or "").strip().lower()
        with self._lock:
            self._login_attempts.setdefault(key, []).append(time.time())

    def login(self, username: str, password: str) -> Dict[str, Any]:
        name = str(username or "").strip()
        blocked = self._check_rate_limit(name)
        if blocked:
            return {"success": False, "message": blocked}
        user = self._users.get(name)
        if not user:
            self._record_failed_login(name)
            return {"success": False, "message": "用户名或密码错误"}
        salt = str(user.get("salt", ""))
        stored = str(user.get("password_hash", ""))
        if not _verify_password(str(password or ""), salt, stored):
            self._record_failed_login(name)
            return {"success": False, "message": "用户名或密码错误"}
        # Upgrade legacy sha256 hash on successful login
        if not stored.startswith("pbkdf2:"):
            with self._lock:
                user = self._users.get(name)
                if user:
                    user["password_hash"] = _hash_password(str(password or ""), salt)
                    self._save_unlocked()
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._purge_expired()
            self._sessions[token] = {
                "username": user["username"],
                "role": user.get("role", "user"),
                "expires": time.time() + SESSION_TTL_SEC,
            }
        return {
            "success": True,
            "token": token,
            "username": user["username"],
            "role": user.get("role", "user"),
            "is_admin": user.get("role") == "admin",
            "must_change_password": bool(user.get("must_change_password")),
        }

    def logout(self, token: str) -> Dict[str, Any]:
        with self._lock:
            self._sessions.pop(str(token or ""), None)
        return {"success": True}

    def session_from_token(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        with self._lock:
            self._purge_expired()
            sess = self._sessions.get(str(token))
            if not sess:
                return None
            if float(sess.get("expires", 0)) <= time.time():
                self._sessions.pop(str(token), None)
                return None
            # Sliding expiration
            sess["expires"] = time.time() + SESSION_TTL_SEC
            user = self._users.get(sess.get("username", ""), {})
            out = dict(sess)
            out["is_admin"] = sess.get("role") == "admin"
            out["must_change_password"] = bool(user.get("must_change_password"))
            return out

    def change_password(self, token: str, old_password: str, new_password: str) -> Dict[str, Any]:
        sess = self.session_from_token(token)
        if not sess:
            return {"success": False, "message": "未登录"}
        name = sess["username"]
        user = self._users.get(name)
        if not user:
            return {"success": False, "message": "用户不存在"}
        if not _verify_password(str(old_password or ""), user.get("salt", ""), user.get("password_hash", "")):
            return {"success": False, "message": "原密码错误"}
        if len(str(new_password or "")) < 8:
            return {"success": False, "message": "新密码至少 8 个字符"}
        with self._lock:
            user = self._users.get(name)
            if not user:
                return {"success": False, "message": "用户不存在"}
            salt = secrets.token_hex(16)
            user["salt"] = salt
            user["password_hash"] = _hash_password(str(new_password), salt)
            user["must_change_password"] = False
            self._save_unlocked()
        return {"success": True, "message": "密码已更新"}

    def register(self, token: str, username: str, password: str) -> Dict[str, Any]:
        sess = self.session_from_token(token)
        if not sess or sess.get("role") != "admin":
            return {"success": False, "message": "需要管理员权限"}
        name = str(username or "").strip()
        pwd = str(password or "")
        if not name or len(name) < 2:
            return {"success": False, "message": "用户名至少 2 个字符"}
        if len(pwd) < 8:
            return {"success": False, "message": "密码至少 8 个字符"}
        if name == ADMIN_USERNAME:
            return {"success": False, "message": "不能注册管理员账户"}
        with self._lock:
            if name in self._users:
                return {"success": False, "message": "用户名已存在"}
            salt = secrets.token_hex(16)
            self._users[name] = {
                "username": name,
                "role": "user",
                "salt": salt,
                "password_hash": _hash_password(pwd, salt),
                "must_change_password": False,
            }
            self._save_unlocked()
        return {"success": True, "message": f"用户 {name} 已注册", "username": name}

    def list_users(self, token: str) -> Dict[str, Any]:
        sess = self.session_from_token(token)
        if not sess or sess.get("role") != "admin":
            return {"success": False, "message": "需要管理员权限"}
        with self._lock:
            names = sorted(self._users.keys())
        return {
            "success": True,
            "users": [
                {"username": n, "role": self._users[n].get("role", "user")}
                for n in names
            ],
        }

    @staticmethod
    def extract_token(headers: Any) -> Optional[str]:
        auth = headers.get("Authorization", "") if headers else ""
        if auth.startswith("Bearer "):
            return auth[7:].strip()
        cookie = headers.get("Cookie", "") if headers else ""
        for part in cookie.split(";"):
            part = part.strip()
            if part.startswith("agv_session="):
                return part.split("=", 1)[1].strip()
        return headers.get("X-Session-Token", "").strip() if headers else None

    def is_public_route(self, path: str) -> bool:
        return path in (
            "/api/auth/login",
            "/api/health",
            "/api/version",
            "/api/heartbeat",
        )

    def is_public_read_route(self, path: str) -> bool:
        """Read-only endpoints for overview without login."""
        if path in (
            "/api/state",
            "/api/route/status",
            "/api/stations",
            "/api/map/status",
            "/api/map/list",
            "/api/status",
            "/api/arm/status",
            "/api/arm/pose",
            "/api/arm/gripper",
        ):
            return True
        if path.startswith("/api/vision/") and path.endswith(("/status", "/localization", "/snapshot")):
            return True
        if path.startswith("/api/jason/camera/") and path.endswith(("/status", "/snapshot")):
            return True
        return False

    def can_restart(self, user: Optional[Dict[str, Any]]) -> bool:
        if not user:
            return False
        return user.get("role") in ("admin", "dev")

    def is_admin_route(self, path: str) -> bool:
        if path == "/api/debug":
            return True
        if path in ("/api/logs", "/api/system/logs"):
            return True
        if path.startswith("/api/log/"):
            return True
        if path.startswith("/api/diag/"):
            return True
        return False

    def is_danger_route(self, path: str) -> bool:
        return path in ("/api/restart/docker", "/api/restart/component", "/api/stack/ensure")

    def requires_login(self, path: str) -> bool:
        if not path.startswith("/api/"):
            return False
        if path.startswith("/api/auth/session"):
            return False
        if self.is_public_route(path):
            return False
        if self.is_public_read_route(path):
            return False
        return True
