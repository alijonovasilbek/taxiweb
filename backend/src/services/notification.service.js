const db = require('../config/database');
const logger = require('../utils/logger');

let bot;
function setBot(b) { bot = b; }

async function sendToPassenger(userId, { type, message, data }) {
  await db('notifications').insert({ user_id: userId, type, message, data: JSON.stringify(data || {}) }).catch(() => {});
  if (!bot) return;
  try {
    const user = await db('users').where({ id: userId }).first();
    if (user?.telegram_id) await bot.telegram.sendMessage(user.telegram_id, message);
  } catch (err) {
    logger.warn('Bot sendMessage failed:', err.message);
  }
}

async function sendToDriver(driverId, { type, message, data }) {
  await db('notifications').insert({ driver_id: driverId, type, message, data: JSON.stringify(data || {}) }).catch(() => {});
  if (!bot) return;
  try {
    const driver = await db('drivers').where({ id: driverId }).first();
    if (driver?.telegram_id) await bot.telegram.sendMessage(driver.telegram_id, message);
  } catch (err) {
    logger.warn('Bot sendMessage failed:', err.message);
  }
}

module.exports = { setBot, sendToPassenger, sendToDriver };
