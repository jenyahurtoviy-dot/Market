const crypto = require('crypto');

// Проверяет initData, которую Mini App присылает нам сам о себе.
// Без этой проверки любой мог бы прислать "я user 12345" и купить от чужого имени.
// Алгоритм — официальный, из документации Telegram WebApp.
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const check = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // timingSafeEqual требует буферы одинаковой длины
  const a = Buffer.from(check, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > 86400) return null; // initData старше суток считаем просроченной

  const userRaw = params.get('user');
  return userRaw ? JSON.parse(userRaw) : null;
}

module.exports = { validateInitData };
