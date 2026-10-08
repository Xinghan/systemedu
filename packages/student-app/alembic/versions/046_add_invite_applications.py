"""046 add public invite applications

Revision ID: 046_add_invite_applications
Revises: 045_add_invite_codes
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa


revision = "046_add_invite_applications"
down_revision = "045_add_invite_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invite_applications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("phone", sa.String(11), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_invite_applications_phone",
        "invite_applications",
        ["phone"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_invite_applications_phone", table_name="invite_applications")
    op.drop_table("invite_applications")
