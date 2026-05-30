const { createClient } = require('redis');
const logger = require('../utils/logger');

const client = createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => logger.error('Redis error:', err));
client.on('connect', () => logger.info('Redis connected'));

client.connect().catch((err) => {
  logger.error('Redis connect failed:', err.message);
});

module.exports = client;
