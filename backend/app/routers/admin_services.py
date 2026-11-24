"""Admin: Chortoq Services boshqaruvi (foydalanuvchilar, transport, po'puti, so'rovlar, tariflar)."""
import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import get_admin_user
from app.catalog import VEHICLE_CATEGORIES
from app.database import get_db
from app.schemas.services import ServiceTariffIn, CancelIn
from app.services.notify import notify
from app.utils import row_to_dict, rows_to_list

router = APIRouter(prefix="/admin", tags=["admin-services"])


def _page(page: int, limit: int) -> tuple[int, int]:
    return limit, (max(page, 1) - 1) * limit


@router.get("/overview")
async def overview(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        """SELECT
          (SELECT COUNT(*) FROM users) AS users_total,
          (SELECT COUNT(*) FROM users WHERE created_at::date=CURRENT_DATE) AS users_today,
          (SELECT COUNT(*) FROM users WHERE roles && ARRAY['driver','cargo','equipment_owner','company']) AS providers,
          (SELECT COUNT(*) FROM vehicles) AS vehicles_total,
          (SELECT COUNT(*) FROM vehicles WHERE status='pending') AS vehicles_pending,
          (SELECT COUNT(*) FROM orders) AS taxi_orders,
          (SELECT COUNT(*) FROM orders WHERE created_at::date=CURRENT_DATE) AS taxi_today,
          (SELECT COUNT(*) FROM carpool_trips) AS trips_total,
          (SELECT COUNT(*) FROM carpool_trips WHERE status IN ('active','full')) AS trips_active,
          (SELECT COUNT(*) FROM carpool_bookings) AS bookings_total,
          (SELECT COUNT(*) FROM service_requests WHERE service_type='cargo') AS cargo_total,
          (SELECT COUNT(*) FROM service_requests WHERE service_type='equipment') AS equipment_total,
          (SELECT COUNT(*) FROM service_requests WHERE status='open') AS requests_open,
          (SELECT COUNT(*) FROM service_requests WHERE status='completed') AS requests_completed,
          (SELECT COUNT(*) FROM offers) AS offers_total,
          (SELECT COALESCE(AVG(rating),0) FROM reviews) AS avg_review"""
    )
    by_day = await conn.fetch(
        """WITH d AS (SELECT generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day')::date AS day)
           SELECT d.day,
             (SELECT COUNT(*) FROM orders o WHERE o.created_at::date=d.day) AS taxi,
             (SELECT COUNT(*) FROM carpool_bookings b WHERE b.created_at::date=d.day) AS carpool,
             (SELECT COUNT(*) FROM service_requests r WHERE r.service_type='cargo' AND r.created_at::date=d.day) AS cargo,
             (SELECT COUNT(*) FROM service_requests r WHERE r.service_type='equipment' AND r.created_at::date=d.day) AS equipment
           FROM d ORDER BY d.day"""
    )
    data = dict(row)
    data["avg_review"] = round(float(data["avg_review"]), 2)
    return {**data, "by_day": [dict(r) for r in by_day]}


# ── Foydalanuvchilar ────────────────────────────────────────────────────────
@router.get("/users")
async def list_users(q: str | None = None, role: str | None = None, blocked: bool | None = None,
                     page: int = 1, limit: int = Query(20, le=100),
                     admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    cond, args = [], []
    if q:
        args.append(f"%{q}%")
        n = len(args)
        cond.append(f"(first_name ILIKE ${n} OR last_name ILIKE ${n} OR phone ILIKE ${n} "
                    f"OR telegram_username ILIKE ${n} OR company_name ILIKE ${n})")
    if role:
        args.append(role)
        cond.append(f"${len(args)} = ANY(roles)")
    if blocked is not None:
        args.append(blocked)
        cond.append(f"is_blocked=${len(args)}")
    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    lim, off = _page(page, limit)
    rows = await conn.fetch(
        f"""SELECT u.*, (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id=u.id) AS vehicles_count
            FROM users u {where} ORDER BY u.created_at DESC LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, lim, off,
    )
    total = await conn.fetchval(f"SELECT COUNT(*) FROM users {where}", *args)
    return {"users": rows_to_list(rows), "total": total, "page": page}


@router.get("/users/{user_id}")
async def get_user(user_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
    if not row:
        raise HTTPException(404, "Topilmadi")
    vehicles = await conn.fetch("SELECT * FROM vehicles WHERE owner_id=$1 ORDER BY id", user_id)
    docs = await conn.fetch("SELECT * FROM user_documents WHERE user_id=$1 ORDER BY id DESC", user_id)
    reviews = await conn.fetch(
        "SELECT * FROM reviews WHERE target_user_id=$1 ORDER BY created_at DESC LIMIT 20", user_id
    )
    return {**row_to_dict(row), "vehicles": rows_to_list(vehicles), "documents": [dict(d) for d in docs],
            "reviews": [dict(r) for r in reviews]}


@router.put("/users/{user_id}/block")
async def block_user(user_id: int, body: CancelIn | None = None, admin=Depends(get_admin_user),
                     conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE users SET is_blocked=true, updated_at=NOW() WHERE id=$1", user_id)
    await conn.execute("UPDATE vehicles SET is_available=false WHERE owner_id=$1", user_id)
    await conn.execute(
        "UPDATE carpool_trips SET status='cancelled' WHERE driver_id=$1 AND status IN ('active','full')", user_id
    )
    return {"success": True}


@router.put("/users/{user_id}/unblock")
async def unblock_user(user_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE users SET is_blocked=false, updated_at=NOW() WHERE id=$1", user_id)
    return {"success": True}


# ── Transport ───────────────────────────────────────────────────────────────
@router.get("/vehicles")
async def list_vehicles(status: str | None = None, category: str | None = None, page: int = 1,
                        limit: int = Query(20, le=100), admin=Depends(get_admin_user),
                        conn: asyncpg.Connection = Depends(get_db)):
    cond, args = [], []
    if status:
        args.append(status)
        cond.append(f"v.status=${len(args)}")
    if category:
        args.append(category)
        cond.append(f"v.category=${len(args)}")
    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    lim, off = _page(page, limit)
    rows = await conn.fetch(
        f"""SELECT v.*, u.first_name, u.last_name, u.phone, u.telegram_username,
                   (SELECT json_agg(d.*) FROM user_documents d WHERE d.vehicle_id=v.id) AS documents
            FROM vehicles v JOIN users u ON u.id=v.owner_id {where}
            ORDER BY (v.status='pending') DESC, v.created_at DESC
            LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, lim, off,
    )
    total = await conn.fetchval(f"SELECT COUNT(*) FROM vehicles v {where}", *args)
    return {"vehicles": rows_to_list(rows), "total": total, "page": page}


@router.put("/vehicles/{vehicle_id}/approve")
async def approve_vehicle(vehicle_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "UPDATE vehicles SET status='approved', reject_reason=NULL, updated_at=NOW() WHERE id=$1 RETURNING *",
        vehicle_id,
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    await conn.execute("UPDATE user_documents SET status='approved' WHERE vehicle_id=$1 AND status='pending'",
                       vehicle_id)
    name = VEHICLE_CATEGORIES.get(row["category"], {}).get("name", "")
    await notify(row["owner_id"], "vehicle_status", "✅ Transport tasdiqlandi",
                 f"{name} {row['model']} tasdiqlandi. Endi buyurtmalar va so'rovlarni qabul qila olasiz.",
                 {"vehicle_id": vehicle_id, "status": "approved"}, event="vehicle:status", link="/vehicles")
    return row_to_dict(row)


@router.put("/vehicles/{vehicle_id}/reject")
async def reject_vehicle(vehicle_id: int, body: CancelIn | None = None, admin=Depends(get_admin_user),
                         conn: asyncpg.Connection = Depends(get_db)):
    reason = (body.reason if body else None) or "Ma'lumotlar to'liq emas"
    row = await conn.fetchrow(
        "UPDATE vehicles SET status='rejected', reject_reason=$2, updated_at=NOW() WHERE id=$1 RETURNING *",
        vehicle_id, reason,
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    await notify(row["owner_id"], "vehicle_status", "❌ Transport rad etildi",
                 f"{row['model']}: {reason}", {"vehicle_id": vehicle_id, "status": "rejected"},
                 event="vehicle:status", link="/vehicles")
    return row_to_dict(row)


# ── Po'puti ─────────────────────────────────────────────────────────────────
@router.get("/carpool/trips")
async def list_trips(status: str | None = None, page: int = 1, limit: int = Query(20, le=100),
                     admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    args, where = [], ""
    if status:
        args.append(status)
        where = "WHERE t.status=$1"
    lim, off = _page(page, limit)
    rows = await conn.fetch(
        f"""SELECT t.*, u.first_name AS driver_name, u.phone AS driver_phone,
                   (SELECT COUNT(*) FROM carpool_bookings b WHERE b.trip_id=t.id) AS bookings_count
            FROM carpool_trips t JOIN users u ON u.id=t.driver_id {where}
            ORDER BY t.departure_at DESC LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, lim, off,
    )
    total = await conn.fetchval(f"SELECT COUNT(*) FROM carpool_trips t {where}", *args)
    return {"trips": rows_to_list(rows), "total": total, "page": page}


@router.put("/carpool/trips/{trip_id}/cancel")
async def admin_cancel_trip(trip_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "UPDATE carpool_trips SET status='cancelled', updated_at=NOW() WHERE id=$1 RETURNING driver_id", trip_id
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    await conn.execute(
        "UPDATE carpool_bookings SET status='cancelled' WHERE trip_id=$1 AND status IN ('pending','confirmed')", trip_id
    )
    await notify(row["driver_id"], "carpool_trip", "Qatnov admin tomonidan bekor qilindi", f"Qatnov #{trip_id}",
                 {"trip_id": trip_id})
    return {"success": True}


# ── So'rovlar (yuk / texnika) ───────────────────────────────────────────────
@router.get("/requests")
async def list_requests(service: str | None = None, status: str | None = None, page: int = 1,
                        limit: int = Query(20, le=100), admin=Depends(get_admin_user),
                        conn: asyncpg.Connection = Depends(get_db)):
    cond, args = [], []
    if service:
        args.append(service)
        cond.append(f"r.service_type=${len(args)}")
    if status:
        args.append(status)
        cond.append(f"r.status=${len(args)}")
    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    lim, off = _page(page, limit)
    rows = await conn.fetch(
        f"""SELECT r.*, c.first_name AS client_name, c.phone AS client_phone, p.first_name AS provider_name
            FROM service_requests r JOIN users c ON c.id=r.client_id LEFT JOIN users p ON p.id=r.provider_id
            {where} ORDER BY r.created_at DESC LIMIT ${len(args) + 1} OFFSET ${len(args) + 2}""",
        *args, lim, off,
    )
    total = await conn.fetchval(f"SELECT COUNT(*) FROM service_requests r {where}", *args)
    return {"requests": rows_to_list(rows), "total": total, "page": page}


@router.get("/requests/{request_id}")
async def get_request(request_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        """SELECT r.*, c.first_name AS client_name, c.phone AS client_phone, p.first_name AS provider_name
           FROM service_requests r JOIN users c ON c.id=r.client_id LEFT JOIN users p ON p.id=r.provider_id
           WHERE r.id=$1""",
        request_id,
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    offers = await conn.fetch(
        """SELECT o.*, u.first_name, u.phone, v.model, v.category FROM offers o
           JOIN users u ON u.id=o.provider_id LEFT JOIN vehicles v ON v.id=o.vehicle_id
           WHERE o.request_id=$1 ORDER BY o.price""",
        request_id,
    )
    return {**row_to_dict(row), "offers": [dict(o) for o in offers]}


@router.put("/requests/{request_id}/cancel")
async def admin_cancel_request(request_id: int, body: CancelIn | None = None, admin=Depends(get_admin_user),
                               conn: asyncpg.Connection = Depends(get_db)):
    reason = (body.reason if body else None) or "Admin tomonidan bekor qilindi"
    row = await conn.fetchrow(
        """UPDATE service_requests SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2, updated_at=NOW()
           WHERE id=$1 AND status NOT IN ('completed','cancelled') RETURNING client_id, provider_id""",
        request_id, reason,
    )
    if not row:
        raise HTTPException(409, "Bekor qilib bo'lmaydi")
    await conn.execute("UPDATE offers SET status='rejected' WHERE request_id=$1 AND status='pending'", request_id)
    for uid in {row["client_id"], row["provider_id"]} - {None}:
        await notify(uid, "request_status", "So'rov bekor qilindi", reason, {"request_id": request_id})
    return {"success": True}


# ── Servislar va tariflar ───────────────────────────────────────────────────
@router.get("/service-types")
async def service_types(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    return [dict(r) for r in await conn.fetch("SELECT * FROM service_types ORDER BY sort_order")]


@router.put("/service-types/{code}")
async def toggle_service(code: str, body: dict, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "UPDATE service_types SET is_active=$2 WHERE code=$1 RETURNING *", code, bool(body.get("is_active"))
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    return dict(row)


@router.get("/service-tariffs")
async def service_tariffs(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM service_tariffs ORDER BY service_type, vehicle_category NULLS FIRST")
    return [dict(r) for r in rows]


@router.post("/service-tariffs")
async def upsert_service_tariff(body: ServiceTariffIn, admin=Depends(get_admin_user),
                                conn: asyncpg.Connection = Depends(get_db)):
    exists = await conn.fetchval("SELECT 1 FROM service_types WHERE code=$1", body.service_type)
    if not exists:
        raise HTTPException(400, "Noma'lum servis")
    if body.vehicle_category and body.vehicle_category not in VEHICLE_CATEGORIES:
        raise HTTPException(400, "Noma'lum kategoriya")
    d = body.model_dump()
    existing = await conn.fetchval(
        "SELECT id FROM service_tariffs WHERE service_type=$1 AND vehicle_category IS NOT DISTINCT FROM $2",
        body.service_type, body.vehicle_category,
    )
    fields = ["base_price", "per_km", "per_hour", "per_shift", "per_day", "per_seat_km", "min_price", "is_active"]
    if existing:
        sets = ", ".join(f"{f}=${i + 2}" for i, f in enumerate(fields))
        row = await conn.fetchrow(
            f"UPDATE service_tariffs SET {sets}, updated_at=NOW() WHERE id=$1 RETURNING *",
            existing, *[d[f] for f in fields],
        )
    else:
        row = await conn.fetchrow(
            f"""INSERT INTO service_tariffs(service_type, vehicle_category, {', '.join(fields)})
                VALUES($1,$2,{', '.join(f'${i + 3}' for i in range(len(fields)))}) RETURNING *""",
            body.service_type, body.vehicle_category, *[d[f] for f in fields],
        )
    return dict(row)


@router.delete("/service-tariffs/{tariff_id}")
async def delete_service_tariff(tariff_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("DELETE FROM service_tariffs WHERE id=$1", tariff_id)
    return {"success": True}
