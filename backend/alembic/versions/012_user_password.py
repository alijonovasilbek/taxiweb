"""Ilova uchun login/parol (Telegram'siz kirish) — users.login, users.password_hash

Revision ID: 012
Revises: 011
Create Date: 2026-11-27
"""

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op

    # login doim kichik harflarda saqlanadi; password_hash — utils.row_to_dict API javoblaridan avtomatik olib tashlaydi
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS login VARCHAR(32)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMP")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login) WHERE login IS NOT NULL")


def downgrade() -> None:
    from alembic import op

    op.execute("DROP INDEX IF EXISTS idx_users_login")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_set_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS password_hash")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS login")
