const { verifyTelegramInitData, verifyAuthDate } = require('../utils/crypto');
const { signJWT } = require('../utils/jwt');
const db = require('../config/database');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function authenticatePassenger(initData) {
  if (!verifyTelegramInitData(initData, BOT_TOKEN)) {
    throw Object.assign(new Error('Invalid Telegram initData'), { status: 401 });
  }
  if (!verifyAuthDate(initData)) {
    throw Object.assign(new Error('initData expired'), { status: 401 });
  }

  const params = new URLSearchParams(initData);
  const telegramUser = JSON.parse(params.get('user') || '{}');

  if (!telegramUser.id) {
    throw Object.assign(new Error('No user in initData'), { status: 400 });
  }

  let user = await db('users').where({ telegram_id: telegramUser.id }).first();
  if (!user) {
    [user] = await db('users')
      .insert({
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      })
      .returning('*');
  } else {
    await db('users').where({ id: user.id }).update({
      telegram_username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      updated_at: db.fn.now(),
    });
  }

  if (user.is_blocked) {
    throw Object.assign(new Error('User is blocked'), { status: 403 });
  }

  const token = signJWT({ id: user.id, telegramId: user.telegram_id, role: 'passenger' });
  return { token, user };
}

async function authenticateDriver(initData) {
  if (!verifyTelegramInitData(initData, BOT_TOKEN)) {
    throw Object.assign(new Error('Invalid Telegram initData'), { status: 401 });
  }
  if (!verifyAuthDate(initData)) {
    throw Object.assign(new Error('initData expired'), { status: 401 });
  }

  const params = new URLSearchParams(initData);
  const telegramUser = JSON.parse(params.get('user') || '{}');

  const driver = await db('drivers').where({ telegram_id: telegramUser.id }).first();

  const token = signJWT({
    telegramId: telegramUser.id,
    role: 'driver',
    driverId: driver?.id || null,
    status: driver?.status || 'unregistered',
  });

  return { token, driver, telegramUser };
}

module.exports = { authenticatePassenger, authenticateDriver };
