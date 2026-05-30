const crypto = require('crypto');
const db = require('../config/database');
const { getIO } = require('../config/socket');

const MERCHANT_ID = process.env.PAYME_MERCHANT_ID;
const SECRET = process.env.PAYME_IS_TEST === 'true'
  ? process.env.PAYME_TEST_SECRET_KEY
  : process.env.PAYME_SECRET_KEY;

function verifyBasicAuth(authHeader) {
  if (!authHeader?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [, password] = decoded.split(':');
  return password === SECRET;
}

async function handleWebhook(method, params, authHeader) {
  if (!verifyBasicAuth(authHeader)) {
    return { error: { code: -32504, message: 'Insufficient privilege' }, id: null };
  }

  switch (method) {
    case 'CheckPerformTransaction': return checkPerform(params);
    case 'CreateTransaction': return createTransaction(params);
    case 'PerformTransaction': return performTransaction(params);
    case 'CancelTransaction': return cancelTransaction(params);
    case 'CheckTransaction': return checkTransaction(params);
    default: return { error: { code: -32601, message: 'Method not found' }, id: null };
  }
}

async function checkPerform({ amount, account }) {
  const order = await db('orders').where({ id: account.order_id }).first();
  if (!order) return { error: { code: -31050, message: 'Order not found' } };
  if (order.payment_status === 'paid') return { error: { code: -31050, message: 'Already paid' } };
  if (Math.round(order.estimated_price * 100) !== amount) return { error: { code: -31001, message: 'Wrong amount' } };
  return { result: { allow: true } };
}

async function createTransaction({ id, time, amount, account }) {
  let payment = await db('payments').where({ external_id: id }).first();
  if (!payment) {
    [payment] = await db('payments').insert({
      order_id: account.order_id,
      amount: amount / 100,
      method: 'payme',
      status: 'processing',
      external_id: id,
    }).returning('*');
  }
  return { result: { create_time: new Date(time).getTime(), transaction: payment.id.toString(), state: 1 } };
}

async function performTransaction({ id }) {
  const payment = await db('payments').where({ external_id: id }).first();
  if (!payment) return { error: { code: -31003, message: 'Transaction not found' } };

  await db('payments').where({ id: payment.id }).update({ status: 'completed', completed_at: db.fn.now() });
  await db('orders').where({ id: payment.order_id }).update({ payment_status: 'paid' });

  const order = await db('orders').where({ id: payment.order_id }).first();
  const io = getIO();
  io.to(`passenger:${order.passenger_id}`).to(`driver:${order.driver_id}`).emit('payment_confirmed', {
    orderId: payment.order_id,
    amount: payment.amount,
    method: 'payme',
  });

  return { result: { transaction: payment.id.toString(), perform_time: Date.now(), state: 2 } };
}

async function cancelTransaction({ id, reason }) {
  const payment = await db('payments').where({ external_id: id }).first();
  if (!payment) return { error: { code: -31003, message: 'Transaction not found' } };
  await db('payments').where({ id: payment.id }).update({ status: 'failed' });
  return { result: { transaction: payment.id.toString(), cancel_time: Date.now(), state: -1 } };
}

async function checkTransaction({ id }) {
  const payment = await db('payments').where({ external_id: id }).first();
  if (!payment) return { error: { code: -31003, message: 'Transaction not found' } };
  const stateMap = { processing: 1, completed: 2, failed: -1 };
  return { result: { create_time: payment.created_at.getTime(), transaction: payment.id.toString(), state: stateMap[payment.status] || 1 } };
}

module.exports = { handleWebhook };
