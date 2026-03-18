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

        config = SystemEduConfig(tts={"enabled": False, "model": "cosyvoice-v3-flash", "voice": "longxiaochun_v2"})
        assert config.tts.enabled is False
        assert config.tts.model == "cosyvoice-v3-flash"
        assert config.tts.voice == "longxiaochun_v2"


class TestSynthesizeSpeech:
    """Test the synthesize_speech function with mocked DashScope SDK."""

    def test_synthesize_speech_success(self, tmp_path, monkeypatch):
        """Test TTS synthesis with mocked SDK."""
        from systemedu.core.config import reset_config

        # Set up environment
        monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        # Mock the DashScope SDK
        mock_callback_instance = None

        class MockAudioFormat:
            MP3_22050HZ_MONO_256KBPS = "mp3_22050"

        class MockResultCallback:
            def on_data(self, data): pass
            def on_event(self, message): pass
            def on_complete(self): pass
            def on_error(self, message): pass
            def on_open(self): pass
            def on_close(self): pass

        class MockSynthesizer:
            def __init__(self, **kwargs):
                nonlocal mock_callback_instance
                mock_callback_instance = kwargs.get("callback")

            def call(self, text):
                # Simulate sending audio data and events
                if mock_callback_instance:
                    mock_callback_instance.on_data(b"\xff\xfb\x90\x00" * 10)
                    # Simulate word timestamp event
                    event = json.dumps({
                        "payload": {
                            "output": {
                                "sentence": {
                                    "words": [
                                        {"text": "hello", "begin_index": 0, "end_index": 5, "begin_time": 0, "end_time": 300},
                                        {"text": "world", "begin_index": 6, "end_index": 11, "begin_time": 300, "end_time": 600},
                                    ]
                                }
                            }
                        }
                    })
                    mock_callback_instance.on_event(event)
                    mock_callback_instance.on_complete()

        with patch.dict("sys.modules", {
            "dashscope": MagicMock(),
            "dashscope.audio": MagicMock(),
            "dashscope.audio.tts_v2": MagicMock(
                AudioFormat=MockAudioFormat,
                ResultCallback=MockResultCallback,
                SpeechSynthesizer=MockSynthesizer,
            ),
        }):
            # Re-import to pick up mocked modules
            import importlib
            import systemedu.education.tts as tts_module
            importlib.reload(tts_module)

            audio_path, timestamps = tts_module.synthesize_speech(
                "hello world", "test-proj", 0
            )

            assert audio_path == "test-proj/0/teacher.mp3"
            assert len(timestamps) == 2
            assert timestamps[0]["text"] == "hello"
            assert timestamps[0]["begin_time"] == 0
            assert timestamps[0]["end_time"] == 300
            assert timestamps[1]["text"] == "world"

            # Verify the audio file was created
            audio_file = tmp_path / "media" / "test-proj" / "0" / "teacher.mp3"
            assert audio_file.exists()
            assert audio_file.stat().st_size > 0

        reset_config()

    def test_synthesize_speech_no_api_key(self, tmp_path, monkeypatch):
        """Test that missing API key raises RuntimeError."""
        from systemedu.core.config import reset_config

        monkeypatch.delenv("DASHSCOPE_API_KEY", raising=False)
        monkeypatch.setattr("systemedu.core.config.SYSTEMEDU_HOME", tmp_path)
        reset_config()

        from systemedu.education.tts import synthesize_speech

        with pytest.raises(RuntimeError, match="DASHSCOPE_API_KEY"):
            synthesize_speech("test", "proj", 0)

        reset_config()
