exports.up = (knex) => knex.schema.raw(`
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
  );
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS tariffs CASCADE`);
