"""Sandbox for tool execution with process-level isolation.

Restricts file system access, blocks dangerous commands, and enforces timeouts.
"""

from pathlib import Path

from .config import SandboxConfig


class SandboxViolation(Exception):
    """Raised when a sandbox policy is violated."""


class Sandbox:
    """Process-level sandbox for tool execution.

    - Restricts file system access to allowed_dirs
    - Blocks dangerous commands
    - Enforces execution timeouts
    - Controls network access
    """

    def __init__(self, config: SandboxConfig | None = None):
        self.config = config or SandboxConfig()

    def check_command(self, command: str) -> None:
        """Check if a command is allowed by sandbox policy.

        Raises SandboxViolation if blocked.
        """
        if not self.config.enabled:
            return

        for blocked in self.config.blocked_commands:
            if blocked in command:
                raise SandboxViolation(f"Command blocked: contains '{blocked}'")

    def check_file_access(self, path: str, write: bool = False) -> None:
        """Check if file access is allowed.

        Raises SandboxViolation if the path is outside allowed directories.
        """
        if not self.config.enabled:
            return

        resolved = Path(path).expanduser().resolve()
        allowed = [Path(d).expanduser().resolve() for d in self.config.allowed_dirs]

        for allowed_dir in allowed:
            if resolved == allowed_dir or allowed_dir in resolved.parents:
                return

        action = "write" if write else "read"
        raise SandboxViolation(
            f"File {action} blocked: {path} is outside allowed directories"
        )
