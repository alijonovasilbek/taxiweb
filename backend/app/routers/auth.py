from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.schemas.auth import TelegramAuthRequest, RefreshRequest, DriverLoginRequest
from app.auth import decode_token, create_token, verify_password
from app.config import settings
import asyncpg

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_driver(row):
    if not row:
        return None
    data = dict(row)
    data.pop("password_hash", None)
    return data


@router.post("/verify-telegram")
async def verify_telegram(body: TelegramAuthRequest, conn: asyncpg.Connection = Depends(get_db)):
    from app.services.auth_service import authenticate_auto, authenticate_driver, authenticate_passenger

    if body.role == "driver":
        return await authenticate_driver(body.init_data, conn)

    if body.role == "passenger":
        return await authenticate_passenger(body.init_data, conn)

    return await authenticate_auto(body.init_data, conn, settings.admin_ids)


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
        return {"token": token, "role": "driver", "driver": serialize_driver(driver)}

    user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", tg_id)
    if not user:
        user = await conn.fetchrow(
            "INSERT INTO users(telegram_id, first_name, last_name) VALUES($1,$2,$3) RETURNING *",
            tg_id, first_name, last_name,
        )
    token = create_token({"id": user["id"], "telegram_id": tg_id, "role": "passenger"})
    return {"token": token, "role": "passenger", "user": dict(user)}


@router.post("/driver-login")
async def driver_login(body: DriverLoginRequest, conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT * FROM drivers WHERE driver_login=$1", body.login.strip())
    if not driver or not verify_password(body.password, driver.get("password_hash")):
        raise HTTPException(401, "Login yoki parol noto'g'ri")
    if driver["status"] == "blocked":
        raise HTTPException(403, "Haydovchi bloklangan")

    token = create_token({
        "role": "driver",
        "driver_id": driver["id"],
        "telegram_id": driver["telegram_id"],
        "status": driver["status"],
    })
    return {"token": token, "role": "driver", "driver": serialize_driver(driver)}


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    payload = decode_token(body.token)
    new_token = create_token({k: v for k, v in payload.items() if k != "exp"})
    return {"token": new_token}
