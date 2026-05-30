const { authenticatePassenger, authenticateDriver } = require('../services/auth.service');
const { signJWT, verifyJWT } = require('../utils/jwt');

async function verifyTelegram(req, res, next) {
  try {
    const { initData, role } = req.body;
    if (!initData) return res.status(400).json({ error: 'initData required' });

    if (role === 'driver') {
      const result = await authenticateDriver(initData);
      return res.json(result);
    }
    const result = await authenticatePassenger(initData);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { token } = req.body;
    const payload = verifyJWT(token);
    const newToken = signJWT({ id: payload.id, telegramId: payload.telegramId, role: payload.role, driverId: payload.driverId });
    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { verifyTelegram, refresh };
