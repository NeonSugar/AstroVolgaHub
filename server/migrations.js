import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export const runMigrations = async (pool) => {
  const migrationFiles = ['001_init.sql', '002_callback_workflow.sql'];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const migrationFile of migrationFiles) {
      const sql = await readFile(join(currentDirectory, 'sql', migrationFile), 'utf8');
      await client.query(sql);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
