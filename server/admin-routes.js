import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import {
  callbackStatuses,
  isUuid,
  normalizeAddress,
  normalizePhone,
  validateAgentLogin
} from './validation.js';

const cleanText = (value, maximumLength) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text && text.length <= maximumLength ? text : null;
};

const cleanMapUrl = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && text.length <= 500 ? text : null;
  } catch (_error) {
    return null;
  }
};

const normalizePhoneList = (value) => {
  const source = Array.isArray(value) ? value : [value];
  return [...new Set(source.map(normalizePhone).filter(Boolean))];
};

const requestDto = (row) => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  status: row.status,
  statusDetails: row.status_details || {},
  sourcePath: row.source_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  agent: {
    id: row.agent_id,
    displayName: row.agent_name,
    localitySlug: row.city_slug,
    localityName: row.locality_name || row.city_slug,
    address: row.agent_address,
    phone: row.agent_phones?.[0] || row.agent_phone,
    phones: row.agent_phones?.length ? row.agent_phones : [row.agent_phone].filter(Boolean),
    isActive: Boolean(row.agent_active)
  }
});

const agentDto = (row) => ({
  id: row.id,
  displayName: row.display_name,
  localitySlug: row.city_slug,
  localityName: row.locality_name || row.city_slug,
  districtName: row.district_name,
  address: row.address,
  phone: row.phones?.[0] || row.phone,
  phones: row.phones?.length ? row.phones : [row.phone].filter(Boolean),
  note: row.note,
  mapUrl: row.map_url,
  login: row.login,
  hasCabinet: Boolean(row.cabinet_enabled),
  isActive: Boolean(row.is_active),
  requests: {
    all: Number(row.requests_all || 0),
    new: Number(row.requests_new || 0),
    inProgress: Number(row.requests_in_progress || 0),
    processed: Number(row.requests_processed || 0),
    rejected: Number(row.requests_rejected || 0)
  }
});

export const createAdminRouter = ({
  pool,
  loginLimiter,
  requireAdmin,
  requireCsrf,
  getCsrfToken,
  sessionRegenerate,
  sessionDestroy
}) => {
  const router = express.Router();

  router.post('/auth/login', loginLimiter, requireCsrf, async (request, response, next) => {
    try {
      const login = validateAgentLogin(request.body.login);
      const password = String(request.body.password || '');
      if (!login || !password || password.length > 200) {
        return response.status(400).json({ error: 'Введите логин и пароль.' });
      }
      const result = await pool.query(
        `SELECT id, display_name, password_hash
         FROM administrators
         WHERE login = $1 AND is_active = TRUE`,
        [login]
      );
      const administrator = result.rows[0];
      const validPassword = administrator
        ? await bcrypt.compare(password, administrator.password_hash)
        : false;
      if (!validPassword) return response.status(401).json({ error: 'Неверный логин или пароль.' });

      await sessionRegenerate(request);
      request.session.adminId = administrator.id;
      return response.json({
        token: getCsrfToken(request),
        administrator: { displayName: administrator.display_name }
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/auth/me', async (request, response, next) => {
    try {
      if (!request.session.adminId) return response.status(401).json({ error: 'Требуется вход администратора.' });
      const result = await pool.query(
        'SELECT display_name FROM administrators WHERE id = $1 AND is_active = TRUE',
        [request.session.adminId]
      );
      if (!result.rowCount) {
        await sessionDestroy(request);
        return response.status(401).json({ error: 'Доступ администратора отключён.' });
      }
      return response.json({ administrator: { displayName: result.rows[0].display_name } });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/auth/logout', requireCsrf, requireAdmin, async (request, response, next) => {
    try {
      await sessionDestroy(request);
      response.clearCookie('astro_agent_session');
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.use(requireAdmin);

  router.get('/overview', async (_request, response, next) => {
    try {
      const [statsResult, citiesResult, agentsResult] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::INTEGER AS all,
                  COUNT(*) FILTER (WHERE status = 'new')::INTEGER AS new,
                  COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER AS in_progress,
                  COUNT(*) FILTER (WHERE status = 'processed')::INTEGER AS processed,
                  COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER AS rejected
           FROM callback_requests`
        ),
        pool.query(
          `SELECT a.city_slug,
                  MAX(COALESCE(a.locality_name, a.city_slug)) AS locality_name,
                  COUNT(DISTINCT a.id) FILTER (WHERE a.is_active = TRUE)::INTEGER AS agent_count,
                  COUNT(cr.id)::INTEGER AS all,
                  COUNT(cr.id) FILTER (WHERE cr.status = 'new')::INTEGER AS new,
                  COUNT(cr.id) FILTER (WHERE cr.status = 'in_progress')::INTEGER AS in_progress,
                  COUNT(cr.id) FILTER (WHERE cr.status = 'processed')::INTEGER AS processed,
                  COUNT(cr.id) FILTER (WHERE cr.status = 'rejected')::INTEGER AS rejected
           FROM agents a
           LEFT JOIN callback_requests cr ON cr.agent_id = a.id
           WHERE a.merged_into_agent_id IS NULL
           GROUP BY a.city_slug
           ORDER BY MAX(a.is_primary_city::INTEGER) DESC,
                    MIN(a.district_order) NULLS FIRST,
                    MIN(a.locality_order) NULLS LAST,
                    locality_name`
        ),
        pool.query(
          `SELECT COUNT(*) FILTER (WHERE is_active = TRUE)::INTEGER AS active,
                  COUNT(*) FILTER (WHERE is_active = TRUE AND cabinet_enabled = TRUE)::INTEGER AS cabinets,
                  COUNT(*) FILTER (WHERE is_active = FALSE)::INTEGER AS inactive
           FROM agents
           WHERE merged_into_agent_id IS NULL`
        )
      ]);
      return response.json({
        stats: statsResult.rows[0],
        agentStats: agentsResult.rows[0],
        cities: citiesResult.rows.map((row) => ({
          localitySlug: row.city_slug,
          localityName: row.locality_name,
          agentCount: row.agent_count,
          requests: {
            all: row.all,
            new: row.new,
            inProgress: row.in_progress,
            processed: row.processed,
            rejected: row.rejected
          }
        }))
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/agents', async (_request, response, next) => {
    try {
      const result = await pool.query(
        `SELECT a.id, a.login, a.display_name, a.city_slug, a.locality_name, a.district_name,
                a.address, a.phone, a.note, a.map_url, a.cabinet_enabled, a.is_active,
                COALESCE(
                  NULLIF(ARRAY(
                    SELECT ap.phone FROM agent_phones ap
                    WHERE ap.agent_id = a.id
                    ORDER BY ap.sort_order, ap.created_at, ap.phone
                  ), ARRAY[]::VARCHAR[]),
                  ARRAY[a.phone]
                ) AS phones,
                COUNT(cr.id)::INTEGER AS requests_all,
                COUNT(cr.id) FILTER (WHERE cr.status = 'new')::INTEGER AS requests_new,
                COUNT(cr.id) FILTER (WHERE cr.status = 'in_progress')::INTEGER AS requests_in_progress,
                COUNT(cr.id) FILTER (WHERE cr.status = 'processed')::INTEGER AS requests_processed,
                COUNT(cr.id) FILTER (WHERE cr.status = 'rejected')::INTEGER AS requests_rejected
         FROM agents a
         LEFT JOIN callback_requests cr ON cr.agent_id = a.id
         WHERE a.merged_into_agent_id IS NULL
         GROUP BY a.id
         ORDER BY a.is_active DESC, a.is_primary_city DESC NULLS LAST,
                  a.district_order NULLS FIRST, a.locality_order NULLS LAST,
                  a.locality_name, a.sort_order NULLS LAST, a.address, a.phone`
      );
      return response.json({ agents: result.rows.map(agentDto) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/callback-requests', async (request, response, next) => {
    try {
      const status = String(request.query.status || 'all');
      const locality = String(request.query.locality || '').trim().toLowerCase();
      const agentId = String(request.query.agentId || '').trim();
      if (status !== 'all' && !callbackStatuses.has(status)) {
        return response.status(400).json({ error: 'Некорректный статус.' });
      }
      if (locality && !/^[a-z0-9-]{2,80}$/.test(locality)) {
        return response.status(400).json({ error: 'Некорректный населённый пункт.' });
      }
      if (agentId && !isUuid(agentId)) {
        return response.status(400).json({ error: 'Некорректный агент.' });
      }
      const clauses = [];
      const parameters = [];
      const addFilter = (sql, value) => {
        parameters.push(value);
        clauses.push(sql.replace('?', `$${parameters.length}`));
      };
      if (status !== 'all') addFilter('cr.status = ?', status);
      if (locality) addFilter('a.city_slug = ?', locality);
      if (agentId) addFilter('a.id = ?', agentId);
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT cr.id, cr.agent_id, cr.customer_name, cr.customer_phone, cr.status,
                cr.status_details, cr.source_path, cr.created_at, cr.updated_at,
                a.display_name AS agent_name, a.city_slug, a.locality_name,
                a.address AS agent_address, a.phone AS agent_phone, a.is_active AS agent_active,
                COALESCE(
                  NULLIF(ARRAY(
                    SELECT ap.phone FROM agent_phones ap
                    WHERE ap.agent_id = a.id
                    ORDER BY ap.sort_order, ap.created_at, ap.phone
                  ), ARRAY[]::VARCHAR[]),
                  ARRAY[a.phone]
                ) AS agent_phones
         FROM callback_requests cr
         JOIN agents a ON a.id = cr.agent_id
         ${where}
         ORDER BY CASE WHEN cr.status = 'new' THEN 0 ELSE 1 END, cr.created_at DESC
         LIMIT 500`,
        parameters
      );
      return response.json({ requests: result.rows.map(requestDto) });
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/callback-requests/:id/agent', requireCsrf, async (request, response, next) => {
    const requestId = String(request.params.id || '');
    const targetAgentId = String(request.body.agentId || '');
    if (!isUuid(requestId) || !isUuid(targetAgentId)) {
      return response.status(400).json({ error: 'Некорректная заявка или агент.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const callbackResult = await client.query(
        `SELECT cr.id, cr.agent_id, a.city_slug
         FROM callback_requests cr
         JOIN agents a ON a.id = cr.agent_id
         WHERE cr.id = $1
         FOR UPDATE OF cr`,
        [requestId]
      );
      if (!callbackResult.rowCount) {
        await client.query('ROLLBACK');
        return response.status(404).json({ error: 'Заявка не найдена.' });
      }

      const callback = callbackResult.rows[0];
      if (callback.agent_id === targetAgentId) {
        await client.query('ROLLBACK');
        return response.status(409).json({ error: 'Заявка уже назначена этому агенту.' });
      }

      const targetResult = await client.query(
        `SELECT id, display_name, city_slug
         FROM agents
         WHERE id = $1 AND is_active = TRUE AND cabinet_enabled = TRUE
           AND merged_into_agent_id IS NULL`,
        [targetAgentId]
      );
      if (!targetResult.rowCount) {
        await client.query('ROLLBACK');
        return response.status(404).json({ error: 'Активный личный кабинет выбранного агента не найден.' });
      }

      const targetAgent = targetResult.rows[0];
      if (targetAgent.city_slug !== callback.city_slug) {
        await client.query('ROLLBACK');
        return response.status(409).json({ error: 'Передать заявку можно только агенту из того же населённого пункта.' });
      }

      await client.query(
        `UPDATE callback_requests
         SET agent_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [targetAgentId, requestId]
      );
      await client.query('COMMIT');
      return response.json({
        id: requestId,
        agentId: targetAgent.id,
        message: `Заявка передана агенту «${targetAgent.display_name}».`
      });
    } catch (error) {
      await client.query('ROLLBACK');
      return next(error);
    } finally {
      client.release();
    }
  });

  router.post('/agents', requireCsrf, async (request, response, next) => {
    const localitySlug = String(request.body.localitySlug || '').trim().toLowerCase();
    const displayName = cleanText(request.body.displayName, 160);
    const address = cleanText(request.body.address, 240);
    const phones = normalizePhoneList(request.body.phones?.length ? request.body.phones : request.body.phone);
    const note = String(request.body.note || '').trim().replace(/\s+/g, ' ') || null;
    const rawMapUrl = String(request.body.mapUrl || '').trim();
    const mapUrl = cleanMapUrl(rawMapUrl);
    const cabinetEnabled = request.body.cabinetEnabled === true;
    const login = cabinetEnabled ? validateAgentLogin(request.body.login) : null;
    const password = cabinetEnabled ? String(request.body.password || '') : '';

    if (!/^[a-z0-9-]{2,80}$/.test(localitySlug) || !displayName || !address
      || !phones.length || phones.length > 20
      || phones.some((phone) => phone.length < 10 || phone.length > 15) || (note && note.length > 240)
      || (rawMapUrl && !mapUrl) || (cabinetEnabled && (!login || password.length < 12 || password.length > 200))) {
      return response.status(400).json({ error: 'Проверьте данные агента. Пароль кабинета должен содержать не менее 12 символов.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const localityResult = await client.query(
        `SELECT locality_name, district_slug, district_name, is_primary_city,
                district_order, locality_order
         FROM agents
         WHERE city_slug = $1 AND merged_into_agent_id IS NULL
         ORDER BY is_active DESC, sort_order NULLS LAST
         LIMIT 1`,
        [localitySlug]
      );
      if (!localityResult.rowCount) {
        await client.query('ROLLBACK');
        return response.status(400).json({ error: 'Населённый пункт не найден в справочнике.' });
      }
      const addressKey = normalizeAddress(address);
      const existing = addressKey === 'безофиса'
        ? await client.query(
          `SELECT a.id, a.is_active
           FROM agents a
           JOIN agent_phones ap ON ap.agent_id = a.id
           WHERE a.city_slug = $1 AND a.address_key = $2
             AND a.merged_into_agent_id IS NULL AND ap.phone = ANY($3::VARCHAR[])
           LIMIT 1`,
          [localitySlug, addressKey, phones]
        )
        : await client.query(
          `SELECT id, is_active FROM agents
           WHERE city_slug = $1 AND address_key = $2 AND merged_into_agent_id IS NULL
           LIMIT 1`,
          [localitySlug, addressKey]
        );
      if (existing.rowCount) {
        await client.query('ROLLBACK');
        return response.status(409).json({
          error: existing.rows[0].is_active
            ? (addressKey === 'безофиса'
              ? 'Агент «Без офиса» с одним из этих телефонов уже существует.'
              : 'Агент с таким адресом в этом населённом пункте уже существует.')
            : 'Такой агент был удалён. Восстановите его в списке неактивных.',
          agentId: existing.rows[0].id
        });
      }
      const metadata = localityResult.rows[0];
      const orderResult = await client.query(
        'SELECT COALESCE(MAX(sort_order), -100) + 100 AS next_order FROM agents WHERE city_slug = $1',
        [localitySlug]
      );
      const passwordHash = cabinetEnabled ? await bcrypt.hash(password, 12) : null;
      const agentId = randomUUID();
      const result = await client.query(
        `INSERT INTO agents
           (id, login, display_name, city_slug, locality_name, district_slug, district_name,
            is_primary_city, district_order, locality_order, address, address_key, phone,
            password_hash, cabinet_enabled, is_active, sort_order, note, map_url)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
            $14, $15, TRUE, $16, $17, $18)
         RETURNING id`,
        [
          agentId, login, displayName, localitySlug, metadata.locality_name,
          metadata.district_slug, metadata.district_name, metadata.is_primary_city,
          metadata.district_order, metadata.locality_order, address, addressKey,
          phones[0], passwordHash, cabinetEnabled, orderResult.rows[0].next_order, note, mapUrl
        ]
      );
      for (let phoneIndex = 0; phoneIndex < phones.length; phoneIndex += 1) {
        await client.query(
          `INSERT INTO agent_phones (agent_id, phone, sort_order)
           VALUES ($1, $2, $3)`,
          [agentId, phones[phoneIndex], phoneIndex]
        );
      }
      await client.query('COMMIT');
      return response.status(201).json({ id: result.rows[0].id, message: 'Агент добавлен.' });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return response.status(409).json({ error: 'Логин или данные агента уже используются.' });
      return next(error);
    } finally {
      client.release();
    }
  });

  router.patch('/agents/:id/cabinet', requireCsrf, async (request, response, next) => {
    try {
      if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Некорректный агент.' });
      const login = validateAgentLogin(request.body.login);
      const password = String(request.body.password || '');
      if (!login || password.length < 12 || password.length > 200) {
        return response.status(400).json({ error: 'Проверьте логин и пароль. Пароль должен содержать не менее 12 символов.' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `UPDATE agents
         SET login = $1, password_hash = $2, cabinet_enabled = TRUE, updated_at = NOW()
         WHERE id = $3 AND is_active = TRUE AND merged_into_agent_id IS NULL
         RETURNING id, login`,
        [login, passwordHash, request.params.id]
      );
      if (!result.rowCount) return response.status(404).json({ error: 'Активный агент не найден.' });
      return response.json({
        id: result.rows[0].id,
        login: result.rows[0].login,
        message: 'Личный кабинет агента настроен.'
      });
    } catch (error) {
      if (error.code === '23505') return response.status(409).json({ error: 'Этот логин уже используется.' });
      return next(error);
    }
  });

  router.delete('/agents/:id', requireCsrf, async (request, response, next) => {
    try {
      if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Некорректный агент.' });
      const result = await pool.query(
        `UPDATE agents
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND is_active = TRUE AND merged_into_agent_id IS NULL
         RETURNING id`,
        [request.params.id]
      );
      if (!result.rowCount) return response.status(404).json({ error: 'Активный агент не найден.' });
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/agents/:id/restore', requireCsrf, async (request, response, next) => {
    try {
      if (!isUuid(request.params.id)) return response.status(400).json({ error: 'Некорректный агент.' });
      const result = await pool.query(
        `UPDATE agents SET is_active = TRUE, updated_at = NOW()
         WHERE id = $1 AND is_active = FALSE AND merged_into_agent_id IS NULL
         RETURNING id`,
        [request.params.id]
      );
      if (!result.rowCount) return response.status(404).json({ error: 'Удалённый агент не найден.' });
      return response.json({ id: result.rows[0].id, message: 'Агент восстановлен.' });
    } catch (error) {
      return next(error);
    }
  });

  return router;
};
