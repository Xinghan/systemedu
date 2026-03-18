"""Tests for TTS synthesis module."""

import json
from unittest.mock import MagicMock, patch

import pytest

from systemedu.storage.db import (
    LessonContent,
    get_session,
    reset_db,
)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Use a temp database for tests."""
    reset_db()
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("systemedu.storage.db.DB_FILE", db_file)
    yield
    reset_db()


class TestLessonContentTTSFields:
    """Test that teacher_script, teacher_audio_url, teacher_timestamps columns work."""

    def test_lesson_content_tts_fields_default_empty(self):
        db = get_session()
        lesson = LessonContent(project_name="proj", knode_id=0)
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(project_name="proj", knode_id=0).first()
        assert found.teacher_script == ""
        assert found.teacher_audio_url == ""
        assert found.teacher_timestamps == ""
        db.close()

    def test_lesson_content_tts_fields_store_and_retrieve(self):
        db = get_session()
        timestamps = json.dumps([
            {"text": "hello", "begin_time": 0, "end_time": 300},
            {"text": "world", "begin_time": 300, "end_time": 600},
        ], ensure_ascii=False)

        lesson = LessonContent(
            project_name="proj",
            knode_id=1,
            status="ready",
            teacher_script="hello world",
            teacher_audio_url="proj/1/teacher.mp3",
            teacher_timestamps=timestamps,
        )
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(project_name="proj", knode_id=1).first()
        assert found.teacher_script == "hello world"
        assert found.teacher_audio_url == "proj/1/teacher.mp3"
        parsed = json.loads(found.teacher_timestamps)
        assert len(parsed) == 2
        assert parsed[0]["text"] == "hello"
        assert parsed[1]["end_time"] == 600
        db.close()


class TestLessonToDict:
    """Test that _lesson_to_dict includes TTS fields."""

    def test_lesson_to_dict_includes_tts_fields(self):
        from systemedu.education.lesson_generator import _lesson_to_dict

        db = get_session()
        lesson = LessonContent(
            project_name="proj",
            knode_id=0,
            status="ready",
            teacher_script="test script",
            teacher_audio_url="proj/0/teacher.mp3",
            teacher_timestamps='[{"text":"a","begin_time":0,"end_time":100}]',
        )
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(project_name="proj", knode_id=0).first()
        result = _lesson_to_dict(found)

        assert result["teacher_script"] == "test script"
        assert result["teacher_audio_url"] == "proj/0/teacher.mp3"
        assert '"text"' in result["teacher_timestamps"]
        db.close()

    def test_lesson_to_dict_empty_tts_fields(self):
        from systemedu.education.lesson_generator import _lesson_to_dict

        db = get_session()
        lesson = LessonContent(project_name="proj", knode_id=2, status="ready")
        db.add(lesson)
        db.commit()

        found = db.query(LessonContent).filter_by(project_name="proj", knode_id=2).first()
        result = _lesson_to_dict(found)

        assert result["teacher_script"] == ""
        assert result["teacher_audio_url"] == ""
        assert result["teacher_timestamps"] == "[]"
        db.close()


class TestTTSConfig:
    """Test TTSConfig in the config system."""

    def test_tts_config_defaults(self):
        from systemedu.core.config import SystemEduConfig

        config = SystemEduConfig()
        assert config.tts.enabled is True
        assert config.tts.model == "qwen3-tts-flash"
        assert config.tts.voice == "Cherry"

    def test_tts_config_custom(self):
        from systemedu.core.config import SystemEduConfig

        config = SystemEduConfig(tts={"enabled": False, "model": "qwen3-tts-instruct-flash", "voice": "Ethan"})
        assert config.tts.enabled is False
        assert config.tts.model == "qwen3-tts-instruct-flash"
        assert config.tts.voice == "Ethan"


class TestSynthesizeSpeech:
    """Test the synthesize_speech function with mocked DashScope SDK."""

    def _make_mock_dashscope(self, fake_audio: bytes, status_code: int = 200, audio_url: str = "http://fake-oss/audio.wav"):
        """Build a mock dashscope module with MultiModalConversation.call returning fake audio URL."""
        mock_response = MagicMock()
        mock_response.status_code = status_code
        mock_response.message = ""
        mock_response.output.audio = {"url": audio_url if status_code == 200 else ""}

        mock_dashscope = MagicMock()
        mock_dashscope.MultiModalConversation.call.return_value = mock_response
        return mock_dashscope, fake_audio

    def test_synthesize_speech_success(self, tmp_path, monkeypatch):
        """Test TTS synthesis with mocked qwen3-tts-flash API."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        fake_audio = b"RIFF" + b"\x00" * 100  # fake WAV header

        mock_dashscope, _ = self._make_mock_dashscope(fake_audio)

        with patch.dict("sys.modules", {"dashscope": mock_dashscope}):
            with patch("urllib.request.urlopen") as mock_urlopen:
                mock_urlopen.return_value.read.return_value = fake_audio

                import systemedu.education.tts as tts_module
                importlib.reload(tts_module)

                audio_path, timestamps = tts_module.synthesize_speech(
                    "你好世界", "test-proj", 0
                )

                assert audio_path == "test-proj/0/teacher.wav"
                assert timestamps == []  # qwen3-tts doesn't return word timestamps

                audio_file = tmp_path / "media" / "test-proj" / "0" / "teacher.wav"
                assert audio_file.exists()
                assert audio_file.read_bytes() == fake_audio

                # Verify correct model and voice were passed
                call_kwargs = mock_dashscope.MultiModalConversation.call.call_args
                assert call_kwargs.kwargs["model"] == "qwen3-tts-flash"
                assert call_kwargs.kwargs["voice"] == "Cherry"

        reset_config()

    def test_synthesize_speech_no_api_key_no_config(self, tmp_path, monkeypatch):
        """Test that missing API key from both env and config raises RuntimeError."""
        import importlib
        from systemedu.core.config import reset_config, SystemEduConfig

        monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        import systemedu.education.tts as tts_module
        importlib.reload(tts_module)

        empty_cfg = SystemEduConfig()
        with patch("systemedu.education.tts.get_config", return_value=empty_cfg):
            with pytest.raises(RuntimeError, match="No DashScope API key"):
                tts_module.synthesize_speech("test", "proj", 0)

        reset_config()

    def test_synthesize_speech_uses_config_api_key(self, tmp_path, monkeypatch):
        """Test that the qwen provider api_key is used as fallback when env var is absent."""
        import importlib
        from systemedu.core.config import reset_config, SystemEduConfig, LLMProviderConfig

        monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)

        cfg = SystemEduConfig()
        cfg.llm.providers["qwen"] = LLMProviderConfig(
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key="config-key-123",
            model="qwen-plus",
        )
        monkeypatch.setattr("systemedu.core.config._config", cfg)

        fake_audio = b"RIFF" + b"\x00" * 50

        mock_dashscope = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.output.audio = {"url": "http://fake/audio.wav"}
        mock_dashscope.MultiModalConversation.call.return_value = mock_response

        with patch.dict("sys.modules", {"dashscope": mock_dashscope}):
            with patch("urllib.request.urlopen") as mock_urlopen:
                mock_urlopen.return_value.read.return_value = fake_audio

                import systemedu.education.tts as tts_module
                importlib.reload(tts_module)

                audio_path, timestamps = tts_module.synthesize_speech("test", "proj", 1)

                assert audio_path == "proj/1/teacher.wav"
                # Verify the config key was passed
                call_kwargs = mock_dashscope.MultiModalConversation.call.call_args
                assert call_kwargs.kwargs["api_key"] == "config-key-123"
                assert timestamps == []

        reset_config()

    def test_synthesize_speech_api_error(self, tmp_path, monkeypatch):
        """Test that non-200 API response raises RuntimeError."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        mock_dashscope = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.message = "InvalidParameter"
        mock_dashscope.MultiModalConversation.call.return_value = mock_response

        with patch.dict("sys.modules", {"dashscope": mock_dashscope}):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            with pytest.raises(RuntimeError, match="TTS API error"):
                tts_module.synthesize_speech("test", "proj", 2)

        reset_config()

    def test_synthesize_speech_no_audio_url(self, tmp_path, monkeypatch):
        """Test that missing audio URL in response raises RuntimeError."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        mock_dashscope = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.output.audio = {"url": ""}
        mock_dashscope.MultiModalConversation.call.return_value = mock_response

        with patch.dict("sys.modules", {"dashscope": mock_dashscope}):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            with pytest.raises(RuntimeError, match="no audio URL"):
                tts_module.synthesize_speech("test", "proj", 3)

        reset_config()
