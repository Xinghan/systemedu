"""Hub authentication (Phase 4 placeholder)."""


class HubAuth:
    """Manages Hub authentication tokens.

    Phase 4 will implement full auth flow.
    """

    def __init__(self):
        self.token: str | None = None

    def is_authenticated(self) -> bool:
        return self.token is not None

    async def login(self, username: str, password: str) -> str:
        raise NotImplementedError("Hub auth not yet implemented (Phase 4)")

    async def logout(self) -> None:
        self.token = None
