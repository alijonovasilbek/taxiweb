const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/drivers', require('./driver.routes'));
router.use('/orders', require('./order.routes'));
router.use('/payments', require('./payment.routes'));
router.use('/ratings', require('./rating.routes'));
router.use('/maps', require('./maps.routes'));
router.use('/admin', require('./admin.routes'));

module.exports = router;
