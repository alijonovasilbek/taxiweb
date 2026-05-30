"""Initial schema with PostGIS

Revision ID: 001
Create Date: 2026-05-30
"""

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.execute("""
    CREATE TABLE users (
        id              SERIAL PRIMARY KEY,
        telegram_id     BIGINT UNIQUE NOT NULL,
        telegram_username VARCHAR(100),
        first_name      VARCHAR(100) NOT NULL,
        last_name       VARCHAR(100),
        phone           VARCHAR(20),
        avatar_url      TEXT,
        rating          DECIMAL(3,2) DEFAULT 5.00,
        total_rides     INTEGER DEFAULT 0,
        is_blocked      BOOLEAN DEFAULT FALSE,
        language        VARCHAR(5) DEFAULT 'uz',
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX idx_users_telegram_id ON users(telegram_id)")

    op.execute("""
    CREATE TABLE drivers (
        id                   SERIAL PRIMARY KEY,
        user_id              INTEGER REFERENCES users(id) ON DELETE SET NULL,
        telegram_id          BIGINT UNIQUE NOT NULL,
        first_name           VARCHAR(100) NOT NULL,
        last_name            VARCHAR(100) NOT NULL,
        phone                VARCHAR(20) NOT NULL,
        car_model            VARCHAR(100) NOT NULL,
        car_color            VARCHAR(50) NOT NULL,
        car_number           VARCHAR(20) NOT NULL UNIQUE,
        car_year             INTEGER,
        license_photo_url    TEXT,
        car_doc_photo_url    TEXT,
        status               VARCHAR(20) DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','blocked','rejected')),
        is_online            BOOLEAN DEFAULT FALSE,
        is_on_ride           BOOLEAN DEFAULT FALSE,
        current_location     GEOGRAPHY(POINT, 4326),
        last_location_update TIMESTAMP,
        rating               DECIMAL(3,2) DEFAULT 5.00,
        total_rides          INTEGER DEFAULT 0,
        total_earnings       DECIMAL(12,2) DEFAULT 0,
        balance              DECIMAL(12,2) DEFAULT 0,
        created_at           TIMESTAMP DEFAULT NOW(),
        updated_at           TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX idx_drivers_telegram_id ON drivers(telegram_id)")
    op.execute("CREATE INDEX idx_drivers_status ON drivers(status)")
    op.execute("CREATE INDEX idx_drivers_is_online ON drivers(is_online)")
    op.execute("CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location)")

    op.execute("""
    CREATE TABLE orders (
        id               SERIAL PRIMARY KEY,
        passenger_id     INTEGER REFERENCES users(id),
        driver_id        INTEGER REFERENCES drivers(id),
        pickup_address   TEXT NOT NULL,
        pickup_lat       DECIMAL(10,8) NOT NULL,
        pickup_lng       DECIMAL(11,8) NOT NULL,
        pickup_location  GEOGRAPHY(POINT, 4326),
        dropoff_address  TEXT NOT NULL,
        dropoff_lat      DECIMAL(10,8) NOT NULL,
        dropoff_lng      DECIMAL(11,8) NOT NULL,
        dropoff_location GEOGRAPHY(POINT, 4326),
        distance_km      DECIMAL(8,2),
        duration_min     INTEGER,
        route_polyline   TEXT,
        estimated_price  DECIMAL(10,2) NOT NULL,
        final_price      DECIMAL(10,2),
        status           VARCHAR(20) DEFAULT 'searching'
                         CHECK (status IN ('searching','accepted','driver_arrived','in_progress','completed','cancelled','no_drivers')),
        payment_method   VARCHAR(20) CHECK (payment_method IN ('cash','payme','click','telegram')),
        payment_status   VARCHAR(20) DEFAULT 'pending'
                         CHECK (payment_status IN ('pending','paid','refunded','failed')),
        payment_id       VARCHAR(100),
        requested_at     TIMESTAMP DEFAULT NOW(),
        accepted_at      TIMESTAMP,
        arrived_at       TIMESTAMP,
        started_at       TIMESTAMP,
        completed_at     TIMESTAMP,
        cancelled_at     TIMESTAMP,
        cancel_reason    TEXT,
        passenger_rated  BOOLEAN DEFAULT FALSE,
        driver_rated     BOOLEAN DEFAULT FALSE,
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX idx_orders_passenger_id ON orders(passenger_id)")
    op.execute("CREATE INDEX idx_orders_driver_id ON orders(driver_id)")
    op.execute("CREATE INDEX idx_orders_status ON orders(status)")
    op.execute("CREATE INDEX idx_orders_pickup_location ON orders USING GIST(pickup_location)")
    op.execute("CREATE INDEX idx_orders_created_at ON orders(created_at)")

    op.execute("""
    CREATE TABLE payments (
        id              SERIAL PRIMARY KEY,
        order_id        INTEGER REFERENCES orders(id),
        user_id         INTEGER REFERENCES users(id),
        amount          DECIMAL(12,2) NOT NULL,
        currency        VARCHAR(3) DEFAULT 'UZS',
        method          VARCHAR(20) NOT NULL CHECK (method IN ('cash','payme','click','telegram')),
        status          VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','processing','completed','failed','refunded')),
        external_id     VARCHAR(200),
        external_status VARCHAR(100),
        webhook_data    JSONB,
        initiated_at    TIMESTAMP DEFAULT NOW(),
        completed_at    TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX idx_payments_order_id ON payments(order_id)")
    op.execute("CREATE INDEX idx_payments_external_id ON payments(external_id)")

    op.execute("""
    CREATE TABLE ratings (
        id              SERIAL PRIMARY KEY,
        order_id        INTEGER REFERENCES orders(id),
        rater_id        INTEGER REFERENCES users(id),
        rated_driver_id INTEGER REFERENCES drivers(id),
        rated_user_id   INTEGER REFERENCES users(id),
        rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment         TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_order_rater UNIQUE(order_id, rater_id)
    )""")

    op.execute("""
    CREATE TABLE tariffs (
        id               SERIAL PRIMARY KEY,
        name             VARCHAR(50) NOT NULL,
        base_fare        DECIMAL(10,2) NOT NULL,
        per_km_price     DECIMAL(10,2) NOT NULL,
        per_min_price    DECIMAL(10,2) DEFAULT 0,
        min_fare         DECIMAL(10,2) NOT NULL,
        night_multiplier DECIMAL(4,2) DEFAULT 1.5,
        is_active        BOOLEAN DEFAULT TRUE,
        created_at       TIMESTAMP DEFAULT NOW()
    )""")

    op.execute("""
    CREATE TABLE notifications (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        driver_id  INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        type       VARCHAR(50) NOT NULL,
        title      TEXT,
        message    TEXT NOT NULL,
        data       JSONB,
        is_read    BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
    )""")

    op.execute("""
    CREATE TABLE driver_location_history (
        id          BIGSERIAL PRIMARY KEY,
        driver_id   INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
        order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        location    GEOGRAPHY(POINT, 4326) NOT NULL,
        recorded_at TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX idx_loc_history_location ON driver_location_history USING GIST(location)")

    # Default tariff
    op.execute("""
    INSERT INTO tariffs(name,base_fare,per_km_price,per_min_price,min_fare,night_multiplier,is_active)
    VALUES('Standard', 5000, 1500, 200, 10000, 1.5, true)
    """)


def downgrade() -> None:
    from alembic import op
    op.execute("DROP TABLE IF EXISTS driver_location_history CASCADE")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")
    op.execute("DROP TABLE IF EXISTS tariffs CASCADE")
    op.execute("DROP TABLE IF EXISTS ratings CASCADE")
    op.execute("DROP TABLE IF EXISTS payments CASCADE")
    op.execute("DROP TABLE IF EXISTS orders CASCADE")
    op.execute("DROP TABLE IF EXISTS drivers CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
