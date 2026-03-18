"""CosyVoice TTS synthesis via DashScope SDK."""

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def synthesize_speech(
    text: str,
    project_name: str,
    knode_id: int,
) -> tuple[str, list[dict]]:
    """Synthesize speech from text using DashScope CosyVoice.

    Returns (audio_relative_path, timestamps_list).
    audio_relative_path is relative to SYSTEMEDU_HOME/media/, e.g.
    "{project_name}/{knode_id}/teacher.mp3".

    Timestamps list: [{"text": "...", "begin_time": 0, "end_time": 200}, ...]
    Times are in milliseconds.
    """
    from dashscope.audio.tts_v2 import AudioFormat, ResultCallback, SpeechSynthesizer

    from systemedu.core.config import SYSTEMEDU_HOME, get_config

    config = get_config()
    api_key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise RuntimeError("DASHSCOPE_API_KEY environment variable is not set")

    # Prepare output directory
    media_dir = SYSTEMEDU_HOME / "media" / project_name / str(knode_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    audio_path = media_dir / "teacher.mp3"

    # Collect timestamps and audio data via callback
    collected_timestamps: list[dict] = []

    class TTSCallback(ResultCallback):
        def __init__(self, output_path: Path):
            self._file = open(output_path, "wb")

        def on_data(self, data: bytes) -> None:
            self._file.write(data)

        def on_event(self, message) -> None:
            try:
                data = json.loads(message) if isinstance(message, str) else message
                payload = data.get("payload", {})
                output = payload.get("output", {})
                sentence = output.get("sentence", {})
                words = sentence.get("words", [])
                for word in words:
                    collected_timestamps.append({
                        "text": word.get("text", ""),
                        "begin_time": word.get("begin_time", 0),
                        "end_time": word.get("end_time", 0),
                    })
            except Exception:
                logger.debug("Failed to parse TTS event", exc_info=True)

        def on_complete(self) -> None:
            self._file.close()
            logger.info(f"TTS audio saved: {audio_path}")

        def on_error(self, message: str) -> None:
            self._file.close()
            logger.error(f"TTS error: {message}")

    callback = TTSCallback(audio_path)

    synthesizer = SpeechSynthesizer(
        model=config.tts.model,
        voice=config.tts.voice,
        format=AudioFormat.MP3_22050HZ_MONO_256KBPS,
        callback=callback,
        api_key=api_key,
        additional_params={"word_timestamp_enabled": True},
    )

    synthesizer.call(text)

    # Build relative path for URL serving
    relative_path = f"{project_name}/{knode_id}/teacher.mp3"

    logger.info(f"TTS synthesis complete: {len(collected_timestamps)} word timestamps")
    return relative_path, collected_timestamps
