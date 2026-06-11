"""039 add grown_nodes + pending_growth (动态知识树生长)

Revision ID: 039_knowledge_growth
Revises: 038_knowledge_drills
Create Date: 2026-06-11
"""
from alembic import op
import sqlalchemy as sa

revision = "039_knowledge_growth"
down_revision = "038_knowledge_drills"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 用户个人知识树生长节点 (平台树第三层之下)
    op.create_table(
        "grown_nodes",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("node_id", sa.String(length=128), nullable=False),
        sa.Column("parent_id", sa.String(length=128), nullable=False),
        sa.Column("name_zh", sa.String(length=128), nullable=False),
        sa.Column("depth", sa.Integer(), nullable=False),
        sa.Column("lit", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "node_id", name="uq_grown_node_user_node"),
    )
    op.create_index("ix_grown_nodes_user", "grown_nodes", ["user_id"])

    # 生长评估队列
    op.create_table(
        "pending_growth",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("subject_hint", sa.String(length=32), nullable=True),
        sa.Column("enqueued_at", sa.DateTime(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pending"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_pending_growth_user_id", "pending_growth", ["user_id"])
    op.create_index(
        "idx_pg_status_enqueued", "pending_growth", ["status", "enqueued_at"],
        postgresql_where=sa.text("status IN ('pending','failed')"),
    )


def downgrade() -> None:
    op.drop_index("idx_pg_status_enqueued", table_name="pending_growth")
    op.drop_index("ix_pending_growth_user_id", table_name="pending_growth")
    op.drop_table("pending_growth")
    op.drop_index("ix_grown_nodes_user", table_name="grown_nodes")
    op.drop_table("grown_nodes")
