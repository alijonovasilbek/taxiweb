"""Chortoq Services: multi-role, multi-service schema

Revision ID: 003
Revises: 002
Create Date: 2026-11-24
"""

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op

    # ── Users: bir nechta rol ────────────────────────────────────────────────
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['client']::TEXT[]")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(200)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_rating DECIMAL(3,2) DEFAULT 5.00")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_reviews INTEGER DEFAULT 0")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location GEOGRAPHY(POINT, 4326)")

    # ── Servislar katalogi ──────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS service_types (
        code        VARCHAR(30) PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        description TEXT,
        icon        VARCHAR(10),
        is_active   BOOLEAN DEFAULT TRUE,
        sort_order  INTEGER DEFAULT 0
    )""")
    op.execute("""
    INSERT INTO service_types(code,name,description,icon,is_active,sort_order) VALUES
      ('taxi','Taksi','Shahar va tuman ichida tez va qulay transport','🚕',true,1),
      ('carpool','Po''puti','Doimiy qatnov, bo''sh o''rinlarni baham ko''rish','🚐',true,2),
      ('cargo','Yuk tashish','Labo, Gazel, Isuzu va boshqalar bilan yuk tashish','🚚',true,3),
      ('equipment','Spets texnika','Ekskavator, buldozer, kran, yuklagich','🚜',true,4),
      ('agro','Qishloq xo''jaligi texnikasi','Traktor, kombayn va boshqalar','🌾',false,5),
      ('courier','Kuryer / Yetkazib berish','Kichik yuklarni yetkazish','📦',false,6),
      ('rental','Ijaraga transport','Kunlik / soatlik ijara','🔑',false,7),
      ('corporate','Korporativ','Korxonalar uchun xizmatlar','🏢',false,8)
    ON CONFLICT (code) DO NOTHING
    """)

    # ── Transport va texnika ────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        id              SERIAL PRIMARY KEY,
        owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category        VARCHAR(30) NOT NULL,
        model           VARCHAR(100) NOT NULL,
        plate_number    VARCHAR(20),
        color           VARCHAR(50),
        year            INTEGER,
        seats           INTEGER,
        capacity_kg     INTEGER,
        volume_m3       DECIMAL(6,2),
        description     TEXT,
        photo_url       TEXT,
        price_per_km    DECIMAL(10,2),
        price_per_hour  DECIMAL(10,2),
        price_per_shift DECIMAL(10,2),
        price_per_day   DECIMAL(10,2),
        status          VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','blocked')),
        reject_reason   TEXT,
        is_available    BOOLEAN DEFAULT TRUE,
        location        GEOGRAPHY(POINT, 4326),
        location_address TEXT,
        location_updated_at TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles(category)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vehicles_location ON vehicles USING GIST(location)")

    # ── Hujjatlar ───────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS user_documents (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        doc_type    VARCHAR(30) NOT NULL,
        file_url    TEXT NOT NULL,
        status      VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
        created_at  TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_documents_user ON user_documents(user_id)")

    # ── Jadval va bo'sh vaqtlar ─────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS availability (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id  INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
        weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        start_time  TIME NOT NULL,
        end_time    TIME NOT NULL,
        CHECK (end_time > start_time)
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_availability_user ON availability(user_id)")

    # ── Po'puti ─────────────────────────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS carpool_trips (
        id              SERIAL PRIMARY KEY,
        driver_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id      INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        from_address    TEXT NOT NULL,
        from_lat        DECIMAL(10,8) NOT NULL,
        from_lng        DECIMAL(11,8) NOT NULL,
        from_location   GEOGRAPHY(POINT, 4326),
        to_address      TEXT NOT NULL,
        to_lat          DECIMAL(10,8) NOT NULL,
        to_lng          DECIMAL(11,8) NOT NULL,
        to_location     GEOGRAPHY(POINT, 4326),
        departure_at    TIMESTAMP NOT NULL,
        seats_total     INTEGER NOT NULL CHECK (seats_total BETWEEN 1 AND 50),
        seats_available INTEGER NOT NULL CHECK (seats_available >= 0),
        price_per_seat  DECIMAL(10,2) NOT NULL,
        recurring_days  SMALLINT[],
        allow_parcels   BOOLEAN DEFAULT FALSE,
        note            TEXT,
        status          VARCHAR(20) DEFAULT 'active'
                        CHECK (status IN ('active','full','departed','completed','cancelled')),
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_trips_driver ON carpool_trips(driver_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_trips_departure ON carpool_trips(departure_at)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_trips_status ON carpool_trips(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_trips_from ON carpool_trips USING GIST(from_location)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_trips_to ON carpool_trips USING GIST(to_location)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS carpool_bookings (
        id            SERIAL PRIMARY KEY,
        trip_id       INTEGER NOT NULL REFERENCES carpool_trips(id) ON DELETE CASCADE,
        passenger_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seats         INTEGER NOT NULL DEFAULT 1 CHECK (seats >= 1),
        pickup_note   TEXT,
        phone         VARCHAR(20),
        is_subscription BOOLEAN DEFAULT FALSE,
        status        VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','rejected','cancelled','completed')),
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bookings_trip ON carpool_bookings(trip_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON carpool_bookings(passenger_id)")

    # ── Yuk tashish va spets texnika so'rovlari ─────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS service_requests (
        id               SERIAL PRIMARY KEY,
        service_type     VARCHAR(30) NOT NULL REFERENCES service_types(code),
        client_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_category VARCHAR(30),
        title            VARCHAR(200),
        description      TEXT,
        cargo_type       VARCHAR(100),
        weight_kg        INTEGER,
        volume_m3        DECIMAL(6,2),
        work_volume      TEXT,
        duration_value   DECIMAL(6,2),
        duration_unit    VARCHAR(10) CHECK (duration_unit IN ('hour','shift','day')),
        from_address     TEXT NOT NULL,
        from_lat         DECIMAL(10,8) NOT NULL,
        from_lng         DECIMAL(11,8) NOT NULL,
        from_location    GEOGRAPHY(POINT, 4326),
        to_address       TEXT,
        to_lat           DECIMAL(10,8),
        to_lng           DECIMAL(11,8),
        to_location      GEOGRAPHY(POINT, 4326),
        distance_km      DECIMAL(8,2),
        scheduled_at     TIMESTAMP,
        budget           DECIMAL(12,2),
        estimated_price  DECIMAL(12,2),
        phone            VARCHAR(20),
        status           VARCHAR(20) DEFAULT 'open'
                         CHECK (status IN ('open','assigned','in_progress','completed','cancelled','expired')),
        accepted_offer_id INTEGER,
        provider_id      INTEGER REFERENCES users(id),
        vehicle_id       INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        final_price      DECIMAL(12,2),
        offers_count     INTEGER DEFAULT 0,
        assigned_at      TIMESTAMP,
        started_at       TIMESTAMP,
        completed_at     TIMESTAMP,
        cancelled_at     TIMESTAMP,
        cancel_reason    TEXT,
        created_at       TIMESTAMP DEFAULT NOW(),
        updated_at       TIMESTAMP DEFAULT NOW()
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_provider ON service_requests(provider_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_status ON service_requests(status)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_type ON service_requests(service_type)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_requests_from ON service_requests USING GIST(from_location)")

    op.execute("""
    CREATE TABLE IF NOT EXISTS offers (
        id            SERIAL PRIMARY KEY,
        request_id    INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
        provider_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        vehicle_id    INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
        price         DECIMAL(12,2) NOT NULL CHECK (price > 0),
        available_at  TIMESTAMP,
        message       TEXT,
        status        VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','rejected','withdrawn')),
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_offer_per_provider UNIQUE(request_id, provider_id)
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_offers_request ON offers(request_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_offers_provider ON offers(provider_id)")
    op.execute("""
    ALTER TABLE service_requests
      ADD CONSTRAINT fk_requests_offer FOREIGN KEY (accepted_offer_id) REFERENCES offers(id) ON DELETE SET NULL
    """)

    # ── Servis tariflari (narx qoidalari) ───────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS service_tariffs (
        id               SERIAL PRIMARY KEY,
        service_type     VARCHAR(30) NOT NULL REFERENCES service_types(code),
        vehicle_category VARCHAR(30),
        base_price       DECIMAL(12,2) DEFAULT 0,
        per_km           DECIMAL(10,2) DEFAULT 0,
        per_hour         DECIMAL(10,2) DEFAULT 0,
        per_shift        DECIMAL(12,2) DEFAULT 0,
        per_day          DECIMAL(12,2) DEFAULT 0,
        per_seat_km      DECIMAL(10,2) DEFAULT 0,
        min_price        DECIMAL(12,2) DEFAULT 0,
        is_active        BOOLEAN DEFAULT TRUE,
        updated_at       TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_tariff UNIQUE(service_type, vehicle_category)
    )""")
    op.execute("""
    INSERT INTO service_tariffs(service_type,vehicle_category,base_price,per_km,per_hour,per_shift,per_day,per_seat_km,min_price) VALUES
      ('carpool',NULL,0,0,0,0,0,400,5000),
      ('cargo','labo',30000,3000,0,0,0,0,50000),
      ('cargo','damas',30000,3000,0,0,0,0,50000),
      ('cargo','gazel',50000,4500,0,0,0,0,80000),
      ('cargo','isuzu',80000,6000,0,0,0,0,150000),
      ('cargo','kamaz',120000,8000,0,0,0,0,250000),
      ('cargo','dump_truck',120000,8000,0,0,0,0,250000),
      ('equipment','excavator',0,0,250000,1800000,2000000,0,250000),
      ('equipment','bulldozer',0,0,300000,2200000,2500000,0,300000),
      ('equipment','crane',0,0,350000,2600000,3000000,0,350000),
      ('equipment','loader',0,0,200000,1500000,1700000,0,200000),
      ('equipment','tractor',0,0,150000,1100000,1300000,0,150000),
      ('equipment','concrete_mixer',0,0,250000,1800000,2000000,0,250000),
      ('equipment','dump_truck',0,0,200000,1500000,1700000,0,200000)
    ON CONFLICT DO NOTHING
    """)

    # ── Umumiy reyting va sharhlar ──────────────────────────────────────────
    op.execute("""
    CREATE TABLE IF NOT EXISTS reviews (
        id             SERIAL PRIMARY KEY,
        service_type   VARCHAR(30) NOT NULL,
        ref_id         INTEGER NOT NULL,
        rater_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_role    VARCHAR(20) NOT NULL CHECK (target_role IN ('client','provider')),
        rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment        TEXT,
        created_at     TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_review UNIQUE(service_type, ref_id, rater_id)
    )""")
    op.execute("CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_user_id)")

    op.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)")


def downgrade() -> None:
    from alembic import op
    op.execute("DROP TABLE IF EXISTS reviews CASCADE")
    op.execute("DROP TABLE IF EXISTS service_tariffs CASCADE")
    op.execute("ALTER TABLE IF EXISTS service_requests DROP CONSTRAINT IF EXISTS fk_requests_offer")
    op.execute("DROP TABLE IF EXISTS offers CASCADE")
    op.execute("DROP TABLE IF EXISTS service_requests CASCADE")
    op.execute("DROP TABLE IF EXISTS carpool_bookings CASCADE")
    op.execute("DROP TABLE IF EXISTS carpool_trips CASCADE")
    op.execute("DROP TABLE IF EXISTS availability CASCADE")
    op.execute("DROP TABLE IF EXISTS user_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS vehicles CASCADE")
    op.execute("DROP TABLE IF EXISTS service_types CASCADE")
    op.execute("DROP INDEX IF EXISTS idx_notifications_user")
    for col in ("roles", "company_name", "bio", "provider_rating", "provider_reviews", "last_location"):
        op.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col}")
