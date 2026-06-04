"""流式代理 library /v1 文件的共享 helper。

两处文件代理 (library_proxy.api_library_file / catalog.api_my_project_file) 复用:
先建立 httpx stream 读到响应头, 根据上游状态码决定:
- 200: 返回 StreamingResponse, 并把 AsyncClient + stream context 的生命周期
  绑定到迭代周期 (generator 的 finally 关闭, 避免连接泄漏)。
- 非 200 (404/403/500...): 立即关闭连接, 返回对应错误码的 JSONResponse,
  而不是一个 200 + 空 body 的响应 (修复"无法区分文件不存在 vs 文件正常但空")。
"""

from __future__ import annotations

import logging
import mimetypes

import httpx
from starlette.responses import JSONResponse, StreamingResponse

from .client import library_request_env


logger = logging.getLogger(__name__)


async def stream_library_file(url: str, file_path: str):
    """流式代理 library 文件 URL, 传播上游状态码。

    返回 StreamingResponse (200) 或 JSONResponse (非 200 / 连接错误)。
    """
    _, license_token, trust_env = library_request_env()
    headers = {"Authorization": f"Bearer {license_token}"}

    client = httpx.AsyncClient(timeout=60.0, trust_env=trust_env)
    try:
        stream_cm = client.stream("GET", url, headers=headers)
        r = await stream_cm.__aenter__()
    except Exception:
        await client.aclose()
        logger.exception("library file stream connect failed url=%s", url)
        return JSONResponse({"error": "library_error"}, status_code=502)

    if r.status_code != 200:
        # 上游非 200: 关闭连接, 传播状态码 (404 文件不存在 / 403 / 5xx)。
        try:
            await stream_cm.__aexit__(None, None, None)
        finally:
            await client.aclose()
        if r.status_code == 404:
            return JSONResponse(
                {"error": "file_not_found", "path": file_path}, status_code=404
            )
        if r.status_code in (401, 403):
            return JSONResponse(
                {"error": "library_unauthorized"}, status_code=502
            )
        return JSONResponse(
            {"error": "library_error", "upstream_status": r.status_code},
            status_code=502,
        )

    # 优先用上游 content-type, 缺失再按文件后缀猜。
    ct = r.headers.get("content-type")
    if not ct:
        ct, _ = mimetypes.guess_type(file_path)
    if not ct:
        ct = "application/octet-stream"

    async def _body():
        try:
            async for chunk in r.aiter_bytes():
                yield chunk
        finally:
            # 把 client + stream context 生命周期绑到迭代周期, 迭代结束/客户端
            # 断开时关闭, 避免连接泄漏。
            try:
                await stream_cm.__aexit__(None, None, None)
            finally:
                await client.aclose()

    return StreamingResponse(_body(), media_type=ct)
