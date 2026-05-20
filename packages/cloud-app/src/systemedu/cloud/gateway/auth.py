"""Simple token-based authentication for the gateway."""

import secrets
import time

from starlette.requests import Request
from starlette.responses import JSONResponse

CREDENTIALS: dict[str, str] = {"root": "123systemedu"}
TOKEN_TTL = 86400 * 7  # 7 days

_VALID_TOKENS: dict[str, float] = {}  # token -> expire_ts


def create_token(username: str) -> str:
    token = secrets.token_hex(32)
    _VALID_TOKENS[token] = time.time() + TOKEN_TTL
    return token


def verify_token(token: str) -> bool:
    exp = _VALID_TOKENS.get(token)
    return exp is not None and time.time() < exp


def revoke_token(token: str) -> None:
    _VALID_TOKENS.pop(token, None)


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    # Allow token via query param for streaming endpoints (SSE/EventSource)
    token_qs = request.query_params.get("token")
    if token_qs:
        return token_qs
    return None


async def require_auth(request: Request) -> JSONResponse | None:
    """Return 401 JSONResponse if token is missing/invalid, else None.

    spec 024-A: 兼容旧 verify_token (内存) + 新 JWT (multiuser.decode_token).
    """
    token = _extract_token(request)
    if not token:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    if verify_token(token):
        return None
    try:
        from systemedu.cloud.gateway.multiuser.jwt import decode_token as _decode_jwt
        if _decode_jwt(token) is not None:
            return None
    except Exception:
        pass
    return JSONResponse({"error": "Unauthorized"}, status_code=401)
