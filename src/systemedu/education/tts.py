"""TTS synthesis via DashScope qwen_tts SpeechSynthesizer API."""

import base64
import logging
import os
import struct
import urllib.parse
import urllib.request
from contextlib import contextmanager
from http import HTTPStatus
from pathlib import Path
from typing import Any

from systemedu.core.config import SYSTEMEDU_HOME, get_config

logger = logging.getLogger(__name__)

_PROXY_KEYS = [
    "http_proxy",
    "https_proxy",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "all_proxy",
    "ALL_PROXY",
]

_AUDIO_EXT_BY_CONTENT_TYPE = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
}


def _open_url(audio_url: str) -> tuple[bytes, str | None]:
    with urllib.request.urlopen(audio_url) as resp:
        audio_data = resp.read()
        content_type = resp.headers.get_content_type()
    return audio_data, content_type


@contextmanager
def _without_proxy_env():
    """Temporarily unset proxy vars for DashScope/OSS requests."""
    saved = {k: os.environ.pop(k) for k in _PROXY_KEYS if k in os.environ}
    try:
        yield
    finally:
        os.environ.update(saved)


def _get_nested_attr(obj: Any, *keys: str) -> Any:
    """Read nested attr/dict paths without assuming response object shape."""
    cur = obj
    for key in keys:
        if cur is None:
            return None
        if isinstance(cur, dict):
            cur = cur.get(key)
        else:
            cur = getattr(cur, key, None)
    return cur


def _extract_audio_payload(response: Any) -> tuple[str, bytes]:
    """Return (audio_url, audio_bytes_from_response)."""
    audio = _get_nested_attr(response, "output", "audio")
    if audio is None:
        raise RuntimeError("TTS API returned no output.audio payload")

    audio_url = _get_nested_attr(audio, "url") or ""
    audio_data_b64 = _get_nested_attr(audio, "data") or ""
    audio_bytes = b""
    if audio_data_b64:
        try:
            audio_bytes = base64.b64decode(audio_data_b64)
        except Exception as exc:  # pragma: no cover - defensive
            raise RuntimeError("TTS API returned invalid base64 audio data") from exc

    return str(audio_url), audio_bytes


def _download_audio(audio_url: str) -> tuple[bytes, str | None]:
    """Download audio bytes from the temporary OSS URL."""
    try:
        with _without_proxy_env():
            return _open_url(audio_url)
    except Exception as exc:
        logger.warning(
            "Audio download without proxy failed, retrying with ambient network settings: %s",
            exc,
        )
        return _open_url(audio_url)


def _resolve_extension(filename: str, audio_url: str, content_type: str | None) -> str:
    """Infer a stable audio filename extension."""
    if content_type:
        ext = _AUDIO_EXT_BY_CONTENT_TYPE.get(content_type.lower())
        if ext:
            return ext

    url_ext = Path(urllib.parse.urlparse(audio_url).path).suffix.lower()
    if url_ext:
        return url_ext

    file_ext = Path(filename).suffix.lower()
    if file_ext:
        return file_ext

    return ".mp3"


def _normalize_wav_header(audio_data: bytes) -> bytes:
    """Fix RIFF/data chunk sizes for streaming WAV payloads.

    Some TTS responses use placeholder chunk sizes (0x7fffffff-ish) that
    still contain valid PCM payloads but confuse duration probes and some
    browser decoders. Rewrite the header lengths to match the real byte size.
    """
    if len(audio_data) < 44:
        return audio_data
    if audio_data[:4] != b"RIFF" or audio_data[8:12] != b"WAVE":
        return audio_data

    patched = bytearray(audio_data)
    struct.pack_into("<I", patched, 4, len(audio_data) - 8)

    data_offset = audio_data.find(b"data", 12, min(len(audio_data), 256))
    if data_offset != -1 and data_offset + 8 <= len(audio_data):
        struct.pack_into("<I", patched, data_offset + 4, len(audio_data) - data_offset - 8)

    return bytes(patched)


def synthesize_speech(
    text: str,
    project_name: str,
    knode_id: int,
    filename: str = "teacher.mp3",
) -> tuple[str, list[dict]]:
    """Synthesize speech using DashScope qwen_tts SpeechSynthesizer.

    Returns (audio_relative_path, timestamps_list).
    audio_relative_path is relative to SYSTEMEDU_HOME/media/, e.g.
    "{project_name}/{knode_id}/teacher.mp3".
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

    try:
        with _without_proxy_env():
            response = dashscope.audio.qwen_tts.SpeechSynthesizer.call(
                model=model,
                api_key=api_key,
                text=text,
                voice=voice,
            )
    except Exception as exc:
        logger.warning(
            "TTS request without proxy failed, retrying with ambient network settings: %s",
            exc,
        )
        response = dashscope.audio.qwen_tts.SpeechSynthesizer.call(
            model=model,
            api_key=api_key,
            text=text,
            voice=voice,
        )

    if response.status_code != HTTPStatus.OK:
        raise RuntimeError(
            f"TTS API error {response.status_code}: {response.message}"
        )

    audio_url, audio_data = _extract_audio_payload(response)
    content_type = None
    if not audio_data:
        if not audio_url:
            raise RuntimeError("TTS API returned neither audio URL nor audio data")
        audio_data, content_type = _download_audio(audio_url)

    if not audio_data:
        raise RuntimeError("Downloaded audio is empty")

    # Save to media directory
    ext = _resolve_extension(filename, audio_url, content_type)
    if ext == ".wav":
        audio_data = _normalize_wav_header(audio_data)
    desired = Path(filename)
    final_filename = desired.name
    if desired.suffix.lower() != ext:
        final_filename = f"{desired.stem}{ext}"

    media_dir = SYSTEMEDU_HOME / "media" / project_name / str(knode_id)
    media_dir.mkdir(parents=True, exist_ok=True)
    audio_path = media_dir / final_filename
    audio_path.write_bytes(audio_data)
    logger.info(f"TTS audio saved: {audio_path} ({len(audio_data)} bytes)")

    relative_path = f"{project_name}/{knode_id}/{final_filename}"
    logger.info(f"TTS synthesis complete: {relative_path}")
    return relative_path, []
