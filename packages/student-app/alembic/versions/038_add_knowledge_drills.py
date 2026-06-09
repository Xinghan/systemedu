"""038 add knowledge_drills

Revision ID: 038_knowledge_drills
Revises: 037_chat_msg_source
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "038_knowledge_drills"
down_revision = "037_chat_msg_source"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_drills",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("library_slug", sa.String(length=128), nullable=False),
        sa.Column("module_id", sa.String(length=64), nullable=False),
        sa.Column("highlight_text", sa.Text(), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_knowledge_drills_user_slug_module", "knowledge_drills",
                    ["user_id", "library_slug", "module_id"])
    op.create_index("ix_knowledge_drills_user_id", "knowledge_drills", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_drills_user_id", table_name="knowledge_drills")
    op.drop_index("ix_knowledge_drills_user_slug_module", table_name="knowledge_drills")
    op.drop_table("knowledge_drills")
