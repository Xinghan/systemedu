"""CosyVoice / Sambert TTS synthesis via DashScope SDK."""

import json
import logging
import os
from pathlib import Path

from systemedu.core.config import SYSTEMEDU_HOME, get_config

logger = logging.getLogger(__name__)


def synthesize_speech(
    text: str,
    project_name: str,
    knode_id: int,
) -> tuple[str, list[dict]]:
    """Synthesize speech from text using DashScope TTS.

    Returns (audio_relative_path, timestamps_list).
    audio_relative_path is relative to SYSTEMEDU_HOME/media/, e.g.
    "{project_name}/{knode_id}/teacher.mp3".

    Timestamps list: [{"text": "...", "begin_time": 0, "end_time": 200}, ...]
    Times are in milliseconds.
    """
    import dashscope
    from dashscope.audio.tts import SpeechSynthesizer

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

    dashscope.api_key = api_key

    # Prepare output directory
    media_dir = SYSTEMEDU_HOME / "media" / project_name / str(knode_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    audio_path = media_dir / "teacher.mp3"

    # Resolve model/voice: sambert uses HTTP API; cosyvoice uses WebSocket.
    # Always use sambert HTTP API for reliability (no proxy/WebSocket issues).
    model = config.tts.model
    voice = config.tts.voice
    if not model.startswith("sambert"):
        model = "sambert-zhichu-v1"
        voice = "zhichu"

    # Use HTTP-based TTS API
    result = SpeechSynthesizer.call(
        model=model,
        voice=voice,
        text=text,
        sample_rate=48000,
        format="mp3",
    )

    audio_data = result.get_audio_data()
    if not audio_data:
        resp = result.get_response()
        raise RuntimeError(f"TTS synthesis returned no audio. Response: {resp}")

    audio_path.write_bytes(audio_data)
    logger.info(f"TTS audio saved: {audio_path} ({len(audio_data)} bytes)")

    # Parse word-level timestamps if available
    timestamps: list[dict] = []
    try:
        raw_ts = result.get_timestamps()
        if raw_ts:
            ts_data = json.loads(raw_ts) if isinstance(raw_ts, str) else raw_ts
            if isinstance(ts_data, list):
                for item in ts_data:
                    timestamps.append({
                        "text": item.get("text", ""),
                        "begin_time": item.get("begin_time", 0),
                        "end_time": item.get("end_time", 0),
                    })
    except Exception:
        logger.debug("Could not parse TTS timestamps", exc_info=True)

    relative_path = f"{project_name}/{knode_id}/teacher.mp3"
    logger.info(f"TTS synthesis complete: {len(timestamps)} word timestamps")
    return relative_path, timestamps
