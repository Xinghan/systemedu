"""044 add badge system tables (spec 042)

Revision ID: 044_add_badge_system
Revises: 043_add_user_llm_config
Create Date: 2026-07-02
"""
from alembic import op
import sqlalchemy as sa

revision = "044_add_badge_system"
down_revision = "043_add_user_llm_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_badges",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("chapter", sa.String(32), nullable=False),
        sa.Column("tier", sa.String(16), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("project_slug", sa.String(128), nullable=True),
        sa.Column("knode_id", sa.String(64), nullable=True),
        sa.Column("consumed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_badges_user_id", "user_badges", ["user_id"])
    op.create_index(
        "ix_user_badges_user_chapter", "user_badges", ["user_id", "chapter", "tier"]
    )

    op.create_table(
        "user_knode_badge_drops",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_slug", sa.String(128), nullable=False),
        sa.Column("knode_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_user_knode_badge_drops_user_id", "user_knode_badge_drops", ["user_id"]
    )
    op.create_unique_constraint(
        "uq_user_knode_badge_drop",
        "user_knode_badge_drops",
        ["user_id", "project_slug", "knode_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_user_knode_badge_drop", "user_knode_badge_drops", type_="unique"
    )
    op.drop_index("ix_user_knode_badge_drops_user_id", "user_knode_badge_drops")
    op.drop_table("user_knode_badge_drops")

    op.drop_index("ix_user_badges_user_chapter", "user_badges")
    op.drop_index("ix_user_badges_user_id", "user_badges")
    op.drop_table("user_badges")
