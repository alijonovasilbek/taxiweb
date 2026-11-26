"""Saqlangan manzillar (Uy, Ish) — foydalanuvchi profilida

Revision ID: 007
Revises: 006
Create Date: 2026-11-25
"""

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_places JSONB NOT NULL DEFAULT '{}'::jsonb")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS saved_places")
