const db = require('../config/database');
const path = require('path');

async function register(req, res, next) {
  try {
    const { firstName, lastName, phone, carModel, carColor, carNumber, carYear } = req.body;
    const telegramId = req.user.telegramId;

    const existing = await db('drivers').where({ telegram_id: telegramId }).first();
    if (existing) return res.status(409).json({ error: 'Already registered' });

    let userId = await db('users').where({ telegram_id: telegramId }).first().then(u => u?.id);
    if (!userId) {
      [{ id: userId }] = await db('users').insert({ telegram_id: telegramId, first_name: firstName, last_name: lastName }).returning('id');
    }

    const [driver] = await db('drivers').insert({
      user_id: userId,
      telegram_id: telegramId,
      first_name: firstName,
      last_name: lastName,
      phone,
      car_model: carModel,
      car_color: carColor,
      car_number: carNumber.toUpperCase(),
      car_year: carYear,
      status: 'pending',
    }).returning('*');

    res.status(201).json(driver);
  } catch (err) { next(err); }
}

async function getMe(req, res, next) {
  try {
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    res.json(driver);
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const { phone, carModel, carColor, carNumber } = req.body;
    const [driver] = await db('drivers').where({ telegram_id: req.user.telegramId })
      .update({ phone, car_model: carModel, car_color: carColor, car_number: carNumber?.toUpperCase(), updated_at: db.fn.now() })
      .returning('*');
    res.json(driver);
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { isOnline } = req.body;
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver || driver.status !== 'approved') return res.status(403).json({ error: 'Not approved' });
    await db('drivers').where({ id: driver.id }).update({ is_online: isOnline, updated_at: db.fn.now() });
    res.json({ isOnline });
  } catch (err) { next(err); }
}

async function getEarnings(req, res, next) {
  try {
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    const today = await db('orders')
      .where({ driver_id: driver.id, status: 'completed' })
      .whereRaw("completed_at::date = CURRENT_DATE")
      .sum('final_price as total')
      .first();
    res.json({ totalEarnings: driver.total_earnings, totalRides: driver.total_rides, todayEarnings: today?.total || 0 });
  } catch (err) { next(err); }
}

async function getRides(req, res, next) {
  try {
    const driver = await db('drivers').where({ telegram_id: req.user.telegramId }).first();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    const rides = await db('orders').where({ driver_id: driver.id }).orderBy('created_at', 'desc').limit(50);
    res.json(rides);
  } catch (err) { next(err); }
}

async function uploadDocuments(req, res, next) {
  try {
    const updates = {};
    if (req.files?.license?.[0]) updates.license_photo_url = `/uploads/${req.files.license[0].filename}`;
    if (req.files?.carDoc?.[0]) updates.car_doc_photo_url = `/uploads/${req.files.carDoc[0].filename}`;
    const [driver] = await db('drivers').where({ telegram_id: req.user.telegramId }).update(updates).returning('*');
    res.json(driver);
  } catch (err) { next(err); }
}

async function getNearby(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const { findNearestDrivers } = require('../services/matching.service');
    const drivers = await findNearestDrivers(parseFloat(lat), parseFloat(lng), 3);
    res.json(drivers);
  } catch (err) { next(err); }
}

module.exports = { register, getMe, updateMe, updateStatus, getEarnings, getRides, uploadDocuments, getNearby };
