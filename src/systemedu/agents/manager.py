"""Agent instance management."""

from .base import AgentConfig, BaseAgent


class AgentManager:
    """Manages agent instances and their lifecycle."""

    def __init__(self):
        self._agents: dict[str, BaseAgent] = {}
        self._agent_types: dict[str, type[BaseAgent]] = {}

    def register_type(self, type_name: str, agent_cls: type[BaseAgent]) -> None:
        """Register an agent type for instantiation."""
        self._agent_types[type_name] = agent_cls

    def create_agent(self, config: AgentConfig) -> BaseAgent:
        """Create an agent instance from config."""
        agent_cls = self._agent_types.get(config.type)
        if agent_cls is None:
            raise ValueError(
                f"Unknown agent type '{config.type}'. "
                f"Available: {list(self._agent_types.keys())}"
            )
        agent = agent_cls(config)
        self._agents[config.name] = agent
        return agent

    def get_agent(self, name: str) -> BaseAgent | None:
        return self._agents.get(name)

    def list_agents(self) -> list[str]:
        return list(self._agents.keys())

    def list_types(self) -> list[str]:
        return list(self._agent_types.keys())
