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
const phones = [...new Set(String(args.phones || args.phone || '')
  .split(',')
  .map(normalizePhone)
  .filter(Boolean))];
const displayName = String(args.name || login).trim();
const primaryCities = new Map([
  ['melitopol', ['Мелитополь', 0]],
  ['berdyansk', ['Бердянск', 1]],
  ['energodar', ['Энергодар', 2]],
  ['tokmak', ['Токмак', 3]],
  ['vasilevka', ['Васильевка', 4]],
  ['kamenka', ['Каменка-Днепровская', 5]],
  ['primorsk', ['Приморск', 6]],
  ['veseloe', ['Весёлое', 7]],
  ['znamenka', ['Великая Знаменка', 8]]
]);
const [localityName, localityOrder] = primaryCities.get(city) || [city, null];

if (!login || !/^[a-z0-9-]{2,80}$/.test(city) || !address || address.length > 240
  || !addressKey || !phones.length || phones.some((phone) => phone.length < 10 || phone.length > 15)
  || !displayName || displayName.length > 160) {
  console.error('Usage: AGENT_PASSWORD=... npm run agent:create -- --login LOGIN --name "Имя" --city CITY --address "Адрес" --phones "PHONE_1,PHONE_2"');
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const passwordHash = await bcrypt.hash(password, 12);
      const existing = addressKey === 'безофиса'
        ? await client.query(
          `SELECT a.id FROM agents a
           JOIN agent_phones ap ON ap.agent_id = a.id
           WHERE a.city_slug = $1 AND a.address_key = $2
             AND a.merged_into_agent_id IS NULL AND ap.phone = ANY($3::VARCHAR[])
           LIMIT 1`,
          [city, addressKey, phones]
        )
        : await client.query(
          `SELECT id FROM agents
           WHERE city_slug = $1 AND address_key = $2 AND merged_into_agent_id IS NULL
           LIMIT 1`,
          [city, addressKey]
        );
      const agentId = existing.rows[0]?.id || randomUUID();
      let result;
      if (existing.rowCount) {
        result = await client.query(
          `UPDATE agents
           SET login = $1, display_name = $2, password_hash = $3,
               cabinet_enabled = TRUE, is_active = TRUE, updated_at = NOW()
           WHERE id = $4
           RETURNING id, login, display_name, city_slug, address, phone`,
          [login, displayName, passwordHash, agentId]
        );
      } else {
        result = await client.query(
          `INSERT INTO agents
             (id, login, display_name, city_slug, locality_name, locality_order, is_primary_city,
              address, address_key, phone, password_hash, cabinet_enabled, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, TRUE)
           RETURNING id, login, display_name, city_slug, address, phone`,
          [
            agentId, login, displayName, city, localityName, localityOrder,
            primaryCities.has(city), address, addressKey, phones[0], passwordHash
          ]
        );
      }
      for (let phoneIndex = 0; phoneIndex < phones.length; phoneIndex += 1) {
        await client.query(
          `INSERT INTO agent_phones (agent_id, phone, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (agent_id, phone) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
          [agentId, phones[phoneIndex], phoneIndex]
        );
      }
      await client.query('COMMIT');
      console.log('Agent cabinet enabled:', { ...result.rows[0], phones });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
