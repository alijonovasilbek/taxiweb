const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/rating.controller');

router.post('/', auth, controller.create);
router.get('/driver/:id', controller.getDriverRatings);
router.get('/user/:id', controller.getUserRatings);

module.exports = router;
