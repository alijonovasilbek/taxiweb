from datetime import timedelta
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


def serialize_driver(row):
    if not row:
        return None
    data = dict(row)
    data.pop("password_hash", None)
    return data


async def get_driver_row(conn: asyncpg.Connection, user: dict):
    driver_id = user.get("driver_id")
    if driver_id:
        return await conn.fetchrow("SELECT * FROM drivers WHERE id=$1", driver_id)
    tg_id = user.get("telegram_id")
    if tg_id:
        return await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", tg_id)
    return None


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
    return serialize_driver(row)


@router.get("/me")
async def get_me(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await get_driver_row(conn, user)
    if not row:
        raise HTTPException(404, "Driver not found")
    tariff = await conn.fetchval("SELECT name FROM tariffs WHERE id=$1", row["tariff_id"]) if row["tariff_id"] else None
    return {**serialize_driver(row), "tariff_name": tariff or "Ekonom"}


@router.put("/me/status")
async def update_status(body: DriverStatusRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await get_driver_row(conn, user)
    if not driver or driver["status"] != "approved":
        raise HTTPException(403, "Not approved")
    if body.is_online:
        phone = await conn.fetchval(
            "SELECT phone FROM users WHERE telegram_id=$1 AND phone_verified", driver["telegram_id"])
        if not phone:
            raise HTTPException(400, "Onlayn bo'lishdan oldin telefon raqamingizni tasdiqlang (botda «📱 Raqamni ulashish»)")
    await conn.execute("UPDATE drivers SET is_online=$2 WHERE id=$1", driver["id"], body.is_online)
    return {"is_online": body.is_online}


@router.get("/me/earnings")
async def get_earnings(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await get_driver_row(conn, user)
    if not driver:
        raise HTTPException(404, "Driver not found")
    did = driver["id"]
    # Oxirgi 7 kun (bugun bilan): har kunning daromadi va safarlari — "Daromad" ekranidagi ustunlar
    days = {r["d"]: r for r in await conn.fetch(
        """SELECT completed_at::date AS d, COALESCE(SUM(final_price),0) AS total, COUNT(*) AS rides
           FROM orders WHERE driver_id=$1 AND status='completed' AND completed_at >= CURRENT_DATE - 6
           GROUP BY 1""", did)}
    today = await conn.fetchval("SELECT CURRENT_DATE")
    week = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        r = days.get(d)
        week.append({"date": d.isoformat(), "weekday": d.weekday(), "total": float(r["total"]) if r else 0.0,
                     "rides": r["rides"] if r else 0})
    # Liniyada bo'lgan vaqt: bugun joylashuv kelgan alohida daqiqalar soni (ilova onlayn paytda har ~10 s yuboradi)
    online_min = await conn.fetchval(
        """SELECT COUNT(DISTINCT date_trunc('minute', recorded_at)) FROM driver_location_history
           WHERE driver_id=$1 AND recorded_at >= CURRENT_DATE""", did)
    recent = await conn.fetch(
        """SELECT o.id, o.pickup_address, o.dropoff_address, o.final_price, o.completed_at, o.payment_method,
                  t.name AS tariff_name
           FROM orders o LEFT JOIN tariffs t ON t.id = o.tariff_id
           WHERE o.driver_id=$1 AND o.status='completed' ORDER BY o.completed_at DESC LIMIT 10""", did)
    return {
        "total_earnings": float(driver["total_earnings"]), "total_rides": driver["total_rides"],
        "today_earnings": week[-1]["total"], "today_rides": week[-1]["rides"],
        "online_min_today": online_min, "rating": float(driver["rating"] or 5),
        "week": week, "recent": [dict(r) for r in recent],
    }


@router.get("/me/rides")
async def get_rides(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await get_driver_row(conn, user)
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
    driver = await get_driver_row(conn, user)
    if not driver:
        raise HTTPException(404, "Driver not found")

    updates = {}
    for field, file in [("license_photo_url", license), ("car_doc_photo_url", car_doc)]:
        if file:
            # Shaxsiy hujjat: yopiq papka, tasodifiy nom (foydalanuvchi bergan fayl nomi ishlatilmaydi —
            # "../" bilan papkadan chiqib ketish mumkin edi), turi mazmunidan tekshiriladi
            from app.services.files import save_private_document
            updates[field] = await save_private_document(file, f"drv{driver['id']}_{field}")

    if updates:
        cols = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
        vals = list(updates.values())
        row = await conn.fetchrow(
            f"UPDATE drivers SET {cols} WHERE id=$1 RETURNING *",
            driver["id"], *vals,
        )
        return serialize_driver(row)
    return {"message": "No files uploaded"}


@router.get("/nearby")
async def get_nearby(lat: float = Query(...), lng: float = Query(...), user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Mijoz xaritasi uchun yaqin bo'sh mashinalar: faqat taxminiy joy (~10 m) va yetib kelish vaqti.
    Ism, telefon, Telegram ID va mashina raqami oshkor qilinmaydi."""
    drivers = await find_nearest_drivers(conn, lat, lng, 3)
    cars = [{"lat": round(float(d["lat"]), 4), "lng": round(float(d["lng"]), 4),
             "distance_km": round(float(d["distance_km"] or 0), 2)} for d in drivers if d.get("lat") is not None]
    # Shahar ichida ~25 km/soat + 1 daqiqa (chiqib kelish)
    eta = max(1, round(cars[0]["distance_km"] / 25 * 60) + 1) if cars else None
    return {"cars": cars, "eta_min": eta}
