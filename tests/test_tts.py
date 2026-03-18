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
        assert config.tts.model == "cosyvoice-v2"
        assert config.tts.voice == "longanyang"

    def test_tts_config_custom(self):
        from systemedu.core.config import SystemEduConfig

        config = SystemEduConfig(tts={"enabled": False, "model": "sambert-zhichu-v1", "voice": "zhichu"})
        assert config.tts.enabled is False
        assert config.tts.model == "sambert-zhichu-v1"
        assert config.tts.voice == "zhichu"


class TestSynthesizeSpeech:
    """Test the synthesize_speech function with mocked DashScope SDK."""

    def test_synthesize_speech_success(self, tmp_path, monkeypatch):
        """Test TTS synthesis with mocked HTTP SDK (dashscope.audio.tts)."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        fake_audio = b"\xff\xfb\x90\x00" * 100

        mock_result = MagicMock()
        mock_result.get_audio_data.return_value = fake_audio
        mock_result.get_timestamps.return_value = json.dumps([
            {"text": "你好", "begin_time": 0, "end_time": 300},
            {"text": "世界", "begin_time": 300, "end_time": 600},
        ])

        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = mock_result

        mock_tts_module = MagicMock()
        mock_tts_module.SpeechSynthesizer = mock_synthesizer

        mock_dashscope = MagicMock()

        with patch.dict("sys.modules", {
            "dashscope": mock_dashscope,
            "dashscope.audio": MagicMock(),
            "dashscope.audio.tts": mock_tts_module,
        }):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            audio_path, timestamps = tts_module.synthesize_speech(
                "你好世界", "test-proj", 0
            )

            assert audio_path == "test-proj/0/teacher.mp3"
            assert len(timestamps) == 2
            assert timestamps[0]["text"] == "你好"
            assert timestamps[0]["begin_time"] == 0
            assert timestamps[1]["text"] == "世界"
            assert timestamps[1]["end_time"] == 600

            audio_file = tmp_path / "media" / "test-proj" / "0" / "teacher.mp3"
            assert audio_file.exists()
            assert audio_file.read_bytes() == fake_audio

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

        # Patch get_config to return a config with no providers
        empty_cfg = SystemEduConfig()
        with patch("systemedu.education.tts.get_config", return_value=empty_cfg):
            with pytest.raises(RuntimeError, match="No DashScope API key"):
                tts_module.synthesize_speech("test", "proj", 0)

        reset_config()

    def test_synthesize_speech_uses_config_api_key(self, tmp_path, monkeypatch):
        """Test that the qwen provider api_key is used as fallback."""
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

        fake_audio = b"\xff\xfb" * 50
        mock_result = MagicMock()
        mock_result.get_audio_data.return_value = fake_audio
        mock_result.get_timestamps.return_value = "[]"

        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = mock_result
        mock_tts_module = MagicMock()
        mock_tts_module.SpeechSynthesizer = mock_synthesizer
        mock_dashscope = MagicMock()

        with patch.dict("sys.modules", {
            "dashscope": mock_dashscope,
            "dashscope.audio": MagicMock(),
            "dashscope.audio.tts": mock_tts_module,
        }):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            audio_path, timestamps = tts_module.synthesize_speech("test", "proj", 1)

            assert audio_path == "proj/1/teacher.mp3"
            # Verify dashscope.api_key was set to config key
            assert mock_dashscope.api_key == "config-key-123"
            assert timestamps == []

        reset_config()

    def test_synthesize_speech_no_audio_data(self, tmp_path, monkeypatch):
        """Test that empty audio data from SDK raises RuntimeError."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        mock_result = MagicMock()
        mock_result.get_audio_data.return_value = None
        mock_result.get_response.return_value = {"status_code": 400, "message": "error"}

        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = mock_result
        mock_tts_module = MagicMock()
        mock_tts_module.SpeechSynthesizer = mock_synthesizer

        with patch.dict("sys.modules", {
            "dashscope": MagicMock(),
            "dashscope.audio": MagicMock(),
            "dashscope.audio.tts": mock_tts_module,
        }):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            with pytest.raises(RuntimeError, match="no audio"):
                tts_module.synthesize_speech("test", "proj", 2)

        reset_config()

    def test_synthesize_speech_sambert_model_used_for_non_sambert_config(self, tmp_path, monkeypatch):
        """Test that non-sambert models in config fall back to sambert-zhichu-v1."""
        import importlib
        from systemedu.core.config import reset_config

        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        fake_audio = b"\xff\xfb" * 50
        mock_result = MagicMock()
        mock_result.get_audio_data.return_value = fake_audio
        mock_result.get_timestamps.return_value = "[]"

        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = mock_result
        mock_tts_module = MagicMock()
        mock_tts_module.SpeechSynthesizer = mock_synthesizer

        with patch.dict("sys.modules", {
            "dashscope": MagicMock(),
            "dashscope.audio": MagicMock(),
            "dashscope.audio.tts": mock_tts_module,
        }):
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            tts_module.synthesize_speech("test", "proj", 3)

            # Verify SpeechSynthesizer was called with sambert model
            call_kwargs = mock_synthesizer.call.call_args
            assert call_kwargs.kwargs["model"] == "sambert-zhichu-v1"
            assert call_kwargs.kwargs["voice"] == "zhichu"

        reset_config()
