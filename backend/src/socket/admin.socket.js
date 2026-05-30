const db = require('../config/database');

module.exports = function adminSocket(io, socket) {
  socket.on('admin:join', async () => {
    socket.join('admin');
    const drivers = await db.raw(`
      SELECT id, first_name, last_name, is_online, is_on_ride,
        ST_X(current_location::geometry) as lng,
        ST_Y(current_location::geometry) as lat
      FROM drivers WHERE status = 'approved' AND current_location IS NOT NULL
    `).catch(() => ({ rows: [] }));
    socket.emit('admin:driver_locations', drivers.rows);
  });
};
