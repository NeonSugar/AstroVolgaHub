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

export const seedAgentDirectory = async (client) => {
  const records = await loadAgentSeedRecords();
  for (const record of records) {
    await client.query(
      `INSERT INTO agents
         (id, login, display_name, city_slug, locality_name, district_slug, district_name,
          is_primary_city, district_order, locality_order, address, address_key, phone,
          password_hash, cabinet_enabled, is_active, sort_order, note, map_url)
       VALUES
         ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          NULL, FALSE, TRUE, $13, $14, $15)
       ON CONFLICT (city_slug, address_key, phone)
       DO UPDATE SET locality_name = COALESCE(agents.locality_name, EXCLUDED.locality_name),
                     district_slug = COALESCE(agents.district_slug, EXCLUDED.district_slug),
                     district_name = COALESCE(agents.district_name, EXCLUDED.district_name),
                     is_primary_city = COALESCE(agents.is_primary_city, EXCLUDED.is_primary_city),
                     district_order = COALESCE(agents.district_order, EXCLUDED.district_order),
                     locality_order = COALESCE(agents.locality_order, EXCLUDED.locality_order),
                     sort_order = COALESCE(agents.sort_order, EXCLUDED.sort_order),
                     note = COALESCE(agents.note, EXCLUDED.note),
                     map_url = COALESCE(agents.map_url, EXCLUDED.map_url)`,
      [
        randomUUID(),
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
        record.phone,
        record.sortOrder,
        record.note,
        record.mapUrl
      ]
    );
  }
  return records.length;
};
