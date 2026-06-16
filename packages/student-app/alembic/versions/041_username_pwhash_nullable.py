"""041 username / password_hash 改 nullable

手机号+验证码注册后, 新用户只设 phone, 不写 username / password_hash。
但 040 迁移漏了把这两列从 NOT NULL 改 nullable, 导致生产新建号
INSERT 触发 NotNullViolation -> verify 返 500 (老用户登录不受影响,
因为他们记录早已存在不走 insert)。本迁移补上。

Revision ID: 041_username_pwhash_nullable
Revises: 040_add_phone_profile
"""
from alembic import op
import sqlalchemy as sa

revision = "041_username_pwhash_nullable"
down_revision = "040_add_phone_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "username", existing_type=sa.String(64), nullable=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    # 回滚需先确保无 NULL 行, 否则 ALTER 会失败; 这里仅形式还原
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=False)
    op.alter_column("users", "username", existing_type=sa.String(64), nullable=False)
