const db = require('../config/database');
const notificationService = require('../services/notification.service');

async function dashboard(req, res, next) {
  try {
    const [todayOrders, activeDrivers, todayRevenue, avgRating] = await Promise.all([
      db('orders').whereRaw("created_at::date = CURRENT_DATE").count('id as count').first(),
      db('drivers').where({ is_online: true, status: 'approved' }).count('id as count').first(),
      db('orders').whereRaw("completed_at::date = CURRENT_DATE").where({ status: 'completed' }).sum('final_price as total').first(),
      db('drivers').avg('rating as avg').first(),
    ]);
    res.json({
      todayOrders: parseInt(todayOrders.count),
      activeDrivers: parseInt(activeDrivers.count),
      todayRevenue: parseFloat(todayRevenue.total || 0),
      avgDriverRating: parseFloat(avgRating.avg || 0).toFixed(2),
    });
  } catch (err) { next(err); }
}

async function listDrivers(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = db('drivers').orderBy('created_at', 'desc');
    if (status) query.where({ status });
    const drivers = await query.limit(limit).offset((page - 1) * limit);
    const total = await db('drivers').modify(q => status && q.where({ status })).count('id as count').first();
    res.json({ drivers, total: parseInt(total.count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function getDriver(req, res, next) {
  try {
    const driver = await db('drivers').where({ id: req.params.id }).first();
    if (!driver) return res.status(404).json({ error: 'Not found' });
    const rides = await db('orders').where({ driver_id: driver.id }).count('id as count').first();
    res.json({ ...driver, totalRidesCount: parseInt(rides.count) });
  } catch (err) { next(err); }
}

async function approveDriver(req, res, next) {
  try {
    await db('drivers').where({ id: req.params.id }).update({ status: 'approved' });
    await notificationService.sendToDriver(parseInt(req.params.id), {
      type: 'approved',
      message: "Tabriklaymiz! Haydovchi sifatida tasdiqlandi. Endi onlayn bo'lib buyurtma qabul qila olasiz.",
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function blockDriver(req, res, next) {
  try {
    const { reason } = req.body;
    await db('drivers').where({ id: req.params.id }).update({ status: 'blocked', is_online: false });
    await notificationService.sendToDriver(parseInt(req.params.id), {
      type: 'blocked',
      message: `Hisobingiz bloklandi. Sabab: ${reason || 'qoidabuzarlik'}`,
    });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function listOrders(req, res, next) {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const query = db('orders').orderBy('created_at', 'desc');
    if (status) query.where({ status });
    if (date) query.whereRaw("created_at::date = ?", [date]);
    const orders = await query.limit(limit).offset((page - 1) * limit);
    const total = await db('orders').count('id as count').first();
    res.json({ orders, total: parseInt(total.count), page: parseInt(page) });
  } catch (err) { next(err); }
}

async function listPayments(req, res, next) {
  try {
    const payments = await db('payments').orderBy('created_at', 'desc').limit(100);
    res.json(payments);
  } catch (err) { next(err); }
}

async function getTariffs(req, res, next) {
  try {
    const tariffs = await db('tariffs').orderBy('created_at', 'desc');
    res.json(tariffs);
  } catch (err) { next(err); }
}

async function updateTariff(req, res, next) {
  try {
    const { baseFare, perKmPrice, perMinPrice, minFare, nightMultiplier } = req.body;
    await db('tariffs').where({ is_active: true }).update({ is_active: false });
    const [tariff] = await db('tariffs').insert({
      name: 'Standard',
      base_fare: baseFare,
      per_km_price: perKmPrice,
      per_min_price: perMinPrice || 0,
      min_fare: minFare,
      night_multiplier: nightMultiplier || 1.5,
      is_active: true,
    }).returning('*');
    res.json(tariff);
  } catch (err) { next(err); }
}

async function getActiveDrivers(req, res, next) {
  try {
    const drivers = await db.raw(`
      SELECT id, first_name, last_name, car_model, car_number, rating, is_on_ride,
        ST_X(current_location::geometry) as lng,
        ST_Y(current_location::geometry) as lat
      FROM drivers
      WHERE is_online = true AND status = 'approved' AND current_location IS NOT NULL
    `);
    res.json(drivers.rows);
  } catch (err) { next(err); }
}

async function dailyReport(req, res, next) {
  try {
    const rows = await db.raw(`
      SELECT
        created_at::date as date,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        SUM(final_price) FILTER (WHERE status = 'completed') as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY date ORDER BY date DESC
    `);
    res.json(rows.rows);
  } catch (err) { next(err); }
}

async function weeklyReport(req, res, next) {
  try {
    const rows = await db.raw(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        SUM(final_price) FILTER (WHERE status = 'completed') as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '12 weeks'
      GROUP BY week ORDER BY week DESC
    `);
    res.json(rows.rows);
  } catch (err) { next(err); }
}

module.exports = {
  dashboard, listDrivers, getDriver, approveDriver, blockDriver,
  listOrders, listPayments, getTariffs, updateTariff, getActiveDrivers,
  dailyReport, weeklyReport,
};
