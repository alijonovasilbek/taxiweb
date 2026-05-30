const db = require('../config/database');
const orderService = require('../services/order.service');
const { getRoute } = require('../services/yandex.service');
const { estimatePrice } = require('../services/pricing.service');
const { getIO } = require('../config/socket');

async function create(req, res, next) {
  try {
    const { pickup, dropoff, paymentMethod } = req.body;
    if (!pickup?.lat || !dropoff?.lat) return res.status(400).json({ error: 'pickup and dropoff with lat/lng required' });

    const route = await getRoute(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const { price } = await estimatePrice(route.distanceKm, route.durationMin);

    const order = await orderService.createOrder({
      passengerId: req.user.id,
      pickup,
      dropoff,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      price,
      paymentMethod: paymentMethod || 'cash',
    });

    res.status(201).json({ ...order, estimatedPrice: price, route });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) { next(err); }
}

async function getActive(req, res, next) {
  try {
    const userId = req.user.id;
    const driverId = req.user.driverId;
    const query = db('orders').whereNotIn('status', ['completed', 'cancelled', 'no_drivers']);
    if (driverId) query.where({ driver_id: driverId });
    else query.where({ passenger_id: userId });
    const order = await query.first();
    res.json(order || null);
  } catch (err) { next(err); }
}

async function accept(req, res, next) {
  try {
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    await orderService.acceptOrder(parseInt(req.params.id), driver.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function reject(req, res, next) {
  try {
    const { reason } = req.body;
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Not found' });
    const io = getIO();
    io.to(`passenger:${order.passenger_id}`).emit('order_rejected', { orderId: order.id, reason });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function arrived(req, res, next) {
  try {
    await db('orders').where({ id: req.params.id }).update({ status: 'driver_arrived', arrived_at: db.fn.now() });
    const order = await db('orders').where({ id: req.params.id }).first();
    const io = getIO();
    io.to(`passenger:${order.passenger_id}`).emit('driver_arrived', { orderId: order.id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function startRide(req, res, next) {
  try {
    await db('orders').where({ id: req.params.id }).update({ status: 'in_progress', started_at: db.fn.now() });
    const order = await db('orders').where({ id: req.params.id }).first();
    const io = getIO();
    io.to(`passenger:${order.passenger_id}`).emit('ride_started', { orderId: order.id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function complete(req, res, next) {
  try {
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    await orderService.completeOrder(parseInt(req.params.id), driver.id);
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function cancel(req, res, next) {
  try {
    const { reason } = req.body;
    const order = await db('orders').where({ id: req.params.id }).first();
    if (!order) return res.status(404).json({ error: 'Not found' });

    await db('orders').where({ id: req.params.id }).update({
      status: 'cancelled',
      cancelled_at: db.fn.now(),
      cancel_reason: reason,
    });
    if (order.driver_id) {
      await db('drivers').where({ id: order.driver_id }).update({ is_on_ride: false });
    }

    const io = getIO();
    const cancelledBy = req.user.role === 'driver' ? 'driver' : 'passenger';
    const room = cancelledBy === 'driver'
      ? `passenger:${order.passenger_id}`
      : `driver:${order.driver_id}`;
    if (room) io.to(room).emit('order_cancelled', { orderId: order.id, reason, cancelledBy });

    res.json({ success: true });
  } catch (err) { next(err); }
}

module.exports = { create, getById, getActive, accept, reject, arrived, startRide, complete, cancel };
