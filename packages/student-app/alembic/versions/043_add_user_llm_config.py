"""043 add user_llm_config table (spec 040)

Revision ID: 043_add_user_llm_config
Revises: 042_add_project_requests
Create Date: 2026-06-29
"""
from alembic import op
import sqlalchemy as sa

revision = "043_add_user_llm_config"
down_revision = "042_add_project_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_llm_config",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False, server_default="default"),
        sa.Column("base_url", sa.String(512), nullable=True),
        sa.Column("api_key_enc", sa.Text(), nullable=True),
        sa.Column("model", sa.String(128), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_user_llm_config_user_id", "user_llm_config", ["user_id"])
    op.create_unique_constraint("uq_user_llm_config", "user_llm_config", ["user_id"])


def downgrade() -> None:
    op.drop_constraint("uq_user_llm_config", "user_llm_config", type_="unique")
    op.drop_index("ix_user_llm_config_user_id", "user_llm_config")
    op.drop_table("user_llm_config")
