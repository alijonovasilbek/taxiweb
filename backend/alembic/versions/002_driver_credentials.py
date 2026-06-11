"""Add driver login credentials

Revision ID: 002
Revises: 001
Create Date: 2026-06-11
"""

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op

    op.execute("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_login VARCHAR(100)")
    op.execute("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS password_hash TEXT")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_driver_login ON drivers(driver_login)")


def downgrade() -> None:
    from alembic import op

    op.execute("DROP INDEX IF EXISTS idx_drivers_driver_login")
    op.execute("ALTER TABLE drivers DROP COLUMN IF EXISTS password_hash")
    op.execute("ALTER TABLE drivers DROP COLUMN IF EXISTS driver_login")
