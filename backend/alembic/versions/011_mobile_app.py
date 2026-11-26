"""Chortoq Ijrochi (Android ilova): Telegram orqali kirish, sessiyalar, qurilmalar (push), buyurtma takliflari

- app_login_codes: ilova so'ragan bir martalik kod; bot `/start login_<kod>` orqali tasdiqlaydi
- app_sessions:    har bir qurilmaning refresh tokeni (faqat xeshi saqlanadi), aylanma (rotation) bilan
- devices:         FCM token, model, Android va ilova versiyasi
- order_offers:    taksi buyurtmasini haydovchilarga ketma-ket taklif qilish tarixi (PLAN-ANDROID B7)

Revision ID: 011
Revises: 010
Create Date: 2026-11-26
"""

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op

    op.execute("""
        CREATE TABLE IF NOT EXISTS app_login_codes (
            code_hash    VARCHAR(64) PRIMARY KEY,
            device_id    VARCHAR(100) NOT NULL,
            device_name  VARCHAR(120),
            user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status       VARCHAR(12) NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','denied','consumed')),
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at   TIMESTAMPTZ NOT NULL
        )""")
    op.execute("""
        CREATE TABLE IF NOT EXISTS app_sessions (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_id     VARCHAR(100) NOT NULL,
            device_name   VARCHAR(120),
            refresh_hash  VARCHAR(64) NOT NULL UNIQUE,
            prev_hash     VARCHAR(64),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_used_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at    TIMESTAMPTZ NOT NULL,
            revoked_at    TIMESTAMPTZ
        )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_app_sessions_user ON app_sessions(user_id) WHERE revoked_at IS NULL")
    op.execute("CREATE INDEX IF NOT EXISTS idx_app_sessions_prev ON app_sessions(prev_hash)")
    op.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            id           SERIAL PRIMARY KEY,
            user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_id    VARCHAR(100) NOT NULL UNIQUE,
            fcm_token    TEXT,
            platform     VARCHAR(20) NOT NULL DEFAULT 'android',
            model        VARCHAR(120),
            os_version   VARCHAR(40),
            app_version  VARCHAR(40),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_fcm ON devices(fcm_token) WHERE fcm_token IS NOT NULL")
    op.execute("""
        CREATE TABLE IF NOT EXISTS order_offers (
            id           SERIAL PRIMARY KEY,
            order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            driver_id    INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
            status       VARCHAR(12) NOT NULL DEFAULT 'offered'
                         CHECK (status IN ('offered','accepted','rejected','expired','cancelled')),
            distance_km  NUMERIC(8,2),
            offered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            answered_at  TIMESTAMPTZ,
            UNIQUE (order_id, driver_id)
        )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_order_offers_open ON order_offers(order_id) WHERE status='offered'")


def downgrade() -> None:
    from alembic import op
    for t in ("order_offers", "devices", "app_sessions", "app_login_codes"):
        op.execute(f"DROP TABLE IF EXISTS {t}")
