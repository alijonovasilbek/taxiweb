const crypto = require('crypto');

function verifyTelegramInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function verifyAuthDate(initData, maxAgeSeconds = 300) {
  const params = new URLSearchParams(initData);
  const authDate = parseInt(params.get('auth_date'), 10);
  if (!authDate) return false;
  return Date.now() / 1000 - authDate <= maxAgeSeconds;
}

module.exports = { verifyTelegramInitData, verifyAuthDate };
