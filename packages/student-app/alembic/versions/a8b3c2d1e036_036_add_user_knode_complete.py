"""036 add user_knode_complete table (spec 036)

Revision ID: a8b3c2d1e036
Revises: 000777b126df
Create Date: 2026-05-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a8b3c2d1e036"
down_revision: Union[str, None] = "000777b126df"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_knode_complete",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_slug", sa.String(length=128), nullable=False),
        sa.Column("knode_id", sa.String(length=64), nullable=False),
        sa.Column("library_version", sa.String(length=64), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "user_id", "project_slug", "knode_id",
            name="uq_user_knode_complete",
        ),
    )
    op.create_index(
        "ix_user_knode_complete_user_id", "user_knode_complete", ["user_id"]
    )
    op.create_index(
        "ix_user_knode_complete_user_slug",
        "user_knode_complete",
        ["user_id", "project_slug"],
    )


def downgrade() -> None:
    op.drop_index("ix_user_knode_complete_user_slug", table_name="user_knode_complete")
    op.drop_index("ix_user_knode_complete_user_id", table_name="user_knode_complete")
    op.drop_table("user_knode_complete")
