import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions/db-connections';

const connectionString = process.env.DATABASE_URL ?? process.env.STORAGE_DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL or STORAGE_DATABASE_URL is not configured');

export const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 });
attachDatabasePool(pool);

export type Db = pg.Pool | pg.PoolClient;

export async function transaction<T>(run: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query('begin');
    const value = await run(db);
    await db.query('commit');
    return value;
  } catch (error) {
    await db.query('rollback');
    throw error;
  } finally {
    db.release();
  }
}
