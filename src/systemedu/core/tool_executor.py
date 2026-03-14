"""Tool execution for agent runtime.

Provides built-in tools (bash, file read/write) that agents can call.
Tools are defined in OpenAI function-calling format.
"""

import asyncio
import subprocess
from pathlib import Path

BUILTIN_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_bash",
            "description": "Execute a bash command and return its output.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The bash command to execute",
                    },
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path to read",
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The file path to write to",
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
]


class ToolExecutor:
    """Executes tool calls from LLM responses."""

    def __init__(self, sandbox_config=None):
        self.sandbox_config = sandbox_config
        self._handlers = {
            "run_bash": self._run_bash,
            "read_file": self._read_file,
            "write_file": self._write_file,
        }

    def register_tool(self, name: str, handler, schema: dict | None = None):
        """Register a custom tool handler."""
        self._handlers[name] = handler

    async def execute(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool call and return the result as a string."""
        handler = self._handlers.get(tool_name)
        if handler is None:
            return f"Error: Unknown tool '{tool_name}'"

        try:
            if asyncio.iscoroutinefunction(handler):
                result = await handler(**arguments)
            else:
                result = handler(**arguments)
            return str(result)
        except Exception as e:
            return f"Error executing {tool_name}: {e}"

    def get_tool_schemas(self) -> list[dict]:
        """Return OpenAI function-calling schemas for all registered tools."""
        return list(BUILTIN_TOOLS)

    def _run_bash(self, command: str) -> str:
        """Execute a bash command with optional sandbox restrictions."""
        timeout = 300
        if self.sandbox_config:
            timeout = self.sandbox_config.max_execution_time
            for blocked in self.sandbox_config.blocked_commands:
                if blocked in command:
                    return f"Error: Command blocked by sandbox policy: '{blocked}'"

        try:
            result = subprocess.run(
                ["bash", "-c", command],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result.stdout
            if result.stderr:
                output += f"\nSTDERR:\n{result.stderr}"
            if result.returncode != 0:
                output += f"\n(exit code: {result.returncode})"
            return output or "(no output)"
        except subprocess.TimeoutExpired:
            return f"Error: Command timed out after {timeout}s"

    def _read_file(self, path: str) -> str:
        """Read a file's contents."""
        p = Path(path).expanduser()
        if not p.exists():
            return f"Error: File not found: {path}"
        try:
            return p.read_text(encoding="utf-8")
        except Exception as e:
            return f"Error reading {path}: {e}"

    def _write_file(self, path: str, content: str) -> str:
        """Write content to a file."""
        p = Path(path).expanduser()
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
            return f"Successfully wrote {len(content)} chars to {path}"
        except Exception as e:
            return f"Error writing {path}: {e}"
