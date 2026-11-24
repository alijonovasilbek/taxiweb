"""service_requests.provider_id: foydalanuvchi o'chirilsa NULL bo'ladi

Revision ID: 004
Revises: 003
Create Date: 2026-11-24
"""

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_provider_id_fkey")
    op.execute("""ALTER TABLE service_requests ADD CONSTRAINT service_requests_provider_id_fkey
                  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL""")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS service_requests_provider_id_fkey")
    op.execute("""ALTER TABLE service_requests ADD CONSTRAINT service_requests_provider_id_fkey
                  FOREIGN KEY (provider_id) REFERENCES users(id)""")
