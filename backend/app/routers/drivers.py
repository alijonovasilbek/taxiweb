import os
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from app.database import get_db
from app.auth import get_current_user
from app.schemas.driver import DriverRegisterRequest, DriverStatusRequest
from app.services.matching_service import find_nearest_drivers
from app.config import settings
import asyncpg
import aiofiles

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.post("/register", status_code=201)
async def register(body: DriverRegisterRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    tg_id = user.get("telegram_id")
    existing = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", tg_id)
    if existing:
        raise HTTPException(409, "Already registered")

    user_row = await conn.fetchrow("SELECT id FROM users WHERE telegram_id=$1", tg_id)
    user_id = user_row["id"] if user_row else None
    if not user_id:
        user_row = await conn.fetchrow(
            "INSERT INTO users(telegram_id,first_name,last_name) VALUES($1,$2,$3) RETURNING id",
            tg_id, body.first_name, body.last_name,
        )
        user_id = user_row["id"]

    row = await conn.fetchrow(
        """INSERT INTO drivers(user_id,telegram_id,first_name,last_name,phone,
                               car_model,car_color,car_number,car_year,status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING *""",
        user_id, tg_id, body.first_name, body.last_name, body.phone,
        body.car_model, body.car_color, body.car_number.upper(), body.car_year,
    )
    return dict(row)


@router.get("/me")
async def get_me(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not row:
        raise HTTPException(404, "Driver not found")
    return dict(row)


@router.put("/me/status")
async def update_status(body: DriverStatusRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver or driver["status"] != "approved":
        raise HTTPException(403, "Not approved")
    await conn.execute("UPDATE drivers SET is_online=$2 WHERE id=$1", driver["id"], body.is_online)
    return {"is_online": body.is_online}


@router.get("/me/earnings")
async def get_earnings(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    today = await conn.fetchrow(
        "SELECT COALESCE(SUM(final_price),0) as total FROM orders WHERE driver_id=$1 AND status='completed' AND completed_at::date=CURRENT_DATE",
        driver["id"],
    )
    return {"total_earnings": float(driver["total_earnings"]), "total_rides": driver["total_rides"], "today_earnings": float(today["total"])}


@router.get("/me/rides")
async def get_rides(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    rows = await conn.fetch("SELECT * FROM orders WHERE driver_id=$1 ORDER BY created_at DESC LIMIT 50", driver["id"])
    return [dict(r) for r in rows]


@router.post("/me/documents")
async def upload_documents(
    license: UploadFile | None = File(None),
    car_doc: UploadFile | None = File(None),
    user=Depends(get_current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    os.makedirs(settings.upload_dir, exist_ok=True)
    updates = {}
    for field, file in [("license_photo_url", license), ("car_doc_photo_url", car_doc)]:
        if file:
            if not file.content_type.startswith("image/"):
                raise HTTPException(400, "Only image files allowed")
            fname = f"{user.get('telegram_id')}_{field}_{file.filename}"
            path = os.path.join(settings.upload_dir, fname)
            async with aiofiles.open(path, "wb") as f:
                await f.write(await file.read())
            updates[field] = f"/uploads/{fname}"
    if updates:
        cols = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
        vals = list(updates.values())
        row = await conn.fetchrow(
            f"UPDATE drivers SET {cols} WHERE telegram_id=$1 RETURNING *",
            user.get("telegram_id"), *vals,
        )
        return dict(row)
    return {"message": "No files uploaded"}


@router.get("/nearby")
async def get_nearby(lat: float = Query(...), lng: float = Query(...), user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    drivers = await find_nearest_drivers(conn, lat, lng, 3)
    return drivers
