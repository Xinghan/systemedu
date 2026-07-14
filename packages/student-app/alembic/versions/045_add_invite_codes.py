"""045 add invite_codes table (spec 046)

Revision ID: 045_add_invite_codes
Revises: 044_add_badge_system
Create Date: 2026-07-14
"""
from alembic import op
import sqlalchemy as sa

revision = "045_add_invite_codes"
down_revision = "044_add_badge_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invite_codes",
        sa.Column("code", sa.String(16), primary_key=True),
        sa.Column("batch", sa.String(32), nullable=True),
        sa.Column("used_by", sa.String(36), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("invite_codes")
