import { getPool } from "../config/db.js";

async function safeQuery(client, sql) {
  try {
    await client.query(sql);
  } catch (err) {
    // Já existe / já aplicado
    if (err.code === "42701" || err.code === "42P07" || err.code === "42710") return;
    throw err;
  }
}

function touchUpdatedAtTrigger(table) {
  return `
    CREATE OR REPLACE FUNCTION filazero_touch_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table};
    CREATE TRIGGER trg_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW EXECUTE PROCEDURE filazero_touch_updated_at();
  `;
}

/**
 * Cria tabelas no Postgres (Supabase) se ainda não existirem.
 */
export async function ensureSchema() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id VARCHAR(64) NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NULL,
        name VARCHAR(255) NULL,
        avatar_url VARCHAR(512) NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'diner'
          CHECK (role IN ('diner', 'partner')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        place_id VARCHAR(128) NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        place_address VARCHAR(512) NULL,
        lat DOUBLE PRECISION NULL,
        lng DOUBLE PRECISION NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, place_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS visit_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        place_id VARCHAR(128) NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        place_address VARCHAR(512) NULL,
        lat DOUBLE PRECISION NULL,
        lng DOUBLE PRECISION NULL,
        note VARCHAR(255) NULL,
        visited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`DROP TABLE IF EXISTS wait_alerts`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_menus (
        id SERIAL PRIMARY KEY,
        place_id VARCHAR(128) NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        menu_date DATE NOT NULL,
        items_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (place_id, menu_date)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS place_feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        place_id VARCHAR(128) NOT NULL,
        place_name VARCHAR(255) NOT NULL,
        place_address VARCHAR(512) NULL,
        lat DOUBLE PRECISION NULL,
        lng DOUBLE PRECISION NULL,
        rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        wait_minutes SMALLINT NULL,
        comment VARCHAR(800) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, place_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_restaurants (
        id SERIAL PRIMARY KEY,
        place_id VARCHAR(128) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(512) NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        website_url VARCHAR(512) NULL,
        cuisine_type VARCHAR(32) NULL,
        self_service SMALLINT NOT NULL DEFAULT 0,
        wait_minutes SMALLINT NOT NULL DEFAULT 10,
        wait_updated_at TIMESTAMPTZ NULL,
        is_open SMALLINT NOT NULL DEFAULT 1,
        capacity_total SMALLINT NULL,
        capacity_free SMALLINT NULL,
        promo_title VARCHAR(120) NULL,
        promo_description VARCHAR(400) NULL,
        promo_price NUMERIC(10, 2) NULL,
        promo_active SMALLINT NOT NULL DEFAULT 0,
        hours_json JSONB NULL,
        reminder_enabled SMALLINT NOT NULL DEFAULT 1,
        owner_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        is_published SMALLINT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS place_go_now (
        id BIGSERIAL PRIMARY KEY,
        place_id VARCHAR(128) NOT NULL,
        user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_fav_user ON favorites (user_id)`
    );
    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_hist_user ON visit_history (user_id)`
    );
    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_feedback_place ON place_feedback (place_id)`
    );
    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_partner_geo ON partner_restaurants (lat, lng)`
    );
    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_go_now_place_time ON place_go_now (place_id, created_at)`
    );
    await safeQuery(
      client,
      `CREATE INDEX IF NOT EXISTS idx_go_now_user_time ON place_go_now (user_id, created_at)`
    );

    // Colunas que podem ter sido adicionadas depois (idempotente)
    const alters = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'diner'`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS is_open SMALLINT NOT NULL DEFAULT 1`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS capacity_total SMALLINT`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS capacity_free SMALLINT`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS promo_title VARCHAR(120)`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS promo_description VARCHAR(400)`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS promo_price NUMERIC(10, 2)`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS promo_active SMALLINT NOT NULL DEFAULT 0`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS hours_json JSONB`,
      `ALTER TABLE partner_restaurants ADD COLUMN IF NOT EXISTS reminder_enabled SMALLINT NOT NULL DEFAULT 1`,
    ];
    for (const sql of alters) {
      await safeQuery(client, sql);
    }

    for (const table of ["users", "daily_menus", "place_feedback", "partner_restaurants"]) {
      await client.query(touchUpdatedAtTrigger(table));
    }

    console.log("[db] Schema Postgres/Supabase OK (tabelas criadas se não existiam).");
  } finally {
    client.release();
  }
}
