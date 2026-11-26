"""Mashhur joylar (admin boshqaradi, qidiruvda birinchi) va admin harakatlari jurnali

Revision ID: 008
Revises: 007
Create Date: 2026-11-25
"""

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("""
    CREATE TABLE IF NOT EXISTS popular_places (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(200) NOT NULL,
        address    VARCHAR(300),
        lat        DOUBLE PRECISION NOT NULL,
        lng        DOUBLE PRECISION NOT NULL,
        is_active  BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("""
    CREATE TABLE IF NOT EXISTS admin_audit (
        id          BIGSERIAL PRIMARY KEY,
        telegram_id BIGINT,
        method      VARCHAR(10) NOT NULL,
        path        VARCHAR(300) NOT NULL,
        status      SMALLINT NOT NULL,
        ip          VARCHAR(64),
        created_at  TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(created_at DESC)")


def downgrade() -> None:
    from alembic import op
    op.execute("DROP TABLE IF EXISTS admin_audit")
    op.execute("DROP TABLE IF EXISTS popular_places")
