"""Baza vaqt mintaqasi — Asia/Tashkent

TIMESTAMP (tz'siz) ustunlarda NOW() mahalliy vaqtni yozishi uchun. Shunda created_at va
foydalanuvchi kiritgan vaqtlar (jo'nash, rejalashtirilgan ish) bir xil mintaqada bo'ladi,
CURRENT_DATE esa mahalliy kunni beradi.

Revision ID: 005
Revises: 004
Create Date: 2026-11-24
"""

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("""DO $$ BEGIN
        EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'Asia/Tashkent');
    END $$""")


def downgrade() -> None:
    from alembic import op
    op.execute("""DO $$ BEGIN
        EXECUTE format('ALTER DATABASE %I RESET timezone', current_database());
    END $$""")
