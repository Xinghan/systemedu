"""Base agent class for all SystemEdu agents."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    """Configuration for an agent instance."""

    name: str
    type: str  # e.g. "builtin:tutor"
    llm_provider: str | None = None
    skills: list[str] = field(default_factory=list)
    mcp_servers: list[str] = field(default_factory=list)
    system_prompt: str = ""


class BaseAgent(ABC):
    """Abstract base class for all agents."""

    name: str = "base"
    description: str = ""

    def __init__(self, config: AgentConfig | None = None):
        self.config = config or AgentConfig(name=self.name, type=f"builtin:{self.name}")

    @abstractmethod
    async def process(self, message: str, context: dict | None = None) -> str:
        """Process a message and return a response.

        Args:
            message: The user's message.
            context: Optional context dict (e.g. knode_title, user_age).

        Returns:
            The agent's response text.
        """

    def get_system_prompt(self, context: dict | None = None) -> str:
        """Build the system prompt for this agent."""
        return self.config.system_prompt or ""
