const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signJWT(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyJWT(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signJWT, verifyJWT };
