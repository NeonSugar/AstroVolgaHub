import { assertConfig, getConfig } from './config.js';
import { createPool } from './db.js';

const confirmationIndex = process.argv.indexOf('--confirm');
const confirmation = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : '';
const confirmationPhrase = 'CLEAR_ALL_REQUESTS_AND_CABINETS';

const config = getConfig();
assertConfig(config);
const pool = createPool(config);

try {
  const [requestsResult, cabinetsResult, agentsResult] = await Promise.all([
    pool.query('SELECT COUNT(*)::INTEGER AS count FROM callback_requests'),
    pool.query(
      `SELECT login, display_name, locality_name, address
       FROM agents
       WHERE cabinet_enabled = TRUE OR login IS NOT NULL OR password_hash IS NOT NULL
       ORDER BY locality_name, display_name`
    ),
    pool.query('SELECT COUNT(*)::INTEGER AS count FROM agents')
  ]);

  const requestCount = requestsResult.rows[0].count;
  const cabinets = cabinetsResult.rows;
  const agentCount = agentsResult.rows[0].count;

  console.log('Data cleanup preview:');
  console.log(`- callback requests to delete: ${requestCount}`);
  console.log(`- agent cabinets to disable: ${cabinets.length}`);
  console.log(`- agent records to preserve: ${agentCount}`);
  if (cabinets.length) {
    console.table(cabinets.map((agent) => ({
      login: agent.login || '—',
      agent: agent.display_name,
      locality: agent.locality_name,
      address: agent.address
    })));
  }

  if (confirmation !== confirmationPhrase) {
    console.log('\nPreview only. No data was changed.');
    console.log(`To execute: npm run data:clear-requests-and-cabinets -- --confirm ${confirmationPhrase}`);
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE callback_requests, agents IN SHARE ROW EXCLUSIVE MODE');
      const deleted = await client.query('DELETE FROM callback_requests');
      const disabled = await client.query(
        `UPDATE agents
         SET login = NULL,
             password_hash = NULL,
             cabinet_enabled = FALSE,
             updated_at = NOW()
         WHERE cabinet_enabled = TRUE OR login IS NOT NULL OR password_hash IS NOT NULL`
      );
      const preservedResult = await client.query('SELECT COUNT(*)::INTEGER AS count FROM agents');
      await client.query('COMMIT');

      console.log('\nCleanup completed:');
      console.log(`- callback requests deleted: ${deleted.rowCount}`);
      console.log(`- agent cabinets disabled: ${disabled.rowCount}`);
      console.log(`- agent records preserved: ${preservedResult.rows[0].count}`);
      console.log('- administrator accounts were not changed');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
