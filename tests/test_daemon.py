"""Tests for daemon process management."""

import os
import signal

import pytest

from systemedu.core.config import reset_config
from systemedu.core.daemon import DaemonManager


@pytest.fixture(autouse=True)
def clean_config():
    reset_config()
    yield
    reset_config()


@pytest.fixture
def daemon_env(tmp_path, monkeypatch):
    """Set up isolated daemon environment."""
    home = tmp_path / ".systemedu"
    home.mkdir()
    logs = home / "logs"
    logs.mkdir()

    monkeypatch.setattr("systemedu.core.daemon.SYSTEMEDU_HOME", home)
    monkeypatch.setattr("systemedu.core.daemon.LOGS_DIR", logs)
    monkeypatch.setattr("systemedu.core.daemon.DaemonManager.PID_FILE", home / "daemon.pid")
    monkeypatch.setattr("systemedu.core.daemon.DaemonManager.LOG_FILE", logs / "daemon.log")

    return home


class TestDaemonManager:
    def test_is_not_running_initially(self, daemon_env):
        assert not DaemonManager.is_running()

    def test_status_not_running(self, daemon_env):
        info = DaemonManager.status()
        assert info["running"] is False
        assert info["pid"] is None

    def test_stop_when_not_running(self, daemon_env):
        assert DaemonManager.stop() is False

    def test_stale_pid_file_cleaned(self, daemon_env):
        """PID file with dead process should be cleaned up."""
        pid_file = daemon_env / "daemon.pid"
        pid_file.write_text("999999")  # non-existent PID

        assert not DaemonManager.is_running()
        assert not pid_file.exists()  # Should be cleaned up

    def test_is_pid_alive_current_process(self):
        assert DaemonManager._is_pid_alive(os.getpid())

    def test_is_pid_alive_dead_process(self):
        assert not DaemonManager._is_pid_alive(999999)

    def test_start_raises_if_already_running(self, daemon_env, monkeypatch):
        """Should raise if daemon is already running."""
        pid_file = daemon_env / "daemon.pid"
        pid_file.write_text(str(os.getpid()))  # Current process = "running"

        with pytest.raises(RuntimeError, match="already running"):
            DaemonManager.start()

    def test_stop_with_valid_pid_file(self, daemon_env):
        """Stop should handle a PID file pointing to dead process."""
        pid_file = daemon_env / "daemon.pid"
        pid_file.write_text("999999")

        result = DaemonManager.stop()
        assert result is False
        assert not pid_file.exists()
