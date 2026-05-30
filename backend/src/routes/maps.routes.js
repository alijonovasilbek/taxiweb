const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/maps.controller');

router.use(auth);
router.get('/geocode', controller.geocode);
router.get('/reverse-geocode', controller.reverseGeocode);
router.get('/route', controller.getRoute);
router.post('/suggest', controller.suggest);

module.exports = router;
