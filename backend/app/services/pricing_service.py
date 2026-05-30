import asyncpg
from datetime import datetime


async def get_active_tariff(conn: asyncpg.Connection) -> dict:
    row = await conn.fetchrow("SELECT * FROM tariffs WHERE is_active=true LIMIT 1")
    if not row:
        raise ValueError("No active tariff configured")
    return dict(row)


def calculate_price(distance_km: float, duration_min: float, tariff: dict) -> float:
    hour = datetime.now().hour
    is_night = hour >= 22 or hour < 6
    price = (
        float(tariff["base_fare"])
        + distance_km * float(tariff["per_km_price"])
        + duration_min * float(tariff["per_min_price"])
    )
    if is_night:
        price *= float(tariff["night_multiplier"])
    min_fare = float(tariff["min_fare"])
    rounded = round(price / 100) * 100
    return max(rounded, min_fare)


async def estimate_price(conn: asyncpg.Connection, distance_km: float, duration_min: float) -> tuple[float, dict]:
    tariff = await get_active_tariff(conn)
    return calculate_price(distance_km, duration_min, tariff), tariff
