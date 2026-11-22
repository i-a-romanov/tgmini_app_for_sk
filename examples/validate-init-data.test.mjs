import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInitData } from './validate-init-data.mjs';
// Synthetic fixtures independently signed with Python stdlib HMAC, not this validator.
const f = JSON.parse(readFileSync(new URL('./auth-fixtures.json', import.meta.url)));
const validate = raw => validateInitData(raw, f.token, f.now);
test('valid HMAC handles Unicode, encoded plus, 52-bit ID and signature field', () => {
  assert.deepEqual(validate(f.valid), {
    telegramId: '1234567890123', firstName: 'Маша + тест', authDate: f.now,
  });
});
test('query-string order is irrelevant', () => {
  assert.equal(validate(f.valid.split('&').reverse().join('&')).telegramId, '1234567890123');
});
test('boundary age is accepted', () => assert.equal(validate(f.boundary).authDate, f.now - 300));
for (const field of ['expired', 'future', 'invalidDate', 'badJson', 'invalidId']) {
  test(`rejects signed ${field} payload`, () => assert.throws(() => validate(f[field])));
}
test('rejects a tampered user', () => assert.throws(() => validate(f.valid.replace('1234567890123', '1234567890124'))));
test('rejects duplicate fields', () => assert.throws(() => validate(f.valid + '&auth_date=' + f.now)));
test('rejects malformed hash without Buffer length errors', () => {
  const p = new URLSearchParams(f.valid); p.set('hash', 'aa');
  assert.throws(() => validate(p.toString()), /Invalid Telegram/);
});
test('rejects wrong bot and missing data', () => {
  assert.throws(() => validateInitData(f.valid, 'wrong-token', f.now));
  assert.throws(() => validate(''));
});
test('rejects signature removal in the bot-token HMAC flow', () => {
  const p = new URLSearchParams(f.valid); p.delete('signature');
  assert.throws(() => validate(p.toString()));
});
