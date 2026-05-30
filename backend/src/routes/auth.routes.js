const router = require('express').Router();
const controller = require('../controllers/auth.controller');

router.post('/verify-telegram', controller.verifyTelegram);
router.post('/refresh', controller.refresh);

module.exports = router;
