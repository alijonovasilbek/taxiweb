"""Servis tariflari bo'yicha taxminiy narx (xizmat turiga mos qoidalar)."""
import asyncpg

DURATION_FIELD = {"hour": "per_hour", "shift": "per_shift", "day": "per_day"}


async def get_tariff(conn: asyncpg.Connection, service: str, category: str | None) -> dict | None:
    row = None
    if category:
        row = await conn.fetchrow(
            "SELECT * FROM service_tariffs WHERE service_type=$1 AND vehicle_category=$2 AND is_active",
            service, category,
        )
    if not row:
        row = await conn.fetchrow(
            """SELECT * FROM service_tariffs WHERE service_type=$1 AND is_active
               ORDER BY (vehicle_category IS NULL) DESC, min_price ASC LIMIT 1""",
            service,
        )
    return dict(row) if row else None


def compute(tariff: dict | None, *, distance_km: float | None = None, duration_value: float | None = None,
            duration_unit: str | None = None, seats: int = 1, service: str = "") -> float | None:
    if not tariff:
        return None
    f = lambda k: float(tariff.get(k) or 0)  # noqa: E731
    price = f("base_price")
    if service == "carpool":
        price += (distance_km or 0) * f("per_seat_km") * max(1, seats)
    else:
        price += (distance_km or 0) * f("per_km")
        if duration_value and duration_unit in DURATION_FIELD:
            price += duration_value * f(DURATION_FIELD[duration_unit])
    price = max(price, f("min_price"))
    return float(round(price / 1000) * 1000) if price >= 1000 else float(round(price))


async def estimate(conn: asyncpg.Connection, service: str, category: str | None = None, **kw) -> dict:
    tariff = await get_tariff(conn, service, category)
    price = compute(tariff, service=service, **kw)
    return {"service_type": service, "vehicle_category": category, "estimated_price": price,
            "tariff": tariff}
