"""Ro'yxatdan o'tish (onboarding): tasdiqlangan telefon va birinchi kirish belgisi

phone_verified — raqam Telegram orqali ulashilgan (requestContact yoki bot kontakti).
onboarded_at   — foydalanuvchi xush kelibsiz bosqichlarini tugatgan vaqt.

Revision ID: 006
Revises: 005
Create Date: 2026-11-25
"""

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS onboarded_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS phone_verified")
