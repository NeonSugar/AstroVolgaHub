import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { assertConfig, getConfig } from './config.js';
import { createPool } from './db.js';
import { runMigrations } from './migrations.js';
import { normalizeAddress, normalizePhone, validateAgentLogin } from './validation.js';

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
const password = process.env.AGENT_PASSWORD || '';
const login = validateAgentLogin(args.login);
const city = String(args.city || '').trim().toLowerCase();
const address = String(args.address || '').trim();
const addressKey = normalizeAddress(address);
const phone = normalizePhone(args.phone);
const displayName = String(args.name || login).trim();

if (!login || !/^[a-z0-9-]{2,80}$/.test(city) || !address || address.length > 240
  || !addressKey || phone.length < 10 || phone.length > 15 || !displayName || displayName.length > 160) {
  console.error('Usage: AGENT_PASSWORD=... npm run agent:create -- --login LOGIN --name "Имя" --city CITY --address "Адрес" --phone PHONE');
  process.exitCode = 1;
} else if (password.length < 12) {
  console.error('AGENT_PASSWORD must contain at least 12 characters.');
  process.exitCode = 1;
} else {
  const config = getConfig();
  assertConfig(config);
  const pool = createPool(config);
  try {
    await runMigrations(pool);
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO agents (id, login, display_name, city_slug, address, address_key, phone, password_hash, cabinet_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       ON CONFLICT (city_slug, address_key, phone)
       DO UPDATE SET login = EXCLUDED.login,
                     display_name = EXCLUDED.display_name,
                     password_hash = EXCLUDED.password_hash,
                     cabinet_enabled = TRUE,
                     updated_at = NOW()
       RETURNING id, login, display_name, city_slug, address, phone`,
      [randomUUID(), login, displayName, city, address, addressKey, phone, passwordHash]
    );
    console.log('Agent cabinet enabled:', result.rows[0]);
  } finally {
    await pool.end();
  }
}
