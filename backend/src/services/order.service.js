const db = require('../config/database');
const { findNearestDrivers } = require('./matching.service');
const { getIO } = require('../config/socket');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');

const ORDER_TIMEOUT_SEC = 30;

async function createOrder({ passengerId, pickup, dropoff, distanceKm, durationMin, price, paymentMethod }) {
  const [order] = await db('orders').insert({
    passenger_id: passengerId,
    pickup_address: pickup.address,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    pickup_location: db.raw(`ST_MakePoint(?, ?)::geography`, [pickup.lng, pickup.lat]),
    dropoff_address: dropoff.address,
    dropoff_lat: dropoff.lat,
    dropoff_lng: dropoff.lng,
    dropoff_location: db.raw(`ST_MakePoint(?, ?)::geography`, [dropoff.lng, dropoff.lat]),
    distance_km: distanceKm,
    duration_min: durationMin,
    estimated_price: price,
    payment_method: paymentMethod,
    status: 'searching',
  }).returning('*');

  dispatchToDrivers(order);
  return order;
}

async function dispatchToDrivers(order) {
  const io = getIO();
  const drivers = await findNearestDrivers(order.pickup_lat, order.pickup_lng);

  if (!drivers.length) {
    await db('orders').where({ id: order.id }).update({ status: 'no_drivers' });
    io.to(`passenger:${order.passenger_id}`).emit('no_drivers_found', { orderId: order.id });
    return;
  }

  const passenger = await db('users').where({ id: order.passenger_id }).first();

  for (const driver of drivers) {
    io.to(`driver:${driver.id}`).emit('new_order', {
      orderId: order.id,
      pickup: { address: order.pickup_address, lat: order.pickup_lat, lng: order.pickup_lng },
      dropoff: { address: order.dropoff_address, lat: order.dropoff_lat, lng: order.dropoff_lng },
      distanceKm: order.distance_km,
      durationMin: order.duration_min,
      price: order.estimated_price,
      passengerRating: passenger.rating,
      timeout: ORDER_TIMEOUT_SEC,
    });

    setTimeout(async () => {
      const current = await db('orders').where({ id: order.id }).first();
      if (current.status === 'searching') {
        io.to(`driver:${driver.id}`).emit('new_order_timeout', { orderId: order.id });
      }
    }, ORDER_TIMEOUT_SEC * 1000);
  }

  setTimeout(async () => {
    const current = await db('orders').where({ id: order.id }).first();
    if (current.status === 'searching') {
      await db('orders').where({ id: order.id }).update({ status: 'no_drivers' });
      io.to(`passenger:${order.passenger_id}`).emit('no_drivers_found', { orderId: order.id });
    }
  }, (ORDER_TIMEOUT_SEC + 5) * 1000);
}

async function acceptOrder(orderId, driverId) {
  const order = await db('orders').where({ id: orderId }).first();
  if (!order || order.status !== 'searching') throw Object.assign(new Error('Order not available'), { status: 409 });

  await db('orders').where({ id: orderId }).update({
    driver_id: driverId,
    status: 'accepted',
    accepted_at: db.fn.now(),
  });
  await db('drivers').where({ id: driverId }).update({ is_on_ride: true });

  const driver = await db('drivers').where({ id: driverId }).first();
  const io = getIO();
  io.to(`passenger:${order.passenger_id}`).emit('order_accepted', {
    orderId,
    driver: {
      name: `${driver.first_name} ${driver.last_name}`,
      phone: driver.phone,
      carModel: driver.car_model,
      carNumber: driver.car_number,
      carColor: driver.car_color,
      rating: driver.rating,
    },
  });

  await notificationService.sendToPassenger(order.passenger_id, {
    type: 'order_accepted',
    message: `Haydovchi ${driver.first_name} buyurtmangizni qabul qildi!`,
  });
}

async function completeOrder(orderId, driverId) {
  const order = await db('orders').where({ id: orderId }).first();
  if (!order || order.driver_id !== driverId) throw Object.assign(new Error('Forbidden'), { status: 403 });

  await db('orders').where({ id: orderId }).update({
    status: 'completed',
    completed_at: db.fn.now(),
    final_price: order.estimated_price,
    payment_status: order.payment_method === 'cash' ? 'paid' : 'pending',
  });
  await db('drivers').where({ id: driverId }).update({
    is_on_ride: false,
    total_rides: db.raw('total_rides + 1'),
    total_earnings: db.raw(`total_earnings + ${order.estimated_price}`),
  });
  await db('users').where({ id: order.passenger_id }).update({
    total_rides: db.raw('total_rides + 1'),
  });

  const io = getIO();
  io.to(`passenger:${order.passenger_id}`).to(`driver:${driverId}`).emit('ride_completed', {
    orderId,
    finalPrice: order.estimated_price,
  });
}

module.exports = { createOrder, acceptOrder, completeOrder };
