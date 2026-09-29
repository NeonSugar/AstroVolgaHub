import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assertConfig, getConfig } from './config.js';
import { createPool } from './db.js';
import { runMigrations } from './migrations.js';
import { validateAgentLogin } from './validation.js';

const parseArguments = (argumentsList) => {
  const result = {};
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (!argument.startsWith('--')) continue;
    result[argument.slice(2)] = argumentsList[index + 1] || '';
    index += 1;
  }
  return result;
};

const args = parseArguments(process.argv.slice(2));
const login = validateAgentLogin(args.login);
const displayName = String(args.name || login || '').trim();
const password = process.env.ADMIN_PASSWORD || '';

if (!login || displayName.length < 2 || displayName.length > 160) {
  console.error('Usage: ADMIN_PASSWORD=... npm run admin:create -- --login LOGIN --name "Имя администратора"');
  process.exitCode = 1;
} else if (password.length < 12 || password.length > 200) {
  console.error('ADMIN_PASSWORD must contain from 12 to 200 characters.');
  process.exitCode = 1;
} else {
  const config = getConfig();
  assertConfig(config);
  const pool = createPool(config);
  try {
    await runMigrations(pool);
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO administrators (id, login, display_name, password_hash, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (login)
       DO UPDATE SET display_name = EXCLUDED.display_name,
                     password_hash = EXCLUDED.password_hash,
                     is_active = TRUE,
                     updated_at = NOW()
       RETURNING id, login, display_name`,
      [randomUUID(), login, displayName, passwordHash]
    );
    console.log('Administrator enabled:', result.rows[0]);
  } finally {
    await pool.end();
  }
}
