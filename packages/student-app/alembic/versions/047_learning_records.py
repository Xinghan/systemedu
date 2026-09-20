"""课堂、作业、测验、考试草稿及不可变提交。

从已提交的 045 分支，避免依赖其他功能尚未提交的 046。
运行时 upgrade heads 支持独立增量迁移同时存在。
"""
from alembic import op
import sqlalchemy as sa

revision = '047_learning_records'
down_revision = '045_add_invite_codes'
branch_labels = ('learning_records',)
depends_on = None


def _scope_columns():
    return [sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('scope_key', sa.String(64), nullable=False),
        sa.Column('library_slug', sa.String(128), nullable=False),
        sa.Column('module_id', sa.String(128), nullable=False),
        sa.Column('activity_id', sa.String(128), nullable=False),
        sa.Column('kind', sa.String(16), nullable=False),
        sa.Column('content_version', sa.String(64), nullable=False),
        sa.Column('body', sa.JSON(), nullable=False),
        sa.Column('revision', sa.Integer(), nullable=False)]


def upgrade():
    op.create_table('learning_drafts', *_scope_columns(),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'scope_key', name='uq_learning_draft_scope'))
    op.create_index('ix_learning_draft_course', 'learning_drafts', ['user_id', 'library_slug', 'module_id'])
    op.create_table('learning_submissions', *_scope_columns(),
        sa.Column('request_id', sa.String(36), nullable=False),
        sa.Column('grading_status', sa.String(24), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'request_id', name='uq_learning_submission_request'))
    op.create_index('ix_learning_submission_scope', 'learning_submissions', ['user_id', 'scope_key', 'created_at'])


def downgrade():
    op.drop_table('learning_submissions')
    op.drop_table('learning_drafts')
