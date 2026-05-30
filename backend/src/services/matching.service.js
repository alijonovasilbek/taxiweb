const db = require('../config/database');

const SEARCH_RADIUS_KM = 5;
const MAX_DRIVERS = 10;

async function findNearestDrivers(pickupLat, pickupLng, radiusKm = SEARCH_RADIUS_KM) {
  const rows = await db.raw(`
    SELECT
      d.id, d.first_name, d.last_name, d.phone,
      d.car_model, d.car_color, d.car_number, d.rating,
      u.telegram_id,
      ST_Distance(
        d.current_location::geography,
        ST_MakePoint(?, ?)::geography
      ) / 1000 AS distance_km
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    WHERE
      d.is_online = true
      AND d.is_on_ride = false
      AND d.status = 'approved'
      AND ST_DWithin(
        d.current_location::geography,
        ST_MakePoint(?, ?)::geography,
        ?
      )
    ORDER BY distance_km ASC
    LIMIT ?
  `, [pickupLng, pickupLat, pickupLng, pickupLat, radiusKm * 1000, MAX_DRIVERS]);

  return rows.rows;
}

module.exports = { findNearestDrivers };
