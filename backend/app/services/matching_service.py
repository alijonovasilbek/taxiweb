import asyncpg

SEARCH_RADIUS_KM = 5
MAX_DRIVERS = 10


async def find_nearest_drivers(conn: asyncpg.Connection, pickup_lat: float, pickup_lng: float, radius_km: float = SEARCH_RADIUS_KM) -> list[dict]:
    rows = await conn.fetch(
        """SELECT d.id, d.first_name, d.last_name, d.phone,
                  d.car_model, d.car_color, d.car_number, d.rating,
                  d.telegram_id,
                  ST_Distance(
                      d.current_location::geography,
                      ST_MakePoint($2,$1)::geography
                  ) / 1000 AS distance_km
           FROM drivers d
           WHERE d.is_online = true
             AND d.is_on_ride = false
             AND d.status = 'approved'
             AND ST_DWithin(
                     d.current_location::geography,
                     ST_MakePoint($2,$1)::geography,
                     $3
                 )
           ORDER BY distance_km ASC
           LIMIT $4""",
        pickup_lat, pickup_lng, radius_km * 1000, MAX_DRIVERS,
    )
    return [dict(r) for r in rows]
