const { Telegraf, Markup } = require('telegraf');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

let bot;

function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN not set, bot disabled');
    return;
  }

  bot = new Telegraf(token);
  notificationService.setBot(bot);

  bot.command('start', (ctx) => {
    const passengerUrl = process.env.PASSENGER_APP_URL;
    const driverUrl = process.env.DRIVER_APP_URL;

    ctx.reply(
      'TaxiGo ga xush kelibsiz!\n\nSiz qanday foydalanmoqchisiz?',
      Markup.inlineKeyboard([
        [Markup.button.webApp('🚕 Taksi buyurtma qilish', passengerUrl)],
        [Markup.button.webApp('🚗 Haydovchi paneli', driverUrl)],
      ])
    );
  });

  bot.command('help', (ctx) => {
    ctx.reply(
      'TaxiGo yordami:\n\n' +
      '/start — Botni boshlash\n' +
      '/profile — Profilingiz\n' +
      '/rides — Oxirgi buyurtmalar\n' +
      '/support — Yordam\n\n' +
      'Savollar uchun: @taxigo_support'
    );
  });

  bot.command('support', (ctx) => {
    ctx.reply('Qo\'llab-quvvatlash: @taxigo_support\nTelefon: +998 XX XXX XX XX');
  });

  bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

  bot.on('successful_payment', async (ctx) => {
    try {
      const { invoice_payload, total_amount, currency } = ctx.message.successful_payment;
      const orderId = parseInt(invoice_payload);
      const db = require('../config/database');
      await db('orders').where({ id: orderId }).update({ payment_status: 'paid' });
      await db('payments').insert({
        order_id: orderId,
        amount: total_amount / 100,
        currency,
        method: 'telegram',
        status: 'completed',
        external_id: ctx.message.successful_payment.telegram_payment_charge_id,
        completed_at: db.fn.now(),
      });
      ctx.reply('To\'lov muvaffaqiyatli amalga oshirildi!');
    } catch (err) {
      logger.error('successful_payment error:', err);
    }
  });

  bot.launch().then(() => logger.info('Telegram bot started')).catch((err) => logger.error('Bot launch failed:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

function getBot() { return bot; }

module.exports = { initBot, getBot };
