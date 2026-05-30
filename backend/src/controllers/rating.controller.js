const db = require('../config/database');

async function create(req, res, next) {
  try {
    const { orderId, rating, comment, targetRole } = req.body;
    if (!orderId || !rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Invalid rating' });

    const order = await db('orders').where({ id: orderId }).first();
    if (!order || order.status !== 'completed') return res.status(400).json({ error: 'Order not completed' });

    const existing = await db('ratings').where({ order_id: orderId, rater_id: req.user.id }).first();
    if (existing) return res.status(409).json({ error: 'Already rated' });

    const insertData = { order_id: orderId, rater_id: req.user.id, rating, comment };
    if (targetRole === 'driver') {
      insertData.rated_driver_id = order.driver_id;
      await db('ratings').insert(insertData);
      const avg = await db('ratings').where({ rated_driver_id: order.driver_id }).avg('rating as avg').first();
      await db('drivers').where({ id: order.driver_id }).update({ rating: parseFloat(avg.avg).toFixed(2) });
      await db('orders').where({ id: orderId }).update({ passenger_rated: true });
    } else {
      insertData.rated_user_id = order.passenger_id;
      await db('ratings').insert(insertData);
      const avg = await db('ratings').where({ rated_user_id: order.passenger_id }).avg('rating as avg').first();
      await db('users').where({ id: order.passenger_id }).update({ rating: parseFloat(avg.avg).toFixed(2) });
      await db('orders').where({ id: orderId }).update({ driver_rated: true });
    }

    res.status(201).json({ success: true });
  } catch (err) { next(err); }
}

async function getDriverRatings(req, res, next) {
  try {
    const ratings = await db('ratings').where({ rated_driver_id: req.params.id }).orderBy('created_at', 'desc').limit(20);
    const avg = await db('ratings').where({ rated_driver_id: req.params.id }).avg('rating as avg').first();
    res.json({ ratings, average: parseFloat(avg.avg || 0).toFixed(2) });
  } catch (err) { next(err); }
}

async function getUserRatings(req, res, next) {
  try {
    const ratings = await db('ratings').where({ rated_user_id: req.params.id }).orderBy('created_at', 'desc').limit(20);
    const avg = await db('ratings').where({ rated_user_id: req.params.id }).avg('rating as avg').first();
    res.json({ ratings, average: parseFloat(avg.avg || 0).toFixed(2) });
  } catch (err) { next(err); }
}

module.exports = { create, getDriverRatings, getUserRatings };
