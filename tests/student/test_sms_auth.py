import pytest
import fakeredis.aioredis
from systemedu.student import cache
from systemedu.student.sms import codes


@pytest.fixture(autouse=True)
def _redis():
    cache.replace_client_for_tests(fakeredis.aioredis.FakeRedis())
    yield


@pytest.mark.asyncio
async def test_generate_and_verify_code():
    code = await codes.issue_code("13800138000")
    assert len(code) == 6 and code.isdigit()
    assert await codes.verify_code("13800138000", code) is True
    # 一次性：再验证失败
    assert await codes.verify_code("13800138000", code) is False


@pytest.mark.asyncio
async def test_wrong_code_rejected():
    await codes.issue_code("13800138000")
    assert await codes.verify_code("13800138000", "000000") is False


@pytest.mark.asyncio
async def test_cooldown():
    await codes.issue_code("13800138000")
    assert await codes.in_cooldown("13800138000") is True
    assert await codes.in_cooldown("13900139000") is False


def test_send_sms_code_debug_mode(monkeypatch, caplog):
    """debug=true 不调阿里云, 打日志返回 True。"""
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")
    from systemedu.student.sms import aliyun
    import importlib; importlib.reload(aliyun)
    assert aliyun.send_sms_code("13800138000", "123456") is True


def test_send_sms_code_calls_aliyun(monkeypatch):
    """非 debug: 构造 client 调 send_sms。mock 掉真实 SDK 调用。"""
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "false")
    monkeypatch.setenv("ALIYUN_SMS_KEY", "testkey")
    monkeypatch.setenv("ALIYUN_SMS_SECRET", "testsecret")
    from systemedu.student.sms import aliyun
    import importlib; importlib.reload(aliyun)

    calls = {}
    class FakeResp:
        def __init__(self): self.body = type("B", (), {"code": "OK"})()
    def fake_send(self, req):
        calls["phone"] = req.phone_numbers
        calls["param"] = req.template_param
        return FakeResp()
    monkeypatch.setattr(aliyun, "_build_client", lambda: type("C", (), {"send_sms": fake_send})())

    assert aliyun.send_sms_code("13800138000", "123456") is True
    assert calls["phone"] == "13800138000"
    assert "123456" in calls["param"]


# ---------------------------------------------------------------------------
# 手机号 + profile DB 列/函数 (TDD 第 4 任务)
# ---------------------------------------------------------------------------

@pytest.fixture
def student_db(tmp_path, monkeypatch):
    """SQLite 临时库, 照 test_user_knode_complete.py 的同步 DB 测试模式."""
    db_file = tmp_path / "student.db"
    monkeypatch.setenv("STUDENT_DB_URL", f"sqlite:///{db_file}")
    from systemedu.student import db
    db.reset_engine_for_tests()
    db.init_db()
    yield db
    db.reset_engine_for_tests()


def test_create_and_get_user_by_phone(student_db):
    from systemedu.student import db
    u = db.create_user_by_phone("13800138000")
    assert u.phone == "13800138000"
    assert u.profile_completed is False
    got = db.get_user_by_phone("13800138000")
    assert got is not None and got.id == u.id


def test_update_profile(student_db):
    from systemedu.student import db
    u = db.create_user_by_phone("13800138001")
    db.update_profile(u.id, display_name="小明", student_age=12, gender="male")
    got = db.get_user_by_id(u.id)
    assert got.display_name == "小明" and got.student_age == 12
    assert got.gender == "male" and got.profile_completed is True
