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


# ---------------------------------------------------------------------------
# /api/auth/* 端点 (TDD 第 6 任务) — 进程内 asgi_client (async)
#
# asgi_client 是进程内 ASGITransport (httpx AsyncClient), 与测试同进程, 故:
#   - 上面 autouse 的 _redis 注入的 fakeredis 单例被路由内部 cache.get_cache() 命中;
#   - 验证码可直接从同一 fakeredis 读出。
# ---------------------------------------------------------------------------

import importlib  # noqa: E402

from systemedu.student.sms import aliyun  # noqa: E402


@pytest.fixture(autouse=True)
def _sms_debug(monkeypatch):
    """发码走 debug 不真发。reload 会就地刷新 aliyun 模块 __dict__ 里的 DEBUG,
    routes 持有的 send_sms_code 引用闭包同一 __dict__, 故仍返 True。"""
    monkeypatch.setenv("ALIYUN_SMS_DEBUG", "true")
    importlib.reload(aliyun)
    yield


async def test_send_code_then_verify_new_user(asgi_client):
    r = await asgi_client.post("/api/auth/send-code", json={"phone": "13800138000"})
    assert r.status_code == 200 and r.json()["ok"] is True
    raw = await cache.get_cache().get("sms:code:13800138000")
    code = raw.decode()
    r2 = await asgi_client.post(
        "/api/auth/verify", json={"phone": "13800138000", "code": code}
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["token"] and body["profile_completed"] is False


async def test_send_code_bad_phone(asgi_client):
    r = await asgi_client.post("/api/auth/send-code", json={"phone": "12345"})
    assert r.status_code == 400


async def test_send_code_cooldown(asgi_client):
    await asgi_client.post("/api/auth/send-code", json={"phone": "13800138002"})
    r = await asgi_client.post("/api/auth/send-code", json={"phone": "13800138002"})
    assert r.status_code == 429


async def test_verify_wrong_code(asgi_client):
    await asgi_client.post("/api/auth/send-code", json={"phone": "13800138003"})
    r = await asgi_client.post(
        "/api/auth/verify", json={"phone": "13800138003", "code": "000000"}
    )
    assert r.status_code == 401


async def test_verify_existing_user_keeps_profile(asgi_client):
    """已建号且 profile 已补全的用户再次验证登录, profile_completed 应保持 True。"""
    await asgi_client.post("/api/auth/send-code", json={"phone": "13800138004"})
    code = (await cache.get_cache().get("sms:code:13800138004")).decode()
    r = await asgi_client.post(
        "/api/auth/verify", json={"phone": "13800138004", "code": code}
    )
    token = r.json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    rp = await asgi_client.patch(
        "/api/auth/profile",
        headers=H,
        json={"display_name": "小红", "student_age": 11, "gender": "female"},
    )
    assert rp.status_code == 200 and rp.json()["profile_completed"] is True
    # me 返回 phone + profile
    rm = await asgi_client.get("/api/auth/me", headers=H)
    assert rm.status_code == 200
    me = rm.json()
    assert me["phone"] == "13800138004"
    assert me["display_name"] == "小红" and me["student_age"] == 11
    assert me["gender"] == "female" and me["profile_completed"] is True
    # 二次登录 (同手机号, 走 existing-user 分支) profile_completed 仍 True。
    # 清掉 60s 冷却键再重发 (否则同一测试内 send-code 命中 429)。
    await cache.get_cache().delete("sms:cooldown:13800138004")
    await asgi_client.post("/api/auth/send-code", json={"phone": "13800138004"})
    code2 = (await cache.get_cache().get("sms:code:13800138004")).decode()
    r2 = await asgi_client.post(
        "/api/auth/verify", json={"phone": "13800138004", "code": code2}
    )
    assert r2.json()["profile_completed"] is True


async def test_profile_requires_login(asgi_client):
    r = await asgi_client.patch(
        "/api/auth/profile",
        json={"display_name": "x", "student_age": 10, "gender": "male"},
    )
    assert r.status_code == 401


async def test_profile_bad_age(asgi_client):
    await asgi_client.post("/api/auth/send-code", json={"phone": "13800138005"})
    code = (await cache.get_cache().get("sms:code:13800138005")).decode()
    token = (
        await asgi_client.post(
            "/api/auth/verify", json={"phone": "13800138005", "code": code}
        )
    ).json()["token"]
    H = {"Authorization": f"Bearer {token}"}
    r = await asgi_client.patch(
        "/api/auth/profile",
        headers=H,
        json={"display_name": "x", "student_age": 99, "gender": "male"},
    )
    assert r.status_code == 400


async def test_old_register_removed(asgi_client):
    r = await asgi_client.post(
        "/api/auth/register", json={"username": "x", "password": "yyyyyy"}
    )
    assert r.status_code in (404, 405)


async def test_old_login_removed(asgi_client):
    r = await asgi_client.post(
        "/api/auth/login", json={"username": "x", "password": "yyyyyy"}
    )
    assert r.status_code in (404, 405)
