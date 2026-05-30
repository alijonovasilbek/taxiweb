exports.up = (knex) => knex.schema.raw(`
  CREATE TABLE orders (
    id              SERIAL PRIMARY KEY,
    passenger_id    INTEGER REFERENCES users(id),
    driver_id       INTEGER REFERENCES drivers(id),
    pickup_address  TEXT NOT NULL,
    pickup_lat      DECIMAL(10,8) NOT NULL,
    pickup_lng      DECIMAL(11,8) NOT NULL,
    pickup_location GEOGRAPHY(POINT, 4326),
    dropoff_address TEXT NOT NULL,
    dropoff_lat     DECIMAL(10,8) NOT NULL,
    dropoff_lng     DECIMAL(11,8) NOT NULL,
    dropoff_location GEOGRAPHY(POINT, 4326),
    distance_km     DECIMAL(8,2),
    duration_min    INTEGER,
    route_polyline  TEXT,
    estimated_price DECIMAL(10,2) NOT NULL,
    final_price     DECIMAL(10,2),
    status          VARCHAR(20) DEFAULT 'searching'
                    CHECK (status IN (
                      'searching','accepted','driver_arrived',
                      'in_progress','completed','cancelled','no_drivers'
                    )),
    payment_method  VARCHAR(20) CHECK (payment_method IN ('cash','payme','click','telegram')),
    payment_status  VARCHAR(20) DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','refunded','failed')),
    payment_id      VARCHAR(100),
    requested_at    TIMESTAMP DEFAULT NOW(),
    accepted_at     TIMESTAMP,
    arrived_at      TIMESTAMP,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    cancelled_at    TIMESTAMP,
    cancel_reason   TEXT,
    passenger_rated BOOLEAN DEFAULT FALSE,
    driver_rated    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX idx_orders_passenger_id ON orders(passenger_id);
  CREATE INDEX idx_orders_driver_id ON orders(driver_id);
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_orders_pickup_location ON orders USING GIST(pickup_location);
  CREATE INDEX idx_orders_created_at ON orders(created_at);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS orders CASCADE`);
