"""Ijrochi rollari erkin tanlanmaydi — admin tasdiqlagan transportdan kelib chiqadi."""
import asyncpg

from app.catalog import VEHICLE_CATEGORIES

ADMIN_ONLY_ROLES = {"company"}  # faqat admin beradi (saqlab qolinadi, o'zi qo'sholmaydi)


async def eligible_roles(conn: asyncpg.Connection, user_id: int) -> set[str]:
    rows = await conn.fetch("SELECT DISTINCT category FROM vehicles WHERE owner_id=$1 AND status='approved'", user_id)
    return {"client"} | {VEHICLE_CATEGORIES[r["category"]]["role"] for r in rows if r["category"] in VEHICLE_CATEGORIES}


async def sync_roles(conn: asyncpg.Connection, user_id: int) -> list[str]:
    """Transport tasdiqlansa/rad etilsa/o'chirilsa chaqiriladi: rollar = tasdiqlangan transportlar rollari (+ admin bergan)."""
    current = await conn.fetchval("SELECT roles FROM users WHERE id=$1", user_id) or []
    roles = await eligible_roles(conn, user_id) | (set(current) & ADMIN_ONLY_ROLES)
    ordered = ["client"] + sorted(r for r in roles if r != "client")
    await conn.execute("UPDATE users SET roles=$2::text[], updated_at=NOW() WHERE id=$1", user_id, ordered)
    from app.services.taxi_driver import sync_taxi_driver
    await sync_taxi_driver(conn, user_id)
    return ordered
