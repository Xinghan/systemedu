from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint

from ..db import Base, _uuid


class LearningDraft(Base):
    __tablename__ = "learning_drafts"
    __table_args__ = (
        UniqueConstraint("user_id", "scope_key", name="uq_learning_draft_scope"),
        Index("ix_learning_draft_course", "user_id", "library_slug", "module_id"),
    )
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    scope_key = Column(String(64), nullable=False)
    library_slug = Column(String(128), nullable=False)
    module_id = Column(String(128), nullable=False)
    activity_id = Column(String(128), nullable=False)
    kind = Column(String(16), nullable=False)
    content_version = Column(String(64), nullable=False)
    body = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    status = Column(String(16), nullable=False, default="draft")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class LearningSubmission(Base):
    __tablename__ = "learning_submissions"
    __table_args__ = (
        UniqueConstraint("user_id", "request_id", name="uq_learning_submission_request"),
        Index("ix_learning_submission_scope", "user_id", "scope_key", "created_at"),
    )
    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    scope_key = Column(String(64), nullable=False)
    library_slug = Column(String(128), nullable=False)
    module_id = Column(String(128), nullable=False)
    activity_id = Column(String(128), nullable=False)
    kind = Column(String(16), nullable=False)
    content_version = Column(String(64), nullable=False)
    request_id = Column(String(36), nullable=False)
    body = Column(JSON, nullable=False)
    revision = Column(Integer, nullable=False)
    # 客户端练习反馈在 body 中；正式成绩仅允许以后由服务端阅卷流程写入。
    grading_status = Column(String(24), nullable=False, default="ungraded")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
