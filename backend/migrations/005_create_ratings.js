exports.up = (knex) => knex.schema.raw(`
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
  );

  CREATE INDEX idx_ratings_order_id ON ratings(order_id);
  CREATE INDEX idx_ratings_rated_driver ON ratings(rated_driver_id);
  CREATE INDEX idx_ratings_rated_user ON ratings(rated_user_id);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS ratings CASCADE`);
