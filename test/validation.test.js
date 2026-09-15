import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUuid,
  normalizeAddress,
  normalizeLogin,
  normalizePhone,
  validateAgentLogin,
  validateCallbackStatusDetails,
  validateCustomerName,
  validateCustomerPhone,
  validateSourcePath
} from '../server/validation.js';

test('normalizes Russian addresses consistently with the city cards', () => {
  assert.equal(normalizeAddress('ул. Кирова, 37'), 'кирова37');
  assert.equal(normalizeAddress('пр-т Ленина, 27'), 'ленина27');
  assert.equal(normalizeAddress('Без офиса'), 'безофиса');
});

test('normalizes login and Russian phone formats', () => {
  assert.equal(normalizeLogin(' Agent-01 '), 'agent-01');
  assert.equal(normalizePhone('+7 (990) 123-45-67'), '79901234567');
  assert.equal(normalizePhone('8 990 123-45-67'), '79901234567');
});

test('validates agent login and UUID values', () => {
  assert.equal(validateAgentLogin(' Agent.ONE '), 'agent.one');
  assert.equal(validateAgentLogin('агент 1'), null);
  assert.equal(isUuid('fca79651-b283-43f8-9a4c-8c42ee226835'), true);
  assert.equal(isUuid('fca79651-b283-43f8-9a4c'), false);
});

test('validates callback form values', () => {
  assert.equal(validateCustomerName('  Иван  Петров '), 'Иван Петров');
  assert.equal(validateCustomerName('A'), null);
  assert.equal(validateCustomerPhone('+7 990 123-45-67'), '79901234567');
  assert.equal(validateCustomerPhone('123'), null);
  assert.equal(validateSourcePath('/berdyansk/'), '/berdyansk/');
  assert.equal(validateSourcePath('https://example.com'), null);
});

test('validates callback status details', () => {
  assert.deepEqual(validateCallbackStatusDetails('new', {}), {});
  assert.deepEqual(validateCallbackStatusDetails('in_progress', {
    reason: 'rescheduled',
    followUpDate: '2026-09-12'
  }), { reason: 'rescheduled', followUpDate: '2026-09-12' });
  assert.deepEqual(validateCallbackStatusDetails('in_progress', {
    reason: 'no_answer',
    followUpDate: '2026-09-12'
  }), { reason: 'no_answer', followUpDate: null });
  assert.deepEqual(validateCallbackStatusDetails('processed', {
    services: ['osago', 'kasko', 'osago']
  }), { services: ['osago', 'kasko'] });
  assert.deepEqual(validateCallbackStatusDetails('rejected', {
    comment: '  Клиент   отказался  '
  }), { comment: 'Клиент отказался' });
  assert.equal(validateCallbackStatusDetails('in_progress', {}), null);
  assert.equal(validateCallbackStatusDetails('processed', { services: [] }), null);
  assert.equal(validateCallbackStatusDetails('rejected', { comment: ' ' }), null);
});
