"""042 add project_requests table (spec 038)

Revision ID: 042_add_project_requests
Revises: 041_username_pwhash_nullable
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "042_add_project_requests"
down_revision = "041_username_pwhash_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("idea_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_project_requests_user_id", "project_requests", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_project_requests_user_id", "project_requests")
    op.drop_table("project_requests")
