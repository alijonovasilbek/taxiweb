const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/payment.controller');

router.post('/payme/create', auth, controller.paymeCreate);
router.post('/payme/verify', controller.paymeWebhook);
router.post('/click/create', auth, controller.clickCreate);
router.post('/click/verify', controller.clickWebhook);
router.post('/telegram/create', auth, controller.telegramCreate);
router.post('/telegram/verify', controller.telegramWebhook);
router.get('/:orderId', auth, controller.getStatus);

module.exports = router;
