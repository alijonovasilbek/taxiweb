from fastapi import APIRouter, Depends
from app.database import get_db
from app.schemas.auth import TelegramAuthRequest, RefreshRequest
from app.services.auth_service import authenticate_passenger, authenticate_driver
from app.auth import decode_token, create_token
import asyncpg

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/verify-telegram")
async def verify_telegram(body: TelegramAuthRequest, conn: asyncpg.Connection = Depends(get_db)):
    if body.role == "driver":
        return await authenticate_driver(body.init_data, conn)
    return await authenticate_passenger(body.init_data, conn)


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    payload = decode_token(body.token)
    new_token = create_token({k: v for k, v in payload.items() if k != "exp"})
    return {"token": new_token}
