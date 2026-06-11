from fastapi import APIRouter, Depends, Query, HTTPException
from app.database import get_db
from app.auth import get_admin_user, hash_password
from app.schemas.payment import TariffUpdateRequest
from app.services.notification_service import send_to_driver
import asyncpg

router = APIRouter(prefix="/admin", tags=["admin"])


def serialize_driver(row):
    data = dict(row)
    data.pop("password_hash", None)
    return data


@router.get("/dashboard")
async def dashboard(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    today_orders = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE created_at::date=CURRENT_DATE")
    active_drivers = await conn.fetchval("SELECT COUNT(*) FROM drivers WHERE is_online=true AND status='approved'")
    today_revenue = await conn.fetchval("SELECT COALESCE(SUM(final_price),0) FROM orders WHERE status='completed' AND completed_at::date=CURRENT_DATE")
    avg_rating = await conn.fetchval("SELECT COALESCE(AVG(rating),5) FROM drivers")
    return {
        "today_orders": today_orders,
        "active_drivers": active_drivers,
        "today_revenue": float(today_revenue),
        "avg_driver_rating": round(float(avg_rating), 2),
    }


@router.get("/drivers")
async def list_drivers(status: str | None = None, page: int = 1, limit: int = 20,
                       admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    where = "WHERE status=$3" if status else ""
    args = [limit, (page - 1) * limit]
    if status:
        args.append(status)
    rows = await conn.fetch(f"SELECT * FROM drivers {where} ORDER BY created_at DESC LIMIT $1 OFFSET $2", *args)
    total = await conn.fetchval(f"SELECT COUNT(*) FROM drivers {where}", *([status] if status else []))
    return {"drivers": [serialize_driver(r) for r in rows], "total": total, "page": page}


@router.post("/drivers", status_code=201)
async def create_driver(body: dict, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    import random
    driver_login = (body.get("driver_login") or "").strip()
    password = body.get("password") or ""
    if not driver_login or not password:
        raise HTTPException(422, "Login va parol majburiy")
    if len(password) < 4:
        raise HTTPException(422, "Parol kamida 4 ta belgidan iborat bo'lishi kerak")

    tg_id = body.get("telegram_id") or random.randint(10**9, 10**10 - 1)
    tg_id = int(tg_id)
    existing = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", tg_id)
    if existing:
        raise HTTPException(409, "Bu telegram_id allaqachon mavjud")
    existing_login = await conn.fetchrow("SELECT id FROM drivers WHERE driver_login=$1", driver_login)
    if existing_login:
        raise HTTPException(409, "Bu login band")
    user = await conn.fetchrow("SELECT id FROM users WHERE telegram_id=$1", tg_id)
    if not user:
        user = await conn.fetchrow(
            "INSERT INTO users(telegram_id,first_name,last_name) VALUES($1,$2,$3) RETURNING id",
            tg_id, body.get("first_name", ""), body.get("last_name", ""),
        )
    row = await conn.fetchrow(
        """INSERT INTO drivers(user_id,telegram_id,first_name,last_name,phone,
                               car_model,car_color,car_number,car_year,status,driver_login,password_hash)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',$10,$11) RETURNING *""",
        user["id"], tg_id,
        body.get("first_name", ""), body.get("last_name", ""), body.get("phone", ""),
        body.get("car_model", ""), body.get("car_color", ""),
        body.get("car_number", "").upper(), body.get("car_year"), driver_login, hash_password(password),
    )
    return serialize_driver(row)


@router.put("/drivers/{driver_id}/credentials")
async def update_driver_credentials(driver_id: int, body: dict, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    driver_login = (body.get("driver_login") or "").strip()
    password = body.get("password") or ""
    if not driver_login or not password:
        raise HTTPException(422, "Login va parol majburiy")
    if len(password) < 4:
        raise HTTPException(422, "Parol kamida 4 ta belgidan iborat bo'lishi kerak")

    existing = await conn.fetchrow("SELECT id FROM drivers WHERE driver_login=$1 AND id<>$2", driver_login, driver_id)
    if existing:
        raise HTTPException(409, "Bu login band")

    row = await conn.fetchrow(
        "UPDATE drivers SET driver_login=$2, password_hash=$3, updated_at=NOW() WHERE id=$1 RETURNING *",
        driver_id, driver_login, hash_password(password),
    )
    if not row:
        raise HTTPException(404, "Not found")
    return serialize_driver(row)


@router.get("/drivers/{driver_id}")
async def get_driver(driver_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM drivers WHERE id=$1", driver_id)
    if not row:
        raise HTTPException(404, "Not found")
    count = await conn.fetchval("SELECT COUNT(*) FROM orders WHERE driver_id=$1", driver_id)
    return {**serialize_driver(row), "total_rides_count": count}


@router.put("/drivers/{driver_id}/approve")
async def approve_driver(driver_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE drivers SET status='approved' WHERE id=$1", driver_id)
    await send_to_driver(driver_id, "Tabriklaymiz! Siz tasdiqlandi. Endi onlayn bo'lib buyurtma qabul qila olasiz.")
    return {"success": True}


@router.put("/drivers/{driver_id}/block")
async def block_driver(driver_id: int, body: dict, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    reason = body.get("reason", "qoidabuzarlik")
    await conn.execute("UPDATE drivers SET status='blocked',is_online=false WHERE id=$1", driver_id)
    await send_to_driver(driver_id, f"Hisobingiz bloklandi. Sabab: {reason}")
    return {"success": True}


@router.get("/orders")
async def list_orders(status: str | None = None, date: str | None = None, page: int = 1, limit: int = 20,
                      admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    conditions, args = [], [limit, (page - 1) * limit]
    if status:
        args.append(status)
        conditions.append(f"status=${len(args)}")
    if date:
        args.append(date)
        conditions.append(f"created_at::date=${len(args)}")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = await conn.fetch(f"SELECT * FROM orders {where} ORDER BY created_at DESC LIMIT $1 OFFSET $2", *args)
    total = await conn.fetchval(f"SELECT COUNT(*) FROM orders {where}", *args[2:])
    return {"orders": [dict(r) for r in rows], "total": total, "page": page}


@router.get("/payments")
async def list_payments(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM payments ORDER BY created_at DESC LIMIT 100")
    return [dict(r) for r in rows]


@router.get("/tariffs")
async def get_tariffs(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM tariffs ORDER BY created_at DESC")
    return [dict(r) for r in rows]


@router.put("/tariffs")
async def update_tariff(body: TariffUpdateRequest, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE tariffs SET is_active=false WHERE is_active=true")
    row = await conn.fetchrow(
        """INSERT INTO tariffs(name,base_fare,per_km_price,per_min_price,min_fare,night_multiplier,is_active)
           VALUES('Standard',$1,$2,$3,$4,$5,true) RETURNING *""",
        body.base_fare, body.per_km_price, body.per_min_price, body.min_fare, body.night_multiplier,
    )
    return dict(row)


@router.get("/active-drivers")
async def get_active_drivers(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT id,first_name,last_name,car_model,car_number,rating,is_on_ride,
                  ST_X(current_location::geometry) as lng,
                  ST_Y(current_location::geometry) as lat
           FROM drivers WHERE is_online=true AND status='approved' AND current_location IS NOT NULL"""
    )
    return [dict(r) for r in rows]


@router.get("/reports/daily")
async def daily_report(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT created_at::date as date, COUNT(*) as total_orders,
                  COUNT(*) FILTER (WHERE status='completed') as completed,
                  COUNT(*) FILTER (WHERE status='cancelled') as cancelled,
                  COALESCE(SUM(final_price) FILTER (WHERE status='completed'),0) as revenue
           FROM orders WHERE created_at >= NOW()-INTERVAL '7 days'
           GROUP BY date ORDER BY date DESC"""
    )
    return [dict(r) for r in rows]


@router.get("/reports/weekly")
async def weekly_report(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT DATE_TRUNC('week',created_at) as week, COUNT(*) as total_orders,
                  COUNT(*) FILTER (WHERE status='completed') as completed,
                  COALESCE(SUM(final_price) FILTER (WHERE status='completed'),0) as revenue
           FROM orders WHERE created_at >= NOW()-INTERVAL '12 weeks'
           GROUP BY week ORDER BY week DESC"""
    )
    return [dict(r) for r in rows]
