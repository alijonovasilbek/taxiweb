"""Chortoq Ijrochi ilovasi uchun kirish: /auth/app/* (PLAN-ANDROID B1–B2)."""
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.security import rate_limit
from app.services import app_auth

router = APIRouter(prefix="/auth/app", tags=["mobile-auth"])

DEVICE_ID = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")


class StartIn(BaseModel):
    device_id: str = DEVICE_ID
    device_name: str | None = Field(None, max_length=120)


class CodeIn(BaseModel):
    code: str = Field(min_length=20, max_length=58, pattern=r"^[A-Za-z0-9_-]+$")
    device_id: str = DEVICE_ID


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


@router.post("/start", dependencies=[Depends(rate_limit("app-start", 10, 600))])
async def start(body: StartIn, conn: asyncpg.Connection = Depends(get_db)):
    code = app_auth.new_login_code()
    await conn.execute("DELETE FROM app_login_codes WHERE expires_at < NOW() - INTERVAL '1 day'")
    await conn.execute(
        """INSERT INTO app_login_codes(code_hash, device_id, device_name, expires_at)
           VALUES($1,$2,$3, NOW() + make_interval(secs => $4))""",
        app_auth.sha(code), body.device_id, body.device_name, settings.app_login_code_ttl_sec,
    )
    return {"code": code, "bot_url": app_auth.bot_link(code), "expires_in": settings.app_login_code_ttl_sec,
            "poll_interval": 2}


@router.post("/poll", dependencies=[Depends(rate_limit("app-poll", 90, 60))])
async def poll(body: CodeIn, response: Response, conn: asyncpg.Connection = Depends(get_db)):
    """202 — hali tasdiqlanmagan; 200 — tokenlar; 410 — muddati o'tgan yoki rad etilgan."""
    h = app_auth.sha(body.code)
    async with conn.transaction():
        row = await conn.fetchrow("SELECT * FROM app_login_codes WHERE code_hash=$1 FOR UPDATE", h)
        # Kod boshqa qurilmaga berilgan bo'lsa — bilmagandek javob beramiz
        if not row or row["device_id"] != body.device_id:
            raise HTTPException(410, "Kod topilmadi yoki muddati o'tgan. Qaytadan urinib ko'ring.")
        if row["status"] == "denied":
            raise HTTPException(410, "Kirish rad etildi")
        if row["status"] == "consumed":
            raise HTTPException(410, "Kod allaqachon ishlatilgan")
        if row["status"] == "pending":
            expired = await conn.fetchval("SELECT expires_at < NOW() FROM app_login_codes WHERE code_hash=$1", h)
            if expired:
                raise HTTPException(410, "Kod muddati o'tdi. Qaytadan urinib ko'ring.")
            response.status_code = 202
            return {"status": "pending"}
        # approved → bir martalik: tokenlar faqat bir marta beriladi
        await conn.execute("UPDATE app_login_codes SET status='consumed' WHERE code_hash=$1", h)
        user = await conn.fetchrow("SELECT * FROM users WHERE id=$1", row["user_id"])
        if not user or user["is_blocked"]:
            raise HTTPException(403, "Hisobingiz bloklangan")
        return await app_auth.create_session(conn, dict(user), row["device_id"], row["device_name"])


@router.post("/refresh", dependencies=[Depends(rate_limit("app-refresh", 30, 60))])
async def refresh(body: RefreshIn, conn: asyncpg.Connection = Depends(get_db)):
    tokens = await app_auth.rotate(conn, body.refresh_token)
    if not tokens:
        raise HTTPException(401, "Sessiya tugagan. Qaytadan kiring.")
    return tokens


@router.post("/logout")
async def logout(all_devices: bool = False, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    if not user.get("sid"):
        raise HTTPException(400, "Bu ilova sessiyasi emas")
    if all_devices:
        n = await app_auth.revoke(conn, "user_id=$1", user["id"])
    else:
        n = await app_auth.revoke(conn, "id=$1 AND user_id=$2", user["sid"], user["id"])
        await conn.execute(
            """UPDATE devices SET fcm_token=NULL WHERE user_id=$1
                 AND device_id=(SELECT device_id FROM app_sessions WHERE id=$2)""", user["id"], user["sid"])
    return {"revoked": n}


@router.get("/sessions")
async def sessions(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT id, device_id, device_name, created_at, last_used_at FROM app_sessions
           WHERE user_id=$1 AND revoked_at IS NULL ORDER BY last_used_at DESC""", user["id"])
    return [{**dict(r), "current": r["id"] == user.get("sid")} for r in rows]
