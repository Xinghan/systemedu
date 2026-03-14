"""Hub API client for project push/pull/search (Phase 4 placeholder)."""

import logging

from systemedu.core.config import get_config

logger = logging.getLogger(__name__)


class HubClient:
    """Client for communicating with the SystemEdu Hub server.

    Phase 4 will implement full Hub API integration.
    """

    def __init__(self):
        config = get_config()
        self.base_url = config.hub.url
        self.token = config.hub.token

    async def login(self, username: str, password: str) -> str:
        """Login and return auth token."""
        raise NotImplementedError("Hub login not yet implemented (Phase 4)")

    async def search(self, query: str) -> list[dict]:
        """Search for projects on the Hub."""
        raise NotImplementedError("Hub search not yet implemented (Phase 4)")

    async def pull(self, project_name: str, output_dir: str) -> str:
        """Download a project from the Hub."""
        raise NotImplementedError("Hub pull not yet implemented (Phase 4)")

    async def push(self, project_dir: str) -> str:
        """Push a local project to the Hub."""
        raise NotImplementedError("Hub push not yet implemented (Phase 4)")
