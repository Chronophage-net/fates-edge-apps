import pg from 'pg';
import { readFile } from 'node:fs/promises';

export async function database(url) {
  if (!url) throw new Error('MANAGER_DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    query: (sql, values) => pool.query(sql, values),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Serialize authorization mutations with credential exchange so bans and
        // role changes cannot race a token grant. This small control plane favors
        // correctness over parallel mutation throughput.
        await client.query('SELECT pg_advisory_xact_lock(704192)');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end()
  };
}
export async function migrate(db) {
  await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
}
