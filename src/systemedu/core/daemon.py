"""Daemon process management for SystemEdu Gateway."""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from .config import LOGS_DIR, SYSTEMEDU_HOME, get_config


def _find_web_dir() -> Path | None:
    """Find the web/ frontend directory relative to the project."""
    # Check common locations
    candidates = [
        Path.cwd() / "web",
        Path(__file__).resolve().parent.parent.parent.parent / "web",  # src/../web
    ]
    for d in candidates:
        if d.is_dir() and (d / "package.json").exists():
            return d
    return None


class DaemonManager:
    """Manage the SystemEdu daemon process (Gateway server)."""

    PID_FILE = SYSTEMEDU_HOME / "daemon.pid"
    WEB_PID_FILE = SYSTEMEDU_HOME / "web.pid"
    LOG_FILE = LOGS_DIR / "daemon.log"
    WEB_LOG_FILE = LOGS_DIR / "web.log"

    @classmethod
    def start(cls, port: int | None = None, foreground: bool = False) -> int:
        """Start the daemon process.

        Args:
            port: Override gateway port.
            foreground: Run in foreground (for debugging).

        Returns:
            PID of the started process.

        Raises:
            RuntimeError: If daemon is already running.
        """
        if cls.is_running():
            info = cls.status()
            raise RuntimeError(
                f"Daemon already running (PID {info['pid']}, port {info.get('port', '?')})"
            )

        config = get_config()
        actual_port = port or config.gateway.port
        host = config.gateway.host

        LOGS_DIR.mkdir(parents=True, exist_ok=True)

        if foreground:
            # Run in foreground (blocking)
            cls._run_gateway(host, actual_port)
            return os.getpid()

        # Fork a background process
        cmd = [
            sys.executable,
            "-m",
            "systemedu.gateway.server",
            "--host",
            host,
            "--port",
            str(actual_port),
        ]

        with open(cls.LOG_FILE, "a") as log_file:
            proc = subprocess.Popen(
                cmd,
                stdout=log_file,
                stderr=log_file,
                start_new_session=True,
            )

        # Write PID file
        cls.PID_FILE.write_text(str(proc.pid))

        # Wait briefly and verify the process started
        time.sleep(0.5)
        if not cls._is_pid_alive(proc.pid):
            cls.PID_FILE.unlink(missing_ok=True)
            raise RuntimeError(
                f"Daemon failed to start. Check logs: {cls.LOG_FILE}"
            )

        return proc.pid

    @classmethod
    def start_web(cls, web_dir: Path | None = None) -> int | None:
        """Start the Next.js frontend dev server.

        Auto-runs `npm install` if node_modules/ is missing.

        Returns:
            PID of the web process, or None if web/ not found.
        """
        if web_dir is None:
            web_dir = _find_web_dir()
        if web_dir is None:
            return None

        # Already running?
        if cls.WEB_PID_FILE.exists():
            pid = int(cls.WEB_PID_FILE.read_text().strip())
            if cls._is_pid_alive(pid):
                return pid  # already running

        LOGS_DIR.mkdir(parents=True, exist_ok=True)

        # Auto-install if needed
        if not (web_dir / "node_modules").exists():
            import logging

            logging.getLogger(__name__).info("Installing frontend dependencies...")
            subprocess.run(
                ["npm", "install"],
                cwd=str(web_dir),
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=True,
            )

        with open(cls.WEB_LOG_FILE, "a") as log_file:
            proc = subprocess.Popen(
                ["npx", "next", "dev", "--turbopack", "-p", "3000"],
                cwd=str(web_dir),
                stdout=log_file,
                stderr=log_file,
                start_new_session=True,
            )

        cls.WEB_PID_FILE.write_text(str(proc.pid))

        time.sleep(1.0)
        if not cls._is_pid_alive(proc.pid):
            cls.WEB_PID_FILE.unlink(missing_ok=True)
            return None

        return proc.pid

    @classmethod
    def stop_web(cls) -> bool:
        """Stop the web frontend dev server."""
        if not cls.WEB_PID_FILE.exists():
            return False

        pid = int(cls.WEB_PID_FILE.read_text().strip())

        if not cls._is_pid_alive(pid):
            cls.WEB_PID_FILE.unlink(missing_ok=True)
            return False

        try:
            os.killpg(os.getpgid(pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            try:
                os.kill(pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

        for _ in range(30):
            if not cls._is_pid_alive(pid):
                break
            time.sleep(0.1)
        else:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

        cls.WEB_PID_FILE.unlink(missing_ok=True)
        return True

    @classmethod
    def stop(cls) -> bool:
        """Stop the daemon process (and web frontend if running).

        Returns:
            True if the daemon was stopped, False if it wasn't running.
        """
        cls.stop_web()

        if not cls.PID_FILE.exists():
            return False

        pid = int(cls.PID_FILE.read_text().strip())

        if not cls._is_pid_alive(pid):
            cls.PID_FILE.unlink(missing_ok=True)
            return False

        # Send SIGTERM
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            cls.PID_FILE.unlink(missing_ok=True)
            return False

        # Wait for process to exit (up to 5 seconds)
        for _ in range(50):
            if not cls._is_pid_alive(pid):
                break
            time.sleep(0.1)
        else:
            # Force kill if still running
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

        cls.PID_FILE.unlink(missing_ok=True)
        return True

    @classmethod
    def status(cls) -> dict:
        """Get daemon status.

        Returns:
            Dict with keys: running, pid, port, url, uptime (if running).
        """
        config = get_config()
        result = {
            "running": False,
            "pid": None,
            "port": config.gateway.port,
            "url": f"http://{config.gateway.host}:{config.gateway.port}",
        }

        if not cls.PID_FILE.exists():
            return result

        pid = int(cls.PID_FILE.read_text().strip())

        if not cls._is_pid_alive(pid):
            cls.PID_FILE.unlink(missing_ok=True)
            return result

        result["running"] = True
        result["pid"] = pid

        # Try to get detailed status from gateway API
        try:
            import httpx

            resp = httpx.get(f"{result['url']}/api/status", timeout=2.0)
            if resp.status_code == 200:
                result.update(resp.json())
        except Exception:
            pass

        return result

    @classmethod
    def is_running(cls) -> bool:
        """Check if the daemon is running."""
        return cls.status()["running"]

    @staticmethod
    def _is_pid_alive(pid: int) -> bool:
        """Check if a process with the given PID is alive."""
        try:
            os.kill(pid, 0)
            return True
        except (ProcessLookupError, PermissionError):
            return False

    @staticmethod
    def _run_gateway(host: str, port: int) -> None:
        """Run the gateway server (blocking, for foreground mode)."""
        import uvicorn

        from systemedu.gateway.server import create_app

        app = create_app()
        uvicorn.run(app, host=host, port=port, log_level="info")
