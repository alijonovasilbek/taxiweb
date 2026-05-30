const db = require('../config/database');
const payme = require('../services/payme.service');
const click = require('../services/click.service');

async function paymeCreate(req, res, next) {
  try {
    const { orderId } = req.body;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const MERCHANT_ID = process.env.PAYME_MERCHANT_ID;
    const amount = Math.round(order.estimated_price * 100);
    const params = Buffer.from(JSON.stringify({ m: MERCHANT_ID, ac: { order_id: orderId }, a: amount })).toString('base64');
    const isTest = process.env.PAYME_IS_TEST === 'true';
    const url = `https://${isTest ? 'test.' : ''}checkout.paycom.uz/${params}`;

    res.json({ url, amount });
  } catch (err) { next(err); }
}

async function paymeWebhook(req, res, next) {
  try {
    const { method, params, id } = req.body;
    const result = await payme.handleWebhook(method, params, req.headers.authorization);
    res.json({ jsonrpc: '2.0', id, ...result });
  } catch (err) { next(err); }
}

async function clickCreate(req, res, next) {
  try {
    const { orderId } = req.body;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const url = `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${order.estimated_price}&transaction_param=${orderId}`;
    res.json({ url });
  } catch (err) { next(err); }
}

async function clickWebhook(req, res, next) {
  try {
    const { action } = req.body;
    if (action === 0) {
      const result = await click.handlePrepare(req.body);
      return res.json(result);
    }
    const result = await click.handleComplete(req.body);
    res.json(result);
  } catch (err) { next(err); }
}

async function telegramCreate(req, res, next) {
  try {
    const { orderId } = req.body;
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ orderId, amount: order.estimated_price, currency: 'UZS' });
  } catch (err) { next(err); }
}

async function telegramWebhook(req, res, next) {
  try {
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function getStatus(req, res, next) {
  try {
    const payment = await db('payments').where({ order_id: req.params.orderId }).orderBy('created_at', 'desc').first();
    res.json(payment || { status: 'not_found' });
  } catch (err) { next(err); }
}

module.exports = { paymeCreate, paymeWebhook, clickCreate, clickWebhook, telegramCreate, telegramWebhook, getStatus };
