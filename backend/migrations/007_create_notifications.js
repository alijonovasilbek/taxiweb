exports.up = (knex) => knex.schema.raw(`
  CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    driver_id   INTEGER REFERENCES drivers(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       TEXT,
    message     TEXT NOT NULL,
    data        JSONB,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX idx_notifications_user ON notifications(user_id);
  CREATE INDEX idx_notifications_driver ON notifications(driver_id);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS notifications CASCADE`);
