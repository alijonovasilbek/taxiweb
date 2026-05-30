const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');

const env = process.env.NODE_ENV || 'development';
const db = knex(knexConfig[env]);

db.raw('SELECT 1')
  .then(() => logger.info('PostgreSQL connected'))
  .catch((err) => {
    logger.error('PostgreSQL connection failed:', err.message);
    process.exit(1);
  });

module.exports = db;
