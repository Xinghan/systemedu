"""TTS synthesis via DashScope qwen3-tts-flash API."""

import logging
import os
import urllib.request
from pathlib import Path

from systemedu.core.config import SYSTEMEDU_HOME, get_config

logger = logging.getLogger(__name__)


def synthesize_speech(
    text: str,
    project_name: str,
    knode_id: int,
) -> tuple[str, list[dict]]:
    """Synthesize speech using DashScope qwen3-tts-flash.

    Returns (audio_relative_path, timestamps_list).
    audio_relative_path is relative to SYSTEMEDU_HOME/media/, e.g.
    "{project_name}/{knode_id}/teacher.wav".
    """
    import dashscope

    config = get_config()

    # Resolve API key: env var → qwen provider key (same DashScope account)
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        qwen = config.llm.providers.get("qwen")
        if qwen:
            api_key = qwen.api_key
    if not api_key:
        raise RuntimeError(
            "No DashScope API key found. Set DASHSCOPE_API_KEY env var "
            "or configure llm.providers.qwen.api_key"
        )

    voice = config.tts.voice  # e.g. "Cherry"
    model = config.tts.model  # e.g. "qwen3-tts-flash"

    response = dashscope.MultiModalConversation.call(
        model=model,
        api_key=api_key,
        text=text,
        voice=voice,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"TTS API error {response.status_code}: {response.message}"
        )

    audio_url = response.output.audio.get("url", "")
    if not audio_url:
        raise RuntimeError("TTS API returned no audio URL")

    # Download audio from temporary OSS URL (bypass proxy)
    audio_data = urllib.request.urlopen(audio_url).read()
    if not audio_data:
        raise RuntimeError("Downloaded audio is empty")

    # Save to media directory
    media_dir = SYSTEMEDU_HOME / "media" / project_name / str(knode_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    audio_path = media_dir / "teacher.wav"
    audio_path.write_bytes(audio_data)
    logger.info(f"TTS audio saved: {audio_path} ({len(audio_data)} bytes)")

    # qwen3-tts-flash does not return word-level timestamps
    relative_path = f"{project_name}/{knode_id}/teacher.wav"
    logger.info("TTS synthesis complete (no word timestamps from this model)")
    return relative_path, []
