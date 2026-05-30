const yandex = require('../services/yandex.service');

async function geocode(req, res, next) {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: 'address required' });
    const results = await yandex.geocode(address);
    res.json(results);
  } catch (err) { next(err); }
}

async function reverseGeocode(req, res, next) {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const address = await yandex.reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json({ address });
  } catch (err) { next(err); }
}

async function getRoute(req, res, next) {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if (!fromLat || !toLat) return res.status(400).json({ error: 'from and to coordinates required' });
    const route = await yandex.getRoute(parseFloat(fromLat), parseFloat(fromLng), parseFloat(toLat), parseFloat(toLng));
    res.json(route);
  } catch (err) { next(err); }
}

async function suggest(req, res, next) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const results = await yandex.suggest(text);
    res.json(results);
  } catch (err) { next(err); }
}

module.exports = { geocode, reverseGeocode, getRoute, suggest };
