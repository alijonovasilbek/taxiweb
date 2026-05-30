const axios = require('axios');

const GEOCODER_KEY = process.env.YANDEX_GEOCODER_API_KEY;
const ROUTER_KEY = process.env.YANDEX_ROUTER_API_KEY;
const MAPS_KEY = process.env.YANDEX_MAPS_API_KEY;

async function geocode(address) {
  const { data } = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
    params: { geocode: address, format: 'json', apikey: GEOCODER_KEY, lang: 'uz_UZ', results: 5 },
  });
  const members = data.response.GeoObjectCollection.featureMember;
  return members.map((m) => {
    const obj = m.GeoObject;
    const [lng, lat] = obj.Point.pos.split(' ').map(Number);
    return { address: obj.metaDataProperty.GeocoderMetaData.text, lat, lng };
  });
}

async function reverseGeocode(lat, lng) {
  const { data } = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
    params: { geocode: `${lng},${lat}`, format: 'json', apikey: GEOCODER_KEY, kind: 'house', results: 1 },
  });
  const members = data.response.GeoObjectCollection.featureMember;
  if (!members.length) return null;
  return members[0].GeoObject.metaDataProperty.GeocoderMetaData.text;
}

async function getRoute(fromLat, fromLng, toLat, toLng) {
  const { data } = await axios.get('https://router.yandex.net/v2/route', {
    params: {
      waypoints: `${fromLat},${fromLng}|${toLat},${toLng}`,
      mode: 'driving',
      apikey: ROUTER_KEY,
    },
  });
  const route = data.route?.legs?.[0];
  if (!route) throw new Error('Route not found');
  return {
    distanceKm: route.steps.reduce((sum, s) => sum + s.length / 1000, 0),
    durationMin: Math.ceil(route.steps.reduce((sum, s) => sum + s.duration, 0) / 60),
    polyline: data.route?.geometry || null,
  };
}

async function suggest(text) {
  const { data } = await axios.get('https://suggest-maps.yandex.ru/v1/suggest', {
    params: { text, lang: 'uz_UZ', results: 5, apikey: MAPS_KEY },
  });
  return (data.results || []).map((r) => ({ title: r.title?.text, subtitle: r.subtitle?.text, tags: r.tags }));
}

module.exports = { geocode, reverseGeocode, getRoute, suggest };
