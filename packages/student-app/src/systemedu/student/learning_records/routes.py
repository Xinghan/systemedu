"""带版本保护的草稿、幂等提交与不可变历史；身份仅从登录态获取。"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..auth.deps import require_login
from ..db import get_session, _uuid, ExerciseAttempt
from .models import LearningDraft, LearningSubmission

log = logging.getLogger(__name__)
LIMIT = 256_000
Kind = Literal["classroom", "assignment", "quiz", "exam"]


class Scope(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    library_slug: str = Field(min_length=1, max_length=128)
    module_id: str = Field(min_length=1, max_length=128)
    activity_id: str = Field(min_length=1, max_length=128)
    kind: Kind
    content_version: str = Field(min_length=1, max_length=64)


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: str = Field(min_length=1, max_length=128)
    question: str = Field(max_length=10000)
    answer: str = Field(max_length=20000)


class Body(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: list[Answer] = Field(max_length=200)
    artifact: dict | None = None
    # 可恢复练习用时、选择等；不接受顶层 score / passed 等官方成绩声明。
    client_context: dict = Field(default_factory=dict)


class Save(Scope):
    body: Body
    expected_revision: int = Field(ge=0, strict=True)


class Submit(Save):
    request_id: UUID


class Conflict(Exception):
    pass


def scope_fields(value: Scope) -> dict:
    return value.model_dump(include=set(Scope.model_fields))


def scope_key(scope: dict) -> str:
    return hashlib.sha256(json.dumps(scope, sort_keys=True).encode()).hexdigest()


def serialize(row) -> dict:
    result = {field: getattr(row, field) for field in Scope.model_fields}
    result.update(id=row.id, body=row.body, revision=row.revision)
    if isinstance(row, LearningDraft):
        result.update(status=row.status, updated_at=row.updated_at.isoformat() + "Z")
    else:
        result.update(request_id=row.request_id, grading_status=row.grading_status,
                      created_at=row.created_at.isoformat() + "Z")
    return result


def read_records(user_id: str, scope: Scope) -> dict:
    key = scope_key(scope_fields(scope))
    with get_session() as session:
        draft = session.scalar(select(LearningDraft).where(
            LearningDraft.user_id == user_id, LearningDraft.scope_key == key))
        submissions = session.scalars(select(LearningSubmission).where(
            LearningSubmission.user_id == user_id, LearningSubmission.scope_key == key
        ).order_by(LearningSubmission.created_at.desc(), LearningSubmission.id.desc()).limit(50)).all()
        return {"draft": serialize(draft) if draft else None,
                "submissions": [serialize(row) for row in submissions]}


def write_record(user_id: str, payload: Save, submit: bool) -> dict:
    scope = scope_fields(payload)
    key, body = scope_key(scope), payload.body.model_dump()
    request_id = str(payload.request_id) if isinstance(payload, Submit) else None
    with get_session() as session:
        # 重试必须在版本检查前识别；网络断开后重复提交返回同一个快照。
        if submit:
            existing = session.scalar(select(LearningSubmission).where(
                LearningSubmission.user_id == user_id, LearningSubmission.request_id == request_id))
            if existing:
                if existing.scope_key != key or existing.body != body:
                    raise Conflict("提交标识已用于其他内容，请重新载入记录。")
                return {"submission": serialize(existing), "replayed": True}
        draft = session.scalar(select(LearningDraft).where(
            LearningDraft.user_id == user_id, LearningDraft.scope_key == key))
        revision = payload.expected_revision + 1
        values = dict(body=body, revision=revision, status="submitted" if submit else "draft", updated_at=datetime.utcnow())
        if draft is None:
            if payload.expected_revision != 0:
                raise Conflict("草稿版本已变化，请先读取服务器记录。")
            draft = LearningDraft(id=_uuid(), user_id=user_id, scope_key=key, **scope, **values)
            session.add(draft)
        else:
            changed = session.execute(update(LearningDraft).where(
                LearningDraft.id == draft.id, LearningDraft.user_id == user_id,
                LearningDraft.revision == payload.expected_revision,
            ).values(**values)).rowcount
            if changed != 1:
                if submit:
                    previous = session.scalar(select(LearningSubmission).where(
                        LearningSubmission.user_id == user_id, LearningSubmission.request_id == request_id))
                    if previous and previous.scope_key == key and previous.body == body:
                        return {"submission": serialize(previous), "replayed": True}
                raise Conflict("另一页面或设备已保存新版本；当前内容没有覆盖它。")
        submission = None
        if submit:
            submission = LearningSubmission(id=_uuid(), user_id=user_id, scope_key=key,
                request_id=request_id, **scope, body=body, revision=revision,
                grading_status="ungraded", created_at=datetime.utcnow())
            session.add(submission)
            # 保留 AI 导师原来的练习历史来源。正误只是客户端练习自检，
            # 不写入正式成绩；考试不接受客户端正误判定。
            if payload.kind in ("quiz", "assignment"):
                feedback = payload.body.client_context.get("practice_feedback")
                correct = feedback.get("correct") if isinstance(feedback, dict) else None
                if type(correct) is not bool:
                    correct = None
                for answer in payload.body.answers:
                    session.add(ExerciseAttempt(user_id=user_id, library_slug=payload.library_slug,
                        module_id=payload.module_id, idea_id=answer.question_id,
                        question=answer.question, student_answer=answer.answer, correct=correct,
                        explanation_shown="客户端练习自检；正式提交尚未评分。"))
        try:
            session.flush()
            # 在事务持有版本锁时拍下返回值，避免提交后 refresh 读到别的设备的新写入。
            result = {"draft": serialize(draft)}
            if submission:
                result.update(submission=serialize(submission), replayed=False)
            session.commit()
        except IntegrityError:
            session.rollback()
            if submit:
                previous = session.scalar(select(LearningSubmission).where(
                    LearningSubmission.user_id == user_id, LearningSubmission.request_id == request_id))
                if previous and previous.scope_key == key and previous.body == body:
                    return {"submission": serialize(previous), "replayed": True}
            raise Conflict("记录刚被其他请求更新，请重新载入后核对。")
        return result


def response(data, status=200):
    return JSONResponse(data, status_code=status, headers={"Cache-Control": "no-store"})


async def records(request: Request):
    user_id, error = await require_login(request)
    if error:
        return error
    try:
        scope = Scope.model_validate(dict(request.query_params))
    except ValidationError:
        return response({"error": "invalid_scope", "message": "请提供课程、节点、活动、类型和内容版本。"}, 400)
    try:
        return response(await run_in_threadpool(read_records, user_id, scope))
    except Exception as exc:
        log.error('learning record read failed (%s)', type(exc).__name__)
        return response({"error": "read_failed", "message": "暂时无法读取账号记录，请保留当前草稿后重试。"}, 503)


async def save_record(request: Request):
    user_id, error = await require_login(request)
    if error:
        return error
    submit = request.url.path.endswith('/submissions')
    try:
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > LIMIT:
                return response({"error": "too_large", "message": "记录过大，请减少附件或文本内容。"}, 413)
        payload = (Submit if submit else Save).model_validate_json(raw)
        ids = [answer.question_id for answer in payload.body.answers]
        if len(ids) != len(set(ids)):
            raise ValueError('duplicate questions')
        if submit and (not ids or any(not a.answer.strip() for a in payload.body.answers)):
            raise ValueError('empty submission')
    except (ValidationError, ValueError):
        return response({"error": "invalid_record", "message": "记录格式不正确；提交时需填写各题答案。"}, 400)
    try:
        saved = await run_in_threadpool(write_record, user_id, payload, submit)
        return response(saved, 201 if submit and not saved.get('replayed') else 200)
    except Conflict as exc:
        return response({"error": "revision_conflict", "message": str(exc)}, 409)
    except Exception as exc:
        # 数据库异常可能包含 SQL 参数（学生答案），不把参数写入服务日志。
        log.error('learning record persistence failed (%s)', type(exc).__name__)
        return response({"error": "save_failed", "message": "服务器暂时未能保存，请保留草稿后重试。"}, 503)


ROUTES = [
    Route('/api/learning/records', records, methods=['GET']),
    Route('/api/learning/drafts', save_record, methods=['PUT']),
    Route('/api/learning/submissions', save_record, methods=['POST']),
]
