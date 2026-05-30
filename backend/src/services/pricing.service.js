const db = require('../config/database');

async function getActiveTariff() {
  const tariff = await db('tariffs').where({ is_active: true }).first();
  if (!tariff) throw new Error('No active tariff');
  return tariff;
}

function calculatePrice(distanceKm, durationMin, tariff) {
  const hour = new Date().getHours();
  const isNight = hour >= 22 || hour < 6;

  let price =
    parseFloat(tariff.base_fare) +
    distanceKm * parseFloat(tariff.per_km_price) +
    durationMin * parseFloat(tariff.per_min_price);

  if (isNight) price *= parseFloat(tariff.night_multiplier);

  return Math.max(Math.ceil(price / 100) * 100, parseFloat(tariff.min_fare));
}

async function estimatePrice(distanceKm, durationMin) {
  const tariff = await getActiveTariff();
  return { price: calculatePrice(distanceKm, durationMin, tariff), tariff };
}

module.exports = { estimatePrice, calculatePrice, getActiveTariff };
