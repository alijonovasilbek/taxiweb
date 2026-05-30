exports.up = (knex) => knex.schema.raw(`
  CREATE TABLE driver_location_history (
    id          BIGSERIAL PRIMARY KEY,
    driver_id   INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
    order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    location    GEOGRAPHY(POINT, 4326) NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX idx_loc_history_driver ON driver_location_history(driver_id);
  CREATE INDEX idx_loc_history_order ON driver_location_history(order_id);
  CREATE INDEX idx_loc_history_location ON driver_location_history USING GIST(location);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS driver_location_history CASCADE`);
