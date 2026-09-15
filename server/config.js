import 'dotenv/config';

const booleanValue = (value) => String(value || '').toLowerCase() === 'true';

export const getConfig = () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: Number.parseInt(process.env.PORT || '4174', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  databaseSsl: booleanValue(process.env.DB_SSL),
  cookieSecure: booleanValue(process.env.COOKIE_SECURE)
});

export const assertConfig = (config) => {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is required');
  if (config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
  if (!/^[a-z0-9.:-]+$/i.test(config.host)) throw new Error('HOST is invalid');
};
