import hashlib
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from app.log import log
from app.database import get_db
from app.security import rate_limit, require_dev_local
from app.schemas.auth import TelegramAuthRequest, RefreshRequest, DriverLoginRequest
from app.auth import decode_token, create_token, verify_password
from app.config import settings
import asyncpg
from app.utils import row_to_dict

router = APIRouter(prefix="/auth", tags=["auth"])


def serialize_driver(row):
    if not row:
        return None
    data = dict(row)
    data.pop("password_hash", None)
    return data


class AdminCodeRequest(BaseModel):
    telegram_id: int


class AdminCodeVerify(BaseModel):
    telegram_id: int
    code: str = Field(min_length=6, max_length=6)


def _code_hash(tg_id: int, code: str) -> str:
    return hmac.new(settings.admin_jwt_secret.encode() or b"x", f"{tg_id}:{code}".encode(), hashlib.sha256).hexdigest()


def _admin_token(tg_id: int) -> dict:
    secret = settings.admin_jwt_secret or settings.jwt_secret
    return {"token": create_token({"telegram_id": tg_id, "role": "admin"}, secret=secret), "role": "admin"}


@router.post("/admin/request-code", dependencies=[Depends(rate_limit("admin-code", 5, 600))])
async def admin_request_code(body: AdminCodeRequest):
    """Admin panelga kirish: bir martalik 6 xonali kod admin Telegram chatiga bot orqali yuboriladi."""
    from app.bot import handlers
    from app.redis_client import get_redis

    # Ro'yxatda bo'lmasa ham bir xil javob — kim admin ekanini bilib bo'lmasin
    if body.telegram_id in settings.admin_ids and handlers.bot is not None and get_redis() is not None:
        code = f"{secrets.randbelow(10**6):06d}"
        r = get_redis()
        await r.set(f"admin_code:{body.telegram_id}", _code_hash(body.telegram_id, code), ex=300)
        await r.delete(f"admin_code_try:{body.telegram_id}")
        try:
            await handlers.bot.send_message(
                body.telegram_id,
                f"🔐 Chortoq Services admin paneliga kirish kodi: <b>{code}</b>\n5 daqiqa amal qiladi. "
                "Agar bu siz bo'lmasangiz, e'tibor bermang.",
                parse_mode="HTML",
            )
        except Exception as e:
            log.warning(f"[auth] admin code send error: {e}")
    return {"sent": True, "message": "Agar ID admin bo'lsa, kod Telegram'ga yuborildi"}


@router.post("/admin/verify-code", dependencies=[Depends(rate_limit("admin-verify", 10, 600))])
async def admin_verify_code(body: AdminCodeVerify):
    from app.redis_client import get_redis

    r = get_redis()
    if r is None or body.telegram_id not in settings.admin_ids:
        raise HTTPException(401, "Kod noto'g'ri yoki muddati o'tgan")
    key, tries_key = f"admin_code:{body.telegram_id}", f"admin_code_try:{body.telegram_id}"
    tries = await r.incr(tries_key)
    await r.expire(tries_key, 300)
    stored = await r.get(key)
    if tries > 5 or not stored or not hmac.compare_digest(stored, _code_hash(body.telegram_id, body.code)):
        if tries > 5:
            await r.delete(key)
        raise HTTPException(401, "Kod noto'g'ri yoki muddati o'tgan")
    await r.delete(key, tries_key)
    return _admin_token(body.telegram_id)


@router.post("/verify-telegram", dependencies=[Depends(rate_limit("auth", 30, 60))])
async def verify_telegram(body: TelegramAuthRequest, conn: asyncpg.Connection = Depends(get_db)):
    from app.services.auth_service import authenticate_auto, authenticate_driver, authenticate_passenger

    if body.role == "driver":
        return await authenticate_driver(body.init_data, conn)

    if body.role == "passenger":
        return await authenticate_passenger(body.init_data, conn)

    return await authenticate_auto(body.init_data, conn, settings.admin_ids)


@router.post("/dev-login", dependencies=[Depends(require_dev_local)])
async def dev_login(body: dict, conn: asyncpg.Connection = Depends(get_db)):
    # Faqat DEV_MODE + lokal so'rov (ngrok/nginx orqali emas) — require_dev_local
    tg_id = int(body.get("telegram_id", 111111111))
    role = body.get("role", "driver")
    first_name = body.get("first_name", "Dev")
    last_name = body.get("last_name", "User")

    if role == "admin":
        if tg_id not in settings.admin_ids:
            raise HTTPException(403, "Bu Telegram ID admin emas")
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
    return {"token": token, "role": "passenger", "user": row_to_dict(user)}


@router.post("/driver-login", dependencies=[Depends(rate_limit("driver-login", 10, 300))])
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
