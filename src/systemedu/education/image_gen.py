"""Project cover image generation via DashScope Wanx API."""

import asyncio
import logging
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

WANX_SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
WANX_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"


def _get_api_key() -> str | None:
    try:
        from systemedu.core.config import load_config
        cfg = load_config()
        for provider in cfg.llm.providers.values():
            if provider.api_key and "sk-" in provider.api_key:
                return provider.api_key
    except Exception:
        pass
    return None


async def generate_project_cover(title: str, description: str, save_path: Path) -> bool:
    """Generate a project cover image via DashScope Wanx and save to save_path.

    Returns True on success, False on failure.
    """
    api_key = _get_api_key()
    if not api_key:
        logger.warning("No DashScope API key found, skipping cover generation")
        return False

    prompt = (
        f"A beautiful, modern, educational illustration for a learning project titled '{title}'. "
        f"Topic: {description[:120] if description else title}. "
        "Digital art style, vibrant colors, futuristic, clean composition, no text."
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }
    payload = {
        "model": "wanx2.1-t2i-plus",
        "input": {"prompt": prompt},
        "parameters": {
            "size": "512*512",
            "n": 1,
        },
    }

    try:
        # Use explicit transport to bypass system proxy settings (DashScope is a CN service, no proxy needed)
        transport = httpx.AsyncHTTPTransport()
        async with httpx.AsyncClient(transport=transport, timeout=30) as client:
            # Submit task
            res = await client.post(WANX_SUBMIT_URL, headers=headers, json=payload)
            if res.status_code != 200:
                logger.error(f"Wanx submit failed: {res.status_code} {res.text[:200]}")
                return False

            data = res.json()
            task_id = data.get("output", {}).get("task_id")
            if not task_id:
                logger.error(f"No task_id in response: {data}")
                return False

            logger.info(f"Cover generation task submitted: {task_id}")

            # Poll for result (max 120s)
            for attempt in range(24):
                await asyncio.sleep(5)
                poll_res = await client.get(
                    WANX_TASK_URL.format(task_id=task_id),
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if poll_res.status_code != 200:
                    continue

                poll_data = poll_res.json()
                task_status = poll_data.get("output", {}).get("task_status")

                if task_status == "SUCCEEDED":
                    results = poll_data.get("output", {}).get("results", [])
                    if not results:
                        logger.error("No results in succeeded task")
                        return False

                    image_url = results[0].get("url")
                    if not image_url:
                        logger.error("No image URL in results")
                        return False

                    # Download image
                    img_res = await client.get(image_url, follow_redirects=True)
                    if img_res.status_code != 200:
                        logger.error(f"Failed to download image: {img_res.status_code}")
                        return False

                    save_path.parent.mkdir(parents=True, exist_ok=True)
                    save_path.write_bytes(img_res.content)
                    logger.info(f"Cover image saved to {save_path}")
                    return True

                elif task_status in ("FAILED", "CANCELED"):
                    logger.error(f"Cover generation {task_status}: {poll_data}")
                    return False

                logger.debug(f"Cover generation pending (attempt {attempt+1}/24): {task_status}")

            logger.error("Cover generation timed out after 120s")
            return False

    except Exception as e:
        logger.error(f"Cover generation error: {e}")
        return False
