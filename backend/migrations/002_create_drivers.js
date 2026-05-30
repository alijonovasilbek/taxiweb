exports.up = (knex) => knex.schema.raw(`
  CREATE EXTENSION IF NOT EXISTS postgis;

  CREATE TABLE drivers (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    telegram_id     BIGINT UNIQUE NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    car_model       VARCHAR(100) NOT NULL,
    car_color       VARCHAR(50) NOT NULL,
    car_number      VARCHAR(20) NOT NULL UNIQUE,
    car_year        INTEGER,
    license_photo_url    TEXT,
    car_doc_photo_url    TEXT,
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','blocked','rejected')),
    is_online       BOOLEAN DEFAULT FALSE,
    is_on_ride      BOOLEAN DEFAULT FALSE,
    current_location     GEOGRAPHY(POINT, 4326),
    last_location_update TIMESTAMP,
    rating          DECIMAL(3,2) DEFAULT 5.00,
    total_rides     INTEGER DEFAULT 0,
    total_earnings  DECIMAL(12,2) DEFAULT 0,
    balance         DECIMAL(12,2) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX idx_drivers_telegram_id ON drivers(telegram_id);
  CREATE INDEX idx_drivers_status ON drivers(status);
  CREATE INDEX idx_drivers_is_online ON drivers(is_online);
  CREATE INDEX idx_drivers_location ON drivers USING GIST(current_location);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS drivers CASCADE`);
