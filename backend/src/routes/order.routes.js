const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/order.controller');

router.use(auth);
router.post('/', controller.create);
router.get('/active', controller.getActive);
router.get('/:id', controller.getById);
router.put('/:id/accept', controller.accept);
router.put('/:id/reject', controller.reject);
router.put('/:id/arrived', controller.arrived);
router.put('/:id/start', controller.startRide);
router.put('/:id/complete', controller.complete);
router.put('/:id/cancel', controller.cancel);

module.exports = router;
