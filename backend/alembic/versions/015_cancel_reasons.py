"""Bekor qilish sababi kodi va kim bekor qilgani (analitika uchun)

Revision ID: 015
Revises: 014
Create Date: 2026-11-28
"""

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason_code VARCHAR(30)")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by VARCHAR(10)")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS cancelled_by")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS cancel_reason_code")
