const crypto = require('crypto');
const db = require('../config/database');
const { getIO } = require('../config/socket');

const SERVICE_ID = process.env.CLICK_SERVICE_ID;
const SECRET = process.env.CLICK_SECRET_KEY;

function verifySign({ click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string }) {
  const str = `${click_trans_id}${service_id}${SECRET}${merchant_trans_id}${amount}${action}${sign_time}`;
  return crypto.createHash('md5').update(str).digest('hex') === sign_string;
}

async function handlePrepare({ click_trans_id, merchant_trans_id, amount, sign_string, sign_time, action }) {
  if (!verifySign({ click_trans_id, service_id: SERVICE_ID, merchant_trans_id, amount, action, sign_time, sign_string })) {
    return { error: -1, error_note: 'SIGN CHECK FAILED!' };
  }
  const order = await db('orders').where({ id: merchant_trans_id }).first();
  if (!order) return { error: -5, error_note: 'Order not found' };
  if (order.payment_status === 'paid') return { error: -4, error_note: 'Already paid' };

  const [payment] = await db('payments').insert({
    order_id: order.id,
    amount,
    method: 'click',
    status: 'processing',
    external_id: click_trans_id,
  }).returning('*');

  return { click_trans_id, merchant_trans_id, merchant_prepare_id: payment.id, error: 0, error_note: 'Success' };
}

async function handleComplete({ click_trans_id, merchant_trans_id, merchant_prepare_id, error }) {
  const payment = await db('payments').where({ id: merchant_prepare_id }).first();
  if (!payment) return { error: -6, error_note: 'Transaction not found' };

  if (error < 0) {
    await db('payments').where({ id: payment.id }).update({ status: 'failed' });
    return { click_trans_id, merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: 'cancelled' };
  }

  await db('payments').where({ id: payment.id }).update({ status: 'completed', completed_at: db.fn.now() });
  await db('orders').where({ id: payment.order_id }).update({ payment_status: 'paid' });

  const order = await db('orders').where({ id: payment.order_id }).first();
  const io = getIO();
  io.to(`passenger:${order.passenger_id}`).to(`driver:${order.driver_id}`).emit('payment_confirmed', {
    orderId: payment.order_id,
    amount: payment.amount,
    method: 'click',
  });

  return { click_trans_id, merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: 'Success' };
}

module.exports = { handlePrepare, handleComplete };
