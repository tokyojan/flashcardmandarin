import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, key)
    )
  `);
}

export async function getAllUserData(userId: string) {
  const { rows } = await pool.query(
    "SELECT key, data FROM user_data WHERE user_id = $1",
    [userId]
  );
  const map: Record<string, unknown> = {};
  for (const row of rows) map[row.key] = row.data;
  return {
    deck: (map.deck as unknown[] | undefined) ?? null,
    settings: (map.settings as Record<string, unknown> | undefined) ?? null,
    stats: (map.stats as Record<string, unknown> | undefined) ?? { history: {} },
    session: (map.session as Record<string, unknown> | undefined) ?? null,
  };
}

export async function setUserData(userId: string, key: string, data: unknown) {
  await pool.query(
    `INSERT INTO user_data (user_id, key, data, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (user_id, key)
     DO UPDATE SET data = $3::jsonb, updated_at = NOW()`,
    [userId, key, JSON.stringify(data)]
  );
}

export async function deleteUserData(userId: string, key: string) {
  await pool.query(
    "DELETE FROM user_data WHERE user_id = $1 AND key = $2",
    [userId, key]
  );
}
