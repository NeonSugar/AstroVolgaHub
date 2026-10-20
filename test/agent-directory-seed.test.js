import assert from 'node:assert/strict';
import test from 'node:test';
import { groupAgentSeedRecords, loadAgentSeedRecords } from '../server/agent-directory-seed.js';

test('legacy agent directory is converted into complete database records', async () => {
  const records = await loadAgentSeedRecords();
  const uniqueKeys = new Set(records.map((record) =>
    `${record.localitySlug}|${record.addressKey}|${record.phone}`
  ));
  const localities = new Set(records.map((record) => record.localitySlug));

  assert.equal(records.length, 231);
  assert.equal(uniqueKeys.size, records.length);
  assert.equal(localities.size, 51);
  assert.ok(records.some((record) => record.isPrimaryCity));
  assert.ok(records.some((record) => !record.isPrimaryCity && record.districtSlug));

  const dneprovka = records.filter((record) => record.localitySlug === 'dneprovka');
  assert.equal(dneprovka.length, 2);
  assert.ok(dneprovka.every((record) => record.localityName === 'Днепровка'));
  assert.ok(dneprovka.every((record) => record.districtSlug === 'kamensko-dneprovsky'));
  assert.ok(dneprovka.every((record) => record.address === 'ул. Центральная, 178'));
  assert.deepEqual(dneprovka.map((record) => record.phone).sort(), ['79900703682', '79900703726']);

  records.forEach((record) => {
    assert.match(record.localitySlug, /^[a-z0-9-]{2,80}$/);
    assert.ok(record.localityName);
    assert.ok(record.address);
    assert.ok(record.addressKey);
    assert.match(record.phone, /^\d{10,15}$/);
  });
});

test('groups Dneprovka contact phones into one agent', async () => {
  const records = await loadAgentSeedRecords();
  const groups = groupAgentSeedRecords(records);
  const dneprovka = groups.filter((record) => record.localitySlug === 'dneprovka');

  assert.equal(dneprovka.length, 1);
  assert.equal(dneprovka[0].address, 'ул. Центральная, 178');
  assert.deepEqual(dneprovka[0].phones.sort(), ['79900703682', '79900703726']);
});

test('groups phones by locality and address but keeps offsite agents separate', () => {
  const base = {
    localitySlug: 'berdyansk',
    localityName: 'Бердянск',
    address: 'ул. Победы, 15',
    addressKey: 'победы15',
    sortOrder: 0
  };
  const groups = groupAgentSeedRecords([
    { ...base, phone: '79900000001' },
    { ...base, phone: '79900000002', sortOrder: 1 },
    { ...base, address: 'Без офиса', addressKey: 'безофиса', phone: '79900000003', sortOrder: 2 },
    { ...base, address: 'Без офиса', addressKey: 'безофиса', phone: '79900000004', sortOrder: 3 }
  ]);

  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].phones, ['79900000001', '79900000002']);
  assert.deepEqual(groups[1].phones, ['79900000003']);
  assert.deepEqual(groups[2].phones, ['79900000004']);
});
