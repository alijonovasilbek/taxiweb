import hashlib
import hmac
import time
from urllib.parse import parse_qsl, unquote

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

bearer_scheme = HTTPBearer()


def verify_telegram_init_data(init_data: str) -> dict:
    """HMAC-SHA256 tekshirish va user ma'lumotlarini qaytarish."""
    params = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = params.pop("hash", None)
    if not received_hash:
        raise HTTPException(status_code=401, detail="No hash in initData")

    auth_date = int(params.get("auth_date", 0))
    if time.time() - auth_date > 300:
        raise HTTPException(status_code=401, detail="initData expired")

    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(params.items())
    )
    secret_key = hmac.new(b"WebAppData", settings.telegram_bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(received_hash, expected_hash):
        raise HTTPException(status_code=401, detail="Invalid initData signature")

    import json
    user_str = params.get("user", "{}")
    return json.loads(unquote(user_str))


def create_token(payload: dict, secret: str | None = None) -> str:
    from datetime import datetime, timedelta, timezone
    expire = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expires_days)
    return jwt.encode({**payload, "exp": expire}, secret or settings.jwt_secret, algorithm="HS256")


def decode_token(token: str, secret: str | None = None) -> dict:
    try:
        return jwt.decode(token, secret or settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    return decode_token(credentials.credentials)


async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    secret = settings.admin_jwt_secret or settings.jwt_secret
    payload = decode_token(credentials.credentials, secret)
    if payload.get("telegram_id") not in settings.admin_ids:
        raise HTTPException(status_code=403, detail="Forbidden")
    return payload
