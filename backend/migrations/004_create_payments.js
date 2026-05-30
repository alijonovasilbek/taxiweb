exports.up = (knex) => knex.schema.raw(`
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
  );

  CREATE INDEX idx_payments_order_id ON payments(order_id);
  CREATE INDEX idx_payments_status ON payments(status);
  CREATE INDEX idx_payments_external_id ON payments(external_id);
`);

exports.down = (knex) => knex.schema.raw(`DROP TABLE IF EXISTS payments CASCADE`);
