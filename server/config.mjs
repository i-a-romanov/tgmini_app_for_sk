import { createHash } from 'node:crypto';
export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const devAuth = env.DEV_AUTH === 'true';
  if (devAuth && (production || env.RENDER)) throw new Error('DEV_AUTH is forbidden on Render and in production');
  const baseUrl = env.APP_URL || env.RENDER_EXTERNAL_URL || 'http://127.0.0.1:3000';
  const url = new URL(baseUrl);
  if (production && url.protocol !== 'https:') throw new Error('APP_URL must be HTTPS in production');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('APP_URL must be an origin without path or credentials');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!devAuth && !env.BOT_TOKEN) throw new Error('BOT_TOKEN is required');
  if (!devAuth && (env.WEBHOOK_SECRET || '').length < 32) throw new Error('WEBHOOK_SECRET must contain at least 32 random characters');
  if (env.SUPPORT_URL && new URL(env.SUPPORT_URL).protocol !== 'https:') throw new Error('SUPPORT_URL must use HTTPS');
  return { production, devAuth, baseUrl: url.origin, databaseUrl: env.DATABASE_URL,
    botToken: env.BOT_TOKEN, webhookSecret: env.WEBHOOK_SECRET ? createHash('sha256').update(env.WEBHOOK_SECRET).digest('hex') : undefined,
    port: Number(env.PORT || 3000), host: env.HOST || '0.0.0.0',
    autoConfigureBot: env.AUTO_CONFIGURE_BOT === 'true',
    reminders: env.ENABLE_REMINDERS !== 'false', pilot: env.PILOT_MODE !== 'false',
    supportUrl: env.SUPPORT_URL || '', operatorName: env.OPERATOR_NAME || 'Команда SK Fast Track',
    dbSsl: env.DATABASE_SSL === 'true',
  };
}
