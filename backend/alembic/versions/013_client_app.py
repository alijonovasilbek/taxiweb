"""Mijoz ilovasi ("Chortoq"): qurilma va kirish kodi qaysi ilovaga tegishli (push to'g'ri ilovaga borsin)

Revision ID: 013
Revises: 012
Create Date: 2026-11-27
"""

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE devices ADD COLUMN IF NOT EXISTS app VARCHAR(10) NOT NULL DEFAULT 'driver'")
    op.execute("ALTER TABLE app_login_codes ADD COLUMN IF NOT EXISTS app VARCHAR(10) NOT NULL DEFAULT 'driver'")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE app_login_codes DROP COLUMN IF EXISTS app")
    op.execute("ALTER TABLE devices DROP COLUMN IF EXISTS app")
