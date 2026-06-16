import { sql } from '@vercel/postgres';

let schemaReady: Promise<void> | null = null;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS holdings (
        code           TEXT PRIMARY KEY,
        name           TEXT NOT NULL,
        shares         NUMERIC NOT NULL,
        amount         NUMERIC NOT NULL,
        cost_price     NUMERIC NOT NULL,
        pending_amount NUMERIC NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS watchlist (
        code     TEXT PRIMARY KEY,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dca_plans (
        id                BIGSERIAL PRIMARY KEY,
        code              TEXT NOT NULL REFERENCES holdings(code) ON DELETE CASCADE,
        amount_per_period NUMERIC NOT NULL CHECK (amount_per_period > 0),
        frequency         TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
        start_date        DATE NOT NULL,
        confirmation_days INTEGER NOT NULL DEFAULT 2 CHECK (confirmation_days BETWEEN 1 AND 5),
        active            BOOLEAN NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS dca_plans_code_active_uniq
      ON dca_plans(code) WHERE active = TRUE;
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS dca_transactions (
        id                BIGSERIAL PRIMARY KEY,
        plan_id           BIGINT NOT NULL REFERENCES dca_plans(id) ON DELETE CASCADE,
        code              TEXT NOT NULL,
        transaction_date  DATE NOT NULL,
        amount            NUMERIC NOT NULL CHECK (amount > 0),
        status            TEXT NOT NULL CHECK (status IN ('pending','settled')),
        settled_at        TIMESTAMPTZ,
        nav_at_settle     NUMERIC,
        shares_added      NUMERIC,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (plan_id, transaction_date)
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS dca_tx_status_date_idx
      ON dca_transactions(status, transaction_date);
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS dca_tx_code_idx ON dca_transactions(code);
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS daily_returns (
        id                   BIGSERIAL PRIMARY KEY,
        code                 TEXT NOT NULL,
        snapshot_date        DATE NOT NULL,
        nav                  NUMERIC,
        settled_shares       NUMERIC NOT NULL,
        settled_market_value NUMERIC NOT NULL,
        cost_price           NUMERIC NOT NULL,
        total_cost           NUMERIC NOT NULL,
        pending_amount       NUMERIC NOT NULL,
        pending_count        INTEGER NOT NULL,
        realized_gain        NUMERIC NOT NULL,
        gain_rate            NUMERIC NOT NULL,
        recorded_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (code, snapshot_date)
      );
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS daily_returns_code_date_idx
      ON daily_returns(code, snapshot_date DESC);
    `;
  })();
  try {
    await schemaReady;
  } catch (err) {
    schemaReady = null;
    throw err;
  }
}

export { sql };
