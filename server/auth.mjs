import { createHmac, timingSafeEqual } from 'node:crypto';

/** Server-only, bot-token HMAC flow. Do not bundle this module into the client. */
export function validateInitData(raw, botToken, now = Math.floor(Date.now() / 1000)) {
  const fail = () => { throw new Error('Invalid Telegram launch data'); };
  if (!botToken || typeof raw !== 'string' || raw.length > 16384 || !raw) fail();
  const params = new URLSearchParams(raw);
  const seen = new Set();
  for (const [key] of params) {
    if (seen.has(key)) fail();
    seen.add(key);
  }
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) fail();
  params.delete('hash');
  // For bot-token HMAC, keep every field other than hash, including signature.
  // Telegram's separate third-party Ed25519 flow has different exclusion rules.
  const check = [...params.entries()]
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) fail();
  const date = params.get('auth_date');
  if (!date || !/^\d+$/.test(date)) fail();
  const authDate = Number(date);
  // Product policy: exchange within 5 minutes, allowing 30 seconds of skew.
  if (!Number.isSafeInteger(authDate) || now - authDate > 300 || authDate > now + 30) fail();
  let user;
  try { user = JSON.parse(params.get('user') || 'null'); } catch { fail(); }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 ||
      typeof user.first_name !== 'string' || user.is_bot === true) fail();
  return { telegramId: String(user.id), firstName: user.first_name, authDate };
}

// Route responsibilities after validation: upsert user, create an opaque session,
// set Secure/HttpOnly/SameSite cookie, and return only the app's own profile.
// This validator alone does not provide sessions, replay prevention or rate limits.
