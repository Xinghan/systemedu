"""037 add chat_messages.source

Revision ID: 037_chat_msg_source
Revises: a8b3c2d1e036
Create Date: 2026-06-08
"""
from typing import Union

from alembic import op
import sqlalchemy as sa

revision: str = "037_chat_msg_source"
down_revision: Union[str, None] = "a8b3c2d1e036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("source", sa.String(length=32), nullable=False, server_default="chat"),
    )


def downgrade() -> None:
    op.drop_column("chat_messages", "source")
