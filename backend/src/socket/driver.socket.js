const db = require('../config/database');
const redis = require('../config/redis');
const logger = require('../utils/logger');

const LOCATION_TTL = parseInt(process.env.DRIVER_LOCATION_TTL, 10) || 30;

module.exports = function driverSocket(io, socket) {
  const driverId = socket.user.driverId;
  if (!driverId) return;

  socket.on('driver:go_online', async ({ lat, lng }) => {
    try {
      await db('drivers').where({ id: driverId }).update({
        is_online: true,
        current_location: db.raw(`ST_MakePoint(?, ?)::geography`, [lng, lat]),
        last_location_update: db.fn.now(),
      });
      await redis.setEx(`driver:loc:${driverId}`, LOCATION_TTL, JSON.stringify({ lat, lng }));
      io.to('admin').emit('driver_online', { driverId, lat, lng });
    } catch (err) { logger.error('driver:go_online error:', err); }
  });

  socket.on('driver:go_offline', async () => {
    try {
      await db('drivers').where({ id: driverId }).update({ is_online: false });
      await redis.del(`driver:loc:${driverId}`);
      io.to('admin').emit('driver_offline', { driverId });
    } catch (err) { logger.error('driver:go_offline error:', err); }
  });

  socket.on('driver:location_update', async ({ lat, lng, heading, speed }) => {
    try {
      await redis.setEx(`driver:loc:${driverId}`, LOCATION_TTL, JSON.stringify({ lat, lng, heading, speed, ts: Date.now() }));

      await db('drivers').where({ id: driverId }).update({
        current_location: db.raw(`ST_MakePoint(?, ?)::geography`, [lng, lat]),
        last_location_update: db.fn.now(),
      });

      const activeOrder = await db('orders')
        .where({ driver_id: driverId })
        .whereIn('status', ['accepted', 'driver_arrived', 'in_progress'])
        .first();

      if (activeOrder) {
        io.to(`passenger:${activeOrder.passenger_id}`).emit('driver_location', {
          orderId: activeOrder.id,
          lat, lng, heading,
        });

        await db('driver_location_history').insert({
          driver_id: driverId,
          order_id: activeOrder.id,
          location: db.raw(`ST_MakePoint(?, ?)::geography`, [lng, lat]),
        }).catch(() => {});
      }

      io.to('admin').emit('driver_location_update', { driverId, lat, lng });
    } catch (err) { logger.error('location_update error:', err.message); }
  });
};
