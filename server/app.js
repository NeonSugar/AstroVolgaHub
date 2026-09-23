import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import connectPgSimple from 'connect-pg-simple';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import {
  callbackStatuses,
  isUuid,
  validateAgentLogin,
  validateCallbackStatusDetails,
  validateCustomerName,
  validateCustomerPhone,
  validateSourcePath
} from './validation.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(currentDirectory, '..');
const cityDirectories = [
  'berdyansk', 'energodar', 'kamenka', 'melitopol', 'primorsk',
  'tokmak', 'vasilevka', 'veseloe', 'znamenka'
];

const sessionRegenerate = (request) => new Promise((resolve, reject) => {
  request.session.regenerate((error) => error ? reject(error) : resolve());
});

const sessionDestroy = (request) => new Promise((resolve, reject) => {
  request.session.destroy((error) => error ? reject(error) : resolve());
});

const getCsrfToken = (request) => {
  if (!request.session.csrfToken) request.session.csrfToken = randomBytes(32).toString('hex');
  return request.session.csrfToken;
};

const tokensMatch = (actual, expected) => {
  if (typeof actual !== 'string' || typeof expected !== 'string') return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
};

const requireCsrf = (request, response, next) => {
  const providedToken = request.get('x-csrf-token');
  if (!tokensMatch(providedToken, request.session.csrfToken)) {
    return response.status(403).json({ error: 'Сессия формы устарела. Обновите страницу и повторите попытку.' });
  }
  return next();
};

const publicAgent = (row) => ({
  id: row.id,
  displayName: row.display_name,
  citySlug: row.city_slug,
  address: row.address,
  addressKey: row.address_key,
  phone: row.phone
});

const callbackRequest = (row) => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone,
  status: row.status,
  statusDetails: row.status_details || {},
  sourcePath: row.source_path,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createApp = ({ pool, config }) => {
  const app = express();
  const PgStore = connectPgSimple(session);
  const production = config.nodeEnv === 'production';

  const requireAgent = async (request, response, next) => {
    if (!request.session.agentId) return response.status(401).json({ error: 'Требуется вход в личный кабинет.' });
    try {
      const result = await pool.query(
        'SELECT 1 FROM agents WHERE id = $1 AND cabinet_enabled = TRUE',
        [request.session.agentId]
      );
      if (result.rowCount) return next();
      await sessionDestroy(request);
      return response.status(401).json({ error: 'Доступ к кабинету отключён.' });
    } catch (error) {
      return next(error);
    }
  };

  app.disable('x-powered-by');
  if (config.cookieSecure) app.set('trust proxy', 1);
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));
  app.use(express.json({ limit: '12kb' }));
  app.use(session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    name: 'astro_agent_session',
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      maxAge: 12 * 60 * 60 * 1000
    }
  }));

  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много попыток входа. Повторите позже.' }
  });
  const callbackLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Слишком много заявок. Повторите позже.' }
  });

  app.get('/api/health', async (_request, response, next) => {
    try {
      await pool.query('SELECT 1');
      response.json({ status: 'ok' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/csrf', (request, response) => {
    response.json({ token: getCsrfToken(request) });
  });

  app.get('/api/public/agents', async (request, response, next) => {
    try {
      const city = String(request.query.city || '').trim().toLowerCase();
      if (!/^[a-z0-9-]{2,80}$/.test(city)) return response.status(400).json({ error: 'Некорректный город.' });
      const result = await pool.query(
        `SELECT id, display_name, city_slug, address, address_key, phone
         FROM agents
         WHERE city_slug = $1 AND cabinet_enabled = TRUE
         ORDER BY address, display_name`,
        [city]
      );
      return response.json({ agents: result.rows.map(publicAgent) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/callback-requests', callbackLimiter, requireCsrf, async (request, response, next) => {
    try {
      const agentId = String(request.body.agentId || '').trim();
      const customerName = validateCustomerName(request.body.name);
      const customerPhone = validateCustomerPhone(request.body.phone);
      const sourcePath = validateSourcePath(request.body.sourcePath);
      if (!isUuid(agentId) || !customerName || !customerPhone || request.body.consent !== true) {
        return response.status(400).json({ error: 'Проверьте имя, телефон и согласие на обработку данных.' });
      }

      const agentResult = await pool.query(
        'SELECT id FROM agents WHERE id = $1 AND cabinet_enabled = TRUE',
        [agentId]
      );
      if (!agentResult.rowCount) return response.status(404).json({ error: 'Личный кабинет агента недоступен.' });

      const result = await pool.query(
        `INSERT INTO callback_requests
           (id, agent_id, customer_name, customer_phone, consent_version, source_path)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [randomUUID(), agentId, customerName, customerPhone, 'privacy-2026-09', sourcePath]
      );
      return response.status(201).json({
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        message: 'Заявка отправлена агенту.'
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/auth/login', loginLimiter, requireCsrf, async (request, response, next) => {
    try {
      const login = validateAgentLogin(request.body.login);
      const password = String(request.body.password || '');
      if (!login || password.length < 1 || password.length > 200) {
        return response.status(400).json({ error: 'Введите логин и пароль.' });
      }
      const result = await pool.query(
        `SELECT id, login, display_name, city_slug, address, phone, password_hash
         FROM agents
         WHERE login = $1 AND cabinet_enabled = TRUE`,
        [login]
      );
      const agent = result.rows[0];
      const validPassword = agent ? await bcrypt.compare(password, agent.password_hash) : false;
      if (!validPassword) return response.status(401).json({ error: 'Неверный логин или пароль.' });

      await sessionRegenerate(request);
      request.session.agentId = agent.id;
      const token = getCsrfToken(request);
      return response.json({
        token,
        agent: {
          displayName: agent.display_name,
          citySlug: agent.city_slug,
          address: agent.address,
          phone: agent.phone
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/auth/logout', requireCsrf, requireAgent, async (request, response, next) => {
    try {
      await sessionDestroy(request);
      response.clearCookie('astro_agent_session');
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/auth/me', async (request, response, next) => {
    try {
      if (!request.session.agentId) return response.status(401).json({ error: 'Требуется вход в личный кабинет.' });
      const result = await pool.query(
        `SELECT display_name, city_slug, address, phone
         FROM agents WHERE id = $1 AND cabinet_enabled = TRUE`,
        [request.session.agentId]
      );
      if (!result.rowCount) {
        await sessionDestroy(request);
        return response.status(401).json({ error: 'Доступ к кабинету отключён.' });
      }
      const agent = result.rows[0];
      return response.json({
        agent: {
          displayName: agent.display_name,
          citySlug: agent.city_slug,
          address: agent.address,
          phone: agent.phone
        }
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/agent/callback-requests', requireAgent, async (request, response, next) => {
    try {
      const status = String(request.query.status || 'all');
      const parameters = [request.session.agentId];
      let statusFilter = '';
      if (status !== 'all') {
        if (!callbackStatuses.has(status)) return response.status(400).json({ error: 'Некорректный статус.' });
        parameters.push(status);
        statusFilter = 'AND status = $2';
      }
      const [result, statsResult] = await Promise.all([
        pool.query(
          `SELECT id, customer_name, customer_phone, status, status_details, source_path, created_at, updated_at
           FROM callback_requests
           WHERE agent_id = $1 ${statusFilter}
           ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
           LIMIT 200`,
          parameters
        ),
        pool.query(
          `SELECT COUNT(*)::INTEGER AS all,
                  COUNT(*) FILTER (WHERE status = 'new')::INTEGER AS new,
                  COUNT(*) FILTER (WHERE status = 'in_progress')::INTEGER AS in_progress,
                  COUNT(*) FILTER (WHERE status = 'processed')::INTEGER AS processed,
                  COUNT(*) FILTER (WHERE status = 'rejected')::INTEGER AS rejected
           FROM callback_requests
           WHERE agent_id = $1`,
          [request.session.agentId]
        )
      ]);
      return response.json({ requests: result.rows.map(callbackRequest), stats: statsResult.rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/api/agent/callback-requests/:id', requireAgent, requireCsrf, async (request, response, next) => {
    try {
      const requestId = String(request.params.id || '');
      const status = String(request.body.status || '');
      if (!isUuid(requestId) || !callbackStatuses.has(status)) {
        return response.status(400).json({ error: 'Некорректные параметры заявки.' });
      }
      const statusDetails = validateCallbackStatusDetails(status, request.body.details);
      if (!statusDetails) {
        return response.status(400).json({ error: 'Заполните детали изменения статуса.' });
      }
      const result = await pool.query(
        `UPDATE callback_requests
         SET status = $1, status_details = $2::JSONB, updated_at = NOW()
         WHERE id = $3 AND agent_id = $4
         RETURNING id, customer_name, customer_phone, status, status_details, source_path, created_at, updated_at`,
        [status, JSON.stringify(statusDetails), requestId, request.session.agentId]
      );
      if (!result.rowCount) return response.status(404).json({ error: 'Заявка не найдена.' });
      return response.json({ request: callbackRequest(result.rows[0]) });
    } catch (error) {
      return next(error);
    }
  });

  app.use('/assets', express.static(join(projectRoot, 'assets'), { dotfiles: 'deny', maxAge: production ? '7d' : 0 }));
  cityDirectories.forEach((city) => {
    app.use(`/${city}`, express.static(join(projectRoot, city), { dotfiles: 'deny', maxAge: production ? '1h' : 0 }));
  });
  app.use('/agent', express.static(join(projectRoot, 'agent'), { dotfiles: 'deny', maxAge: production ? '1h' : 0 }));
  app.get(['/styles.css', '/script.js', '/agents-directory.js'], (request, response) => {
    response.sendFile(join(projectRoot, request.path.slice(1)));
  });

  app.get('/yandex_5feb11370c3fa519.html', (_request, response) => {
    response.sendFile(join(projectRoot, 'yandex_5feb11370c3fa519.html'));
  });

  app.get('/preview.jpg', (_request, response) => {
    response.sendFile(join(projectRoot, 'preview.jpg'));
  });

  app.get(['/', '/index.html'], (_request, response) => response.sendFile(join(projectRoot, 'index.html')));

  app.use('/api', (_request, response) => response.status(404).json({ error: 'API method not found.' }));
  app.use((_request, response) => response.status(404).sendFile(join(projectRoot, 'index.html')));

  app.use((error, _request, response, _next) => {
    console.error(error);
    if (error?.type === 'entity.parse.failed') return response.status(400).json({ error: 'Некорректный JSON.' });
    if (error?.code === '22P02') return response.status(400).json({ error: 'Некорректный идентификатор.' });
    return response.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  });

  return app;
};
