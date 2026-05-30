const db = require('../config/database');
const logger = require('../utils/logger');

module.exports = function passengerSocket(io, socket) {
  socket.on('passenger:track_order', async ({ orderId }) => {
    try {
      const order = await db('orders').where({ id: orderId, passenger_id: socket.user.id }).first();
      if (order) socket.join(`order:${orderId}`);
    } catch (err) { logger.error('track_order error:', err); }
  });

  socket.on('passenger:cancel_order', async ({ orderId, reason }) => {
    try {
      const order = await db('orders').where({ id: orderId, passenger_id: socket.user.id }).first();
      if (!order || !['searching', 'accepted'].includes(order.status)) return;

      await db('orders').where({ id: orderId }).update({
        status: 'cancelled',
        cancelled_at: db.fn.now(),
        cancel_reason: reason || 'Yo\'lovchi bekor qildi',
      });
      if (order.driver_id) {
        await db('drivers').where({ id: order.driver_id }).update({ is_on_ride: false });
        io.to(`driver:${order.driver_id}`).emit('order_cancelled', { orderId, reason, cancelledBy: 'passenger' });
      }
    } catch (err) { logger.error('cancel_order error:', err); }
  });
};
