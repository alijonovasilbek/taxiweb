const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/user.controller');

router.use(auth);
router.get('/me', controller.getMe);
router.put('/me', controller.updateMe);
router.get('/me/rides', controller.getRides);
router.get('/me/ratings', controller.getRatings);

module.exports = router;
