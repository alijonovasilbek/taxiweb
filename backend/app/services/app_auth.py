"""Chortoq Ijrochi ilovasi: Telegram orqali kirish va qurilma sessiyalari (PLAN-ANDROID §4, B1–B2).

Oqim:
  1) ilova  POST /auth/app/start  → bir martalik `code` (faqat xeshi bazada) + bot havolasi
  2) foydalanuvchi botda `/start login_<code>` → "✅ Ha, kirish" tugmasi → kod uning akkauntiga bog'lanadi
  3) ilova  POST /auth/app/poll   → access token (1 soat) + refresh token (60 kun)
  4) ilova  POST /auth/app/refresh → yangi juftlik; eski refresh token bekor (rotation).
     Eski token qayta ishlatilsa — o'g'irlangan deb hisoblanadi va sessiya butunlay yopiladi.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import asyncpg

from app.auth import create_token
from app.config import settings

LOGIN_PREFIX = "login_"


def sha(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_login_code() -> str:
    # Telegram start parametri: 64 belgigacha, [A-Za-z0-9_-]; "login_" + 32 belgi
    return secrets.token_urlsafe(24)


def bot_link(code: str) -> str:
    return f"https://t.me/{settings.bot_username}?start={LOGIN_PREFIX}{code}"


def _access(user: dict, sid: int) -> str:
    # role=passenger: ilova Mini App bilan bir xil yagona akkaunt API'laridan foydalanadi
    return create_token({"id": user["id"], "telegram_id": user["telegram_id"], "role": "passenger",
                         "sid": sid, "app": True}, minutes=settings.app_access_ttl_min)


async def create_session(conn: asyncpg.Connection, user: dict, device_id: str, device_name: str | None) -> dict:
    refresh = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.app_refresh_ttl_days)
    # Bitta qurilmada bitta faol sessiya
    await revoke(conn, "user_id=$1 AND device_id=$2", user["id"], device_id)
    sid = await conn.fetchval(
        """INSERT INTO app_sessions(user_id, device_id, device_name, refresh_hash, expires_at)
           VALUES($1,$2,$3,$4,$5) RETURNING id""",
        user["id"], device_id, device_name, sha(refresh), expires,
    )
    return _tokens(user, sid, refresh)


def _tokens(user: dict, sid: int, refresh: str) -> dict:
    return {
        "access_token": _access(user, sid),
        "refresh_token": refresh,
        "expires_in": settings.app_access_ttl_min * 60,
        "token_type": "bearer",
        "user": {"id": user["id"], "telegram_id": user["telegram_id"], "first_name": user["first_name"]},
    }


async def rotate(conn: asyncpg.Connection, refresh: str) -> dict | None:
    """Refresh tokenni yangisiga almashtiradi. Noto'g'ri/eskirgan/o'g'irlangan bo'lsa — None."""
    h = sha(refresh)
    async with conn.transaction():
        s = await conn.fetchrow(
            "SELECT * FROM app_sessions WHERE refresh_hash=$1 AND revoked_at IS NULL FOR UPDATE", h)
        if not s:
            # Avval ishlatilgan (aylantirilgan) token qayta keldi → kimdir nusxa olgan: sessiyani yopamiz
            stolen = await conn.fetchval("SELECT id FROM app_sessions WHERE prev_hash=$1 AND revoked_at IS NULL", h)
            if stolen:
                await revoke(conn, "id=$1", stolen)
            return None
        if s["expires_at"] < datetime.now(timezone.utc):
            await revoke(conn, "id=$1", s["id"])
            return None
        user = await conn.fetchrow("SELECT * FROM users WHERE id=$1", s["user_id"])
        if not user or user["is_blocked"]:
            await revoke(conn, "id=$1", s["id"])
            return None
        new = secrets.token_urlsafe(48)
        await conn.execute(
            """UPDATE app_sessions SET prev_hash=refresh_hash, refresh_hash=$2, last_used_at=NOW(),
                   expires_at=$3 WHERE id=$1""",
            s["id"], sha(new), datetime.now(timezone.utc) + timedelta(days=settings.app_refresh_ttl_days),
        )
    return _tokens(dict(user), s["id"], new)


async def revoke(conn: asyncpg.Connection, where: str, *args) -> int:
    """Sessiyalarni yopadi va ularning access tokenlarini darhol bekor qiladi (Redis ro'yxati)."""
    rows = await conn.fetch(
        f"UPDATE app_sessions SET revoked_at=NOW() WHERE revoked_at IS NULL AND {where} RETURNING id", *args)
    if rows:
        from app.redis_client import get_redis
        r = get_redis()
        if r is not None:
            ttl = settings.app_access_ttl_min * 60 + 60
            try:
                for row in rows:
                    await r.set(f"revoked_sid:{row['id']}", "1", ex=ttl)
            except Exception:
                pass
    return len(rows)


async def revoke_user(conn: asyncpg.Connection, user_id: int) -> int:
    """Admin bloklaganda: foydalanuvchining barcha qurilmalaridagi sessiyalar yopiladi."""
    n = await revoke(conn, "user_id=$1", user_id)
    await conn.execute("UPDATE devices SET fcm_token=NULL WHERE user_id=$1", user_id)
    return n
