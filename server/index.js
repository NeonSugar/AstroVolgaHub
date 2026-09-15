import { assertConfig, getConfig } from './config.js';
import { createApp } from './app.js';
import { createPool } from './db.js';
import { runMigrations } from './migrations.js';

const config = getConfig();
assertConfig(config);
const pool = createPool(config);

await runMigrations(pool);
const app = createApp({ pool, config });
const server = app.listen(config.port, config.host, () => {
  const publicHost = config.host === '0.0.0.0' ? '127.0.0.1' : config.host;
  console.log(`Astro-Volga is running at http://${publicHost}:${config.port}`);
});

const shutdown = async (signal) => {
  console.log(`${signal}: shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
