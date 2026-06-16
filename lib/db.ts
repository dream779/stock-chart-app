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
  })();
  try {
    await schemaReady;
  } catch (err) {
    schemaReady = null;
    throw err;
  }
}

export { sql };
