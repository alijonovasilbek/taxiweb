exports.up = (knex) => knex.schema.raw(`
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
  );
  CREATE INDEX idx_users_telegram_id ON users(telegram_id);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS users CASCADE`);
