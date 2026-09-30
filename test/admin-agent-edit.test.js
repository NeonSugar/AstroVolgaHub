import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createAdminRouter } from '../server/admin-routes.js';

const agentId = '11111111-1111-4111-8111-111111111111';

test('administrator can update an agent profile and replace all contact phones', async (context) => {
  const calls = [];
  const client = {
    async query(sql, parameters = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ statement, parameters });
      if (statement.startsWith('SELECT id, city_slug, sort_order')) {
        return { rowCount: 1, rows: [{ id: agentId, city_slug: 'berdyansk', sort_order: 100 }] };
      }
      if (statement.startsWith('SELECT locality_name, district_slug')) {
        return {
          rowCount: 1,
          rows: [{
            locality_name: 'Бердянск',
            district_slug: null,
            district_name: null,
            is_primary_city: true,
            district_order: null,
            locality_order: 1
          }]
        };
      }
      if (statement.startsWith('SELECT id FROM agents')) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [] };
    },
    release() {}
  };
  const pool = { connect: async () => client, query: async () => ({ rowCount: 0, rows: [] }) };
  const pass = (_request, _response, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminRouter({
    pool,
    loginLimiter: pass,
    requireAdmin: pass,
    requireCsrf: pass,
    getCsrfToken: () => 'test-token',
    sessionRegenerate: async () => {},
    sessionDestroy: async () => {}
  }));
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  const response = await fetch(`http://127.0.0.1:${port}/api/admin/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      localitySlug: 'berdyansk',
      displayName: 'Агент Бердянск',
      address: 'ул. Победы, 15',
      phones: ['+7 (990) 007-14-73', '8 900 123-45-67'],
      note: 'Работает ежедневно',
      mapUrl: 'https://yandex.ru/maps/example'
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.message, 'Данные агента обновлены.');
  const update = calls.find(({ statement }) => statement.startsWith('UPDATE agents'));
  assert.ok(update);
  assert.equal(update.parameters[0], 'Агент Бердянск');
  assert.equal(update.parameters[1], 'berdyansk');
  assert.equal(update.parameters[11], '79900071473');
  const insertedPhones = calls
    .filter(({ statement }) => statement.startsWith('INSERT INTO agent_phones'))
    .map(({ parameters }) => parameters[1]);
  assert.deepEqual(insertedPhones, ['79900071473', '79001234567']);
  assert.ok(calls.some(({ statement }) => statement === 'COMMIT'));
});
