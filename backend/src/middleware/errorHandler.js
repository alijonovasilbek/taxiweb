const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, err);

  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error', details: err.details.map(d => d.message) });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
  });
}

module.exports = errorHandler;
