const driverSocket = require('./driver.socket');
const passengerSocket = require('./passenger.socket');
const adminSocket = require('./admin.socket');

module.exports = function socketHandler(io, socket) {
  const { role } = socket.user;

  if (role === 'driver') {
    socket.join(`driver:${socket.user.driverId}`);
    driverSocket(io, socket);
  } else if (role === 'passenger') {
    socket.join(`passenger:${socket.user.id}`);
    passengerSocket(io, socket);
  } else if (role === 'admin') {
    socket.join('admin');
    adminSocket(io, socket);
  }

  socket.on('disconnect', () => {
    if (role === 'driver' && socket.user.driverId) {
      require('../config/database')('drivers')
        .where({ id: socket.user.driverId })
        .update({ is_online: false, last_location_update: require('../config/database').fn.now() })
        .catch(() => {});
    }
  });
};
