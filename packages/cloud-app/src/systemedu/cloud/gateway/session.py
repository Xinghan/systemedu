"""Session management for agent conversations.

Sessions are kept in memory for fast access and persisted to SQLite
so that they survive page refreshes and server restarts.
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)


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
    _on_message: object = field(default=None, repr=False)  # callback(session_id, msg)

    def add_message(self, role: str, content: str, **kwargs) -> Message:
        msg = Message(role=role, content=content, **kwargs)
        self.messages.append(msg)
        if self._on_message:
            self._on_message(self.id, msg)
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
    """Manages active sessions with SQLite persistence.

    On create/add_message, data is written through to SQLite.
    On init, existing sessions are loaded from SQLite.
    """

    def __init__(self, persist: bool = True):
        self._sessions: dict[str, Session] = {}
        self._persist = persist
        if persist:
            self._load_from_db()

    def _load_from_db(self):
        """Load sessions from SQLite on startup."""
        try:
            from systemedu.core.storage.db import ChatMessage as DBMessage
            from systemedu.core.storage.db import ChatSession as DBSession
            from systemedu.core.storage.db import get_session as get_db_session

            db = get_db_session()
            try:
                db_sessions = db.query(DBSession).order_by(DBSession.created_at.desc()).limit(50).all()
                for dbs in db_sessions:
                    messages = []
                    for dbm in sorted(dbs.messages, key=lambda m: m.created_at):
                        messages.append(
                            Message(
                                role=dbm.role,
                                content=dbm.content,
                                timestamp=dbm.created_at,
                            )
                        )
                    session = Session(
                        id=dbs.id,
                        agent_name=dbs.agent_name or "default",
                        project_name=dbs.project_name,
                        messages=messages,
                        created_at=dbs.created_at,
                    )
                    self._sessions[session.id] = session
                logger.info(f"Loaded {len(self._sessions)} sessions from database")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to load sessions from DB: {e}")

    def _persist_session(self, session: Session):
        """Save a new session to SQLite."""
        if not self._persist:
            return
        try:
            from systemedu.core.storage.db import ChatSession as DBSession
            from systemedu.core.storage.db import get_session as get_db_session

            db = get_db_session()
            try:
                db_session = DBSession(
                    id=session.id,
                    agent_name=session.agent_name,
                    project_name=session.project_name,
                    created_at=session.created_at,
                )
                db.add(db_session)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to persist session: {e}")

    def _persist_message(self, session_id: str, msg: Message):
        """Save a message to SQLite."""
        if not self._persist:
            return
        # Only persist user and assistant messages
        if msg.role not in ("user", "assistant"):
            return
        try:
            from systemedu.core.storage.db import ChatMessage as DBMessage
            from systemedu.core.storage.db import get_session as get_db_session

            db = get_db_session()
            try:
                db_msg = DBMessage(
                    session_id=session_id,
                    role=msg.role,
                    content=msg.content,
                    created_at=msg.timestamp,
                )
                db.add(db_msg)
                db.commit()
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to persist message: {e}")

    def create_session(
        self, agent_name: str = "default", project_name: str | None = None
    ) -> Session:
        session = Session(agent_name=agent_name, project_name=project_name)
        session._on_message = self._persist_message
        self._sessions[session.id] = session
        self._persist_session(session)
        return session

    def get_session(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[Session]:
        return list(self._sessions.values())

    def close_session(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
