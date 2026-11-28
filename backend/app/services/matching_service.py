import asyncpg

SEARCH_RADIUS_KM = 5
MAX_DRIVERS = 10


async def find_nearest_drivers(conn: asyncpg.Connection, pickup_lat: float, pickup_lng: float, radius_km: float = SEARCH_RADIUS_KM,
                              exclude_user_id: int | None = None) -> list[dict]:
    # exclude_user_id: buyurtma egasi — o'z buyurtmasini o'ziga taklif qilmaymiz (qabul qilish baribir rad etiladi)
    rows = await conn.fetch(
        """SELECT d.id, d.first_name, d.last_name, d.phone,
                  d.car_model, d.car_color, d.car_number, d.rating,
                  d.telegram_id,
                  ST_Y(d.current_location::geometry) AS lat, ST_X(d.current_location::geometry) AS lng,
                  ST_Distance(
                      d.current_location::geography,
                      ST_MakePoint($2,$1)::geography
                  ) / 1000 AS distance_km
           FROM drivers d
           WHERE d.is_online = true
             AND d.is_on_ride = false
             AND d.status = 'approved'
             AND ($5::int IS NULL OR d.user_id IS DISTINCT FROM $5::int)
             AND ST_DWithin(
                     d.current_location::geography,
                     ST_MakePoint($2,$1)::geography,
                     $3
                 )
           ORDER BY distance_km ASC
           LIMIT $4""",
        pickup_lat, pickup_lng, radius_km * 1000, MAX_DRIVERS, exclude_user_id,
    )
    return [dict(r) for r in rows]


# Qishloq/tuman sharoitida 5 km ichida hech kim bo'lmasa — qidiruv radiusi bosqichma-bosqich kengayadi
EXPAND_RADII_KM = (SEARCH_RADIUS_KM, 15, 30)


async def find_drivers_expanding(conn: asyncpg.Connection, pickup_lat: float, pickup_lng: float,
                                 exclude_user_id: int | None = None) -> list[dict]:
    for radius in EXPAND_RADII_KM:
        rows = await find_nearest_drivers(conn, pickup_lat, pickup_lng, radius, exclude_user_id)
        if rows:
            return rows
    return []
