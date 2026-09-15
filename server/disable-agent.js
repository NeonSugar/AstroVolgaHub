import { assertConfig, getConfig } from './config.js';
import { createPool } from './db.js';
import { validateAgentLogin } from './validation.js';

const loginIndex = process.argv.indexOf('--login');
const login = validateAgentLogin(loginIndex >= 0 ? process.argv[loginIndex + 1] : '');

if (!login) {
  console.error('Usage: npm run agent:disable -- --login LOGIN');
  process.exitCode = 1;
} else {
  const config = getConfig();
  assertConfig(config);
  const pool = createPool(config);
  try {
    const result = await pool.query(
      `UPDATE agents
       SET cabinet_enabled = FALSE, updated_at = NOW()
       WHERE login = $1
       RETURNING id, login, display_name`,
      [login]
    );
    if (!result.rowCount) {
      console.error(`Agent not found: ${login}`);
      process.exitCode = 1;
    } else {
      console.log('Agent cabinet disabled:', result.rows[0]);
    }
  } finally {
    await pool.end();
  }
}
