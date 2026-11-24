"""Umumiy FastAPI bog'liqliklari (yagona foydalanuvchi modeli)."""
import asyncpg
from fastapi import Depends, HTTPException

from app.auth import get_current_user
from app.database import get_db


async def get_user_row(payload: dict, conn: asyncpg.Connection) -> asyncpg.Record:
    row = None
    if payload.get("id"):
        row = await conn.fetchrow("SELECT * FROM users WHERE id=$1", payload["id"])
    elif payload.get("telegram_id"):
        row = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", payload["telegram_id"])
    if not row:
        raise HTTPException(401, "Foydalanuvchi topilmadi")
    if row["is_blocked"]:
        raise HTTPException(403, "Hisobingiz bloklangan")
    return row


async def current_user(payload=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)) -> dict:
    """Token egasining `users` jadvalidagi yozuvi (bloklanmagan)."""
    row = await get_user_row(payload, conn)
    return dict(row)
