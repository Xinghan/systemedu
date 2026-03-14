"""Session management for agent conversations."""

import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Message:
    """A single message in a conversation."""

    role: str  # "user", "assistant", "system", "tool"
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    tool_call_id: str | None = None
    tool_calls: list[dict] | None = None
    name: str | None = None  # tool name for tool messages


@dataclass
class Session:
    """An active conversation session."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_name: str = "default"
    project_name: str | None = None
    messages: list[Message] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str, **kwargs) -> Message:
        msg = Message(role=role, content=content, **kwargs)
        self.messages.append(msg)
        return msg

    def get_openai_messages(self) -> list[dict]:
        """Convert messages to OpenAI API format."""
        result = []
        for msg in self.messages:
            entry = {"role": msg.role, "content": msg.content}
            if msg.name:
                entry["name"] = msg.name
            if msg.tool_call_id:
                entry["tool_call_id"] = msg.tool_call_id
            if msg.tool_calls:
                entry["tool_calls"] = msg.tool_calls
            result.append(entry)
        return result


class SessionManager:
    """Manages active sessions."""

    def __init__(self):
        self._sessions: dict[str, Session] = {}

    def create_session(
        self, agent_name: str = "default", project_name: str | None = None
    ) -> Session:
        session = Session(agent_name=agent_name, project_name=project_name)
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[Session]:
        return list(self._sessions.values())

    def close_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
