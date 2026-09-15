import { assertConfig, getConfig } from './config.js';
import { createPool } from './db.js';
import { runMigrations } from './migrations.js';

const config = getConfig();
assertConfig(config);
const pool = createPool(config);

try {
  await runMigrations(pool);
  console.log('Database migrations completed.');
} finally {
  await pool.end();
}
