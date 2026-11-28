import asyncpg
from datetime import datetime

# Haydovchiga tarif biriktirilmagan bo'lsa — eng past sinf (Ekonom) hisoblanadi
DEFAULT_LEVEL, DEFAULT_SEATS = 1, 4


async def list_tariffs(conn: asyncpg.Connection) -> list[dict]:
    """Faol taksi tariflari (mijozga ko'rsatish tartibida)."""
    rows = await conn.fetch("SELECT * FROM tariffs WHERE is_active ORDER BY sort_order, level, id")
    return [dict(r) for r in rows]


async def get_active_tariff(conn: asyncpg.Connection, tariff_id: int | None = None) -> dict:
    """Berilgan faol tarif; berilmasa — standart (ro'yxatdagi birinchi, odatda Ekonom)."""
    if tariff_id is not None:
        row = await conn.fetchrow("SELECT * FROM tariffs WHERE id=$1 AND is_active", tariff_id)
        if not row:
            raise LookupError("Bu tarif mavjud emas yoki o'chirilgan")
        return dict(row)
    row = await conn.fetchrow("SELECT * FROM tariffs WHERE is_active ORDER BY sort_order, level, id LIMIT 1")
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


async def estimate_price(conn: asyncpg.Connection, distance_km: float, duration_min: float,
                         tariff_id: int | None = None) -> tuple[float, dict]:
    tariff = await get_active_tariff(conn, tariff_id)
    return calculate_price(distance_km, duration_min, tariff), tariff


def tariff_public(t: dict, price: float | None = None) -> dict:
    """Mijozga ko'rsatiladigan tarif ma'lumoti (ichki koeffitsientlarsiz)."""
    out = {"id": t["id"], "code": t.get("code"), "name": t["name"], "seats": t.get("seats") or DEFAULT_SEATS,
           "level": t.get("level") or DEFAULT_LEVEL, "description": t.get("description")}
    if price is not None:
        out["price"] = price
    return out
