import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAddress, normalizePhone } from './validation.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');

const primaryCities = [
  ['melitopol', 'Мелитополь'],
  ['berdyansk', 'Бердянск'],
  ['energodar', 'Энергодар'],
  ['tokmak', 'Токмак'],
  ['vasilevka', 'Васильевка'],
  ['kamenka', 'Каменка-Днепровская'],
  ['primorsk', 'Приморск'],
  ['veseloe', 'Весёлое'],
  ['znamenka', 'Великая Знаменка']
];

const districts = [
  ['akimovsky', 'Акимовский район', ['akimovka', 'kirillovka', 'shevlyuki']],
  ['berdyansky', 'Бердянский район', ['andreevka', 'osipenko', 'troyany']],
  ['vasilevsky', 'Васильевский район', ['dneprorudnoe', 'malaya-belozerka', 'skelki']],
  ['kamensko-dneprovsky', 'Каменско-Днепровский район', ['blagoveshchenka', 'velikaya-belozerka', 'vodyanoe', 'zapovitnoe', 'ivanovka', 'novovodyanoe', 'novodneprovka']],
  ['kuybyshevsky', 'Куйбышевский район', ['belotserkovka', 'kamysh-zarya', 'kuybyshevo', 'rozovka']],
  ['melitopolsky', 'Мелитопольский район', ['novobogdanovka', 'polyanovka', 'terpenye']],
  ['mikhailovsky', 'Михайловский район', ['mikhailovka']],
  ['pologovsky', 'Пологовский район', ['pologi']],
  ['priazovsky', 'Приазовский район', ['aleksandrovka', 'annovka', 'bogdanovka', 'vladimirovka', 'girsovka', 'dunaevka', 'nadezhdino', 'novovasilevka', 'novokonstantinovka', 'priazovskoe', 'stepanovka', 'stepanovka-pervaya']],
  ['primorsky', 'Приморский район', ['zelenovka', 'komarovka', 'yuryevka']],
  ['chernigovsky', 'Черниговский район', ['chernigovka']]
];

const decodeHtml = (value) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const readLegacyDirectory = async () => {
  const source = (await readFile(join(projectRoot, 'agents-directory.js'), 'utf8')).trim();
  const prefix = 'window.ASTRO_AGENT_DATA=';
  const dataStart = source.indexOf(prefix);
  if (dataStart < 0 || !source.endsWith(';')) {
    throw new Error('agents-directory.js has an unexpected format');
  }
  return JSON.parse(source.slice(dataStart + prefix.length, -1));
};

const extractHtmlAgents = async (citySlug) => {
  const source = await readFile(join(projectRoot, citySlug, 'index.html'), 'utf8');
  const cards = source.match(/<article class="agent-card"[\s\S]*?<\/article>/g) || [];
  return cards.flatMap((card, pointIndex) => {
    const address = decodeHtml(card.match(/<h3>([\s\S]*?)<\/h3>/)?.[1]);
    const phones = [...card.matchAll(/href="tel:\+?(\d{10,15})"/g)].map((match) => normalizePhone(match[1]));
    const note = decodeHtml(card.match(/<p class="agent-note">([\s\S]*?)<\/p>/)?.[1]) || null;
    const mapUrl = card.match(/<a class="agent-map-link" href="([^"]+)"/)?.[1] || null;
    if (!address) return [];
    return phones.filter(Boolean).map((phone, phoneIndex) => ({
      address,
      phone,
      note,
      mapUrl,
      sortOrder: pointIndex * 100 + phoneIndex
    }));
  });
};

const districtByLocality = new Map(districts.flatMap(([districtSlug, districtName, localities], districtOrder) =>
  localities.map((localitySlug, localityOrder) => [localitySlug, {
    districtSlug,
    districtName,
    districtOrder,
    localityOrder
  }])
));

export const loadAgentSeedRecords = async () => {
  const legacy = await readLegacyDirectory();
  const records = [];

  for (let cityOrder = 0; cityOrder < primaryCities.length; cityOrder += 1) {
    const [localitySlug, localityName] = primaryCities[cityOrder];
    const htmlAgents = await extractHtmlAgents(localitySlug);
    const nextSortOrder = htmlAgents.length ? Math.max(...htmlAgents.map((agent) => agent.sortOrder)) + 100 : 0;
    records.push(...htmlAgents.map((agent) => ({
      ...agent,
      localitySlug,
      localityName,
      districtSlug: null,
      districtName: null,
      districtOrder: null,
      localityOrder: cityOrder,
      isPrimaryCity: true
    })));

    const additions = legacy.existing?.[localitySlug] || [];
    additions.forEach(([address, phones], pointIndex) => {
      phones.forEach((phone, phoneIndex) => records.push({
        localitySlug,
        localityName,
        districtSlug: null,
        districtName: null,
        districtOrder: null,
        localityOrder: cityOrder,
        isPrimaryCity: true,
        address,
        phone: normalizePhone(phone),
        note: normalizeAddress(address) === 'безофиса' ? 'Свяжитесь с агентом, чтобы договориться о встрече' : null,
        mapUrl: null,
        sortOrder: nextSortOrder + pointIndex * 100 + phoneIndex
      }));
    });
  }

  Object.entries(legacy.additional || {}).forEach(([localitySlug, [localityName, points]], fallbackOrder) => {
    const district = districtByLocality.get(localitySlug) || {
      districtSlug: 'other',
      districtName: 'Другие населённые пункты',
      districtOrder: districts.length,
      localityOrder: fallbackOrder
    };
    points.forEach(([address, phones], pointIndex) => {
      phones.forEach((phone, phoneIndex) => records.push({
        localitySlug,
        localityName,
        ...district,
        isPrimaryCity: false,
        address,
        phone: normalizePhone(phone),
        note: normalizeAddress(address) === 'безофиса' ? 'Свяжитесь с агентом, чтобы договориться о встрече' : null,
        mapUrl: null,
        sortOrder: pointIndex * 100 + phoneIndex
      }));
    });
  });

  const uniqueRecords = new Map();
  records.forEach((record) => {
    if (!record.phone) return;
    const addressKey = normalizeAddress(record.address);
    const key = `${record.localitySlug}|${addressKey}|${record.phone}`;
    const existing = uniqueRecords.get(key);
    if (!existing) {
      uniqueRecords.set(key, { ...record, addressKey });
      return;
    }
    if (!existing.note && record.note) existing.note = record.note;
    if (!existing.mapUrl && record.mapUrl) existing.mapUrl = record.mapUrl;
    existing.sortOrder = Math.min(existing.sortOrder, record.sortOrder);
  });

  return [...uniqueRecords.values()];
};

export const groupAgentSeedRecords = (records) => {
  const groups = new Map();

  records.forEach((record) => {
    const isOffsite = record.addressKey === 'безофиса';
    const groupKey = isOffsite
      ? `${record.localitySlug}|${record.addressKey}|${record.phone}`
      : `${record.localitySlug}|${record.addressKey}`;
    const group = groups.get(groupKey) || { ...record, phones: [] };
    if (!group.phones.includes(record.phone)) group.phones.push(record.phone);
    group.sortOrder = Math.min(group.sortOrder, record.sortOrder);
    if (!group.note && record.note) group.note = record.note;
    if (!group.mapUrl && record.mapUrl) group.mapUrl = record.mapUrl;
    groups.set(groupKey, group);
  });

  return [...groups.values()];
};

export const seedAgentDirectory = async (client) => {
  const records = await loadAgentSeedRecords();
  const groups = groupAgentSeedRecords(records);

  for (const record of groups) {
    const existing = record.addressKey === 'безофиса'
      ? await client.query(
        `SELECT a.id
         FROM agents a
         JOIN agent_phones ap ON ap.agent_id = a.id AND ap.phone = $3
         WHERE a.city_slug = $1 AND a.address_key = $2 AND a.merged_into_agent_id IS NULL
         ORDER BY a.cabinet_enabled DESC, a.is_active DESC, a.created_at, a.id
         LIMIT 1`,
        [record.localitySlug, record.addressKey, record.phones[0]]
      )
      : await client.query(
        `SELECT id
         FROM agents
         WHERE city_slug = $1 AND address_key = $2 AND merged_into_agent_id IS NULL
         ORDER BY cabinet_enabled DESC, is_active DESC, created_at, id
         LIMIT 1`,
        [record.localitySlug, record.addressKey]
      );

    let agentId = existing.rows[0]?.id;
    if (agentId) {
      await client.query(
        `UPDATE agents
         SET locality_name = COALESCE(locality_name, $2),
             district_slug = COALESCE(district_slug, $3),
             district_name = COALESCE(district_name, $4),
             is_primary_city = COALESCE(is_primary_city, $5),
             district_order = COALESCE(district_order, $6),
             locality_order = COALESCE(locality_order, $7),
             sort_order = LEAST(COALESCE(sort_order, $8), $8),
             note = COALESCE(note, $9),
             map_url = COALESCE(map_url, $10)
         WHERE id = $1`,
        [
          agentId, record.localityName, record.districtSlug, record.districtName,
          record.isPrimaryCity, record.districtOrder, record.localityOrder,
          record.sortOrder, record.note, record.mapUrl
        ]
      );
    } else {
      agentId = randomUUID();
      await client.query(
        `INSERT INTO agents
           (id, login, display_name, city_slug, locality_name, district_slug, district_name,
            is_primary_city, district_order, locality_order, address, address_key, phone,
            password_hash, cabinet_enabled, is_active, sort_order, note, map_url)
         VALUES
           ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
            NULL, FALSE, TRUE, $13, $14, $15)`,
        [
          agentId,
          `Агент — ${record.address}`,
          record.localitySlug,
          record.localityName,
          record.districtSlug,
          record.districtName,
          record.isPrimaryCity,
          record.districtOrder,
          record.localityOrder,
          record.address,
          record.addressKey,
          record.phones[0],
          record.sortOrder,
          record.note,
          record.mapUrl
        ]
      );
    }

    for (let phoneIndex = 0; phoneIndex < record.phones.length; phoneIndex += 1) {
      await client.query(
        `INSERT INTO agent_phones (agent_id, phone, sort_order)
         VALUES ($1, $2, $3)
         ON CONFLICT (agent_id, phone)
         DO UPDATE SET sort_order = LEAST(agent_phones.sort_order, EXCLUDED.sort_order)`,
        [agentId, record.phones[phoneIndex], phoneIndex]
      );
    }
  }
  return groups.length;
};
