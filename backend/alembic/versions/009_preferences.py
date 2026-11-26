"""Foydalanuvchi sozlamalari (asosiy sahifa vidjetlari va h.k.)

Revision ID: 009
Revises: 008
Create Date: 2026-11-25
"""

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS preferences")
