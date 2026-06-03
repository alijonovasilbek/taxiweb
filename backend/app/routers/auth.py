from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.schemas.auth import TelegramAuthRequest, RefreshRequest
from app.services.auth_service import authenticate_passenger, authenticate_driver
from app.auth import decode_token, create_token
from app.config import settings
import asyncpg

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/verify-telegram")
async def verify_telegram(body: TelegramAuthRequest, conn: asyncpg.Connection = Depends(get_db)):
    if body.role == "driver":
        return await authenticate_driver(body.init_data, conn)
    return await authenticate_passenger(body.init_data, conn)


@router.post("/dev-login")
async def dev_login(body: dict, conn: asyncpg.Connection = Depends(get_db)):
    if not settings.dev_mode:
        raise HTTPException(403, "Dev mode disabled")
    tg_id = int(body.get("telegram_id", 111111111))
    role = body.get("role", "driver")
    first_name = body.get("first_name", "Dev")
    last_name = body.get("last_name", "User")

    if role == "admin":
        secret = settings.admin_jwt_secret or settings.jwt_secret
        token = create_token({"telegram_id": tg_id, "role": "admin"}, secret=secret)
        return {"token": token, "role": "admin"}

    if role == "driver":
        driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", tg_id)
        token = create_token({
            "telegram_id": tg_id,
            "role": "driver",
            "driver_id": driver["id"] if driver else None,
            "status": driver["status"] if driver else "unregistered",
        })
        return {"token": token, "role": "driver", "driver": dict(driver) if driver else None}

    user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", tg_id)
    if not user:
        user = await conn.fetchrow(
            "INSERT INTO users(telegram_id, first_name, last_name) VALUES($1,$2,$3) RETURNING *",
            tg_id, first_name, last_name,
        )
    token = create_token({"id": user["id"], "telegram_id": tg_id, "role": "passenger"})
    return {"token": token, "role": "passenger", "user": dict(user)}


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    payload = decode_token(body.token)
    new_token = create_token({k: v for k, v in payload.items() if k != "exp"})
    return {"token": new_token}
