const db = require('../config/database');

async function getMe(req, res, next) {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
}

async function updateMe(req, res, next) {
  try {
    const { phone, language } = req.body;
    const [user] = await db('users').where({ id: req.user.id })
      .update({ phone, language, updated_at: db.fn.now() })
      .returning('*');
    res.json(user);
  } catch (err) { next(err); }
}

async function getRides(req, res, next) {
  try {
    const rides = await db('orders')
      .where({ passenger_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json(rides);
  } catch (err) { next(err); }
}

async function getRatings(req, res, next) {
  try {
    const ratings = await db('ratings').where({ rated_user_id: req.user.id }).orderBy('created_at', 'desc');
    res.json(ratings);
  } catch (err) { next(err); }
}

module.exports = { getMe, updateMe, getRides, getRatings };
