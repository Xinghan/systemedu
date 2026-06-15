"""040 add phone + profile columns, migrate legacy users

Revision ID: 040_add_phone_profile
Revises: 039_knowledge_growth
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = "040_add_phone_profile"
down_revision = "039_knowledge_growth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(11), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("student_age", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("gender", sa.String(16), nullable=True))
    op.add_column("users", sa.Column("profile_completed", sa.Boolean(),
                                     nullable=False, server_default=sa.false()))
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.create_index("ix_users_phone", "users", ["phone"])

    # 老用户回填: username -> display_name, profile_completed=true, 占位手机号
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, username FROM users ORDER BY created_at")).fetchall()
    seq = 1
    for uid, uname in rows:
        if uname == "xinghan":
            phone = "17744529940"
        else:
            phone = f"{seq:011d}"  # 占位假号 00000000001..
            seq += 1
        conn.execute(sa.text(
            "UPDATE users SET phone=:p, display_name=:d, profile_completed=true WHERE id=:i"
        ), {"p": phone, "d": uname, "i": uid})


def downgrade() -> None:
    op.drop_index("ix_users_phone", "users")
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    for col in ("profile_completed", "gender", "student_age", "display_name", "phone"):
        op.drop_column("users", col)
