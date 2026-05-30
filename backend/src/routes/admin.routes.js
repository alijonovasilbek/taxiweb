const router = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const controller = require('../controllers/admin.controller');

router.use(adminAuth);
router.get('/dashboard', controller.dashboard);
router.get('/drivers', controller.listDrivers);
router.get('/drivers/:id', controller.getDriver);
router.put('/drivers/:id/approve', controller.approveDriver);
router.put('/drivers/:id/block', controller.blockDriver);
router.get('/orders', controller.listOrders);
router.get('/payments', controller.listPayments);
router.get('/tariffs', controller.getTariffs);
router.put('/tariffs', controller.updateTariff);
router.get('/active-drivers', controller.getActiveDrivers);
router.get('/reports/daily', controller.dailyReport);
router.get('/reports/weekly', controller.weeklyReport);

module.exports = router;
