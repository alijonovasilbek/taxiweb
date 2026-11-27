"""Admin: Chortoq Services boshqaruvi (foydalanuvchilar, transport, po'puti, so'rovlar, tariflar)."""
import asyncpg
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.services.roles import sync_roles
from app.services.documents import missing_docs
from app.services import credentials
from app.services.files import doc_out, docs_out, save_private_document, save_public_image
from app.auth import get_admin_user
from app.catalog import DOC_TYPES, VEHICLE_CATEGORIES
from app.database import get_db
from app.schemas.services import ServiceTariffIn, CancelIn, VehicleIn
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
    return await _user_full(conn, user_id)


class AdminUserIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    company_name: str | None = Field(None, max_length=200)
    bio: str | None = Field(None, max_length=1000)


class AdminUserCreate(AdminUserIn):
    telegram_id: int | None = Field(None, gt=0)
    login: str | None = Field(None, max_length=40)
    password: str | None = Field(None, max_length=100)


class CredentialsIn(BaseModel):
    login: str | None = Field(None, max_length=40)
    password: str | None = Field(None, max_length=100)  # bo'sh → tasodifiy
    send: bool = True  # Telegram bo'lsa — bot orqali egasiga yuborish


def _phone(v: str | None) -> str | None:
    v = (v or "").strip()
    if not v:
        return None
    digits = "".join(c for c in v if c.isdigit())
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) < 9:
        raise HTTPException(422, "Telefon raqami noto'g'ri")
    return "+" + digits


async def _user_full(conn: asyncpg.Connection, user_id: int) -> dict:
    row = await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
    if not row:
        raise HTTPException(404, "Topilmadi")
    vehicles = await conn.fetch("SELECT * FROM vehicles WHERE owner_id=$1 ORDER BY id", user_id)
    docs = await conn.fetch("SELECT * FROM user_documents WHERE user_id=$1 ORDER BY id DESC", user_id)
    reviews = await conn.fetch(
        "SELECT * FROM reviews WHERE target_user_id=$1 ORDER BY created_at DESC LIMIT 20", user_id
    )
    by_vehicle: dict = {}
    for d in docs:
        by_vehicle.setdefault(d["vehicle_id"], []).append(doc_out(d))
    out_vehicles = [{**row_to_dict(v), "documents": by_vehicle.get(v["id"], []),
                     "missing_docs": await missing_docs(conn, dict(v))} for v in vehicles]
    return {**row_to_dict(row), "has_password": row["password_hash"] is not None,
            "has_telegram": row["telegram_id"] > 0,
            "vehicles": out_vehicles, "documents": [doc_out(d) for d in docs],
            "reviews": [dict(r) for r in reviews]}


@router.post("/users", status_code=201)
async def create_user(body: AdminUserCreate, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    """Admin ijrochi qo'shadi. Telegram ID'siz bo'lsa — faqat login/parol bilan kiradi (telegram_id manfiy)."""
    import secrets as _s
    phone = _phone(body.phone)
    tg = body.telegram_id
    if tg and await conn.fetchval("SELECT 1 FROM users WHERE telegram_id=$1", tg):
        raise HTTPException(409, "Bu Telegram ID bilan foydalanuvchi bor")
    if phone and await conn.fetchval("SELECT 1 FROM users WHERE phone=$1", phone):
        raise HTTPException(409, "Bu telefon raqami bilan foydalanuvchi bor")
    async with conn.transaction():
        row = await conn.fetchrow(
            """INSERT INTO users(telegram_id, first_name, last_name, phone, phone_verified, company_name, bio)
               VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id""",
            tg or -(10**12 + _s.randbelow(10**12)), body.first_name.strip(), body.last_name, phone, phone is not None,
            body.company_name, body.bio,
        )
        try:
            login, password = await credentials.set_credentials(conn, row["id"], body.login, body.password)
        except ValueError as e:
            raise HTTPException(422, str(e))
    sent = await credentials.send_credentials(tg, login, password, first=True) if tg else False
    return {**await _user_full(conn, row["id"]), "credentials": {"login": login, "password": password, "sent": sent}}


@router.put("/users/{user_id}")
async def update_user(user_id: int, body: AdminUserIn, admin=Depends(get_admin_user),
                      conn: asyncpg.Connection = Depends(get_db)):
    phone = _phone(body.phone)
    if phone and await conn.fetchval("SELECT 1 FROM users WHERE phone=$1 AND id<>$2", phone, user_id):
        raise HTTPException(409, "Bu telefon raqami boshqa foydalanuvchida")
    old = await conn.fetchrow("SELECT phone, phone_verified FROM users WHERE id=$1", user_id)
    if not old:
        raise HTTPException(404, "Topilmadi")
    # Admin kiritgan raqam tasdiqlangan hisoblanadi; o'zgarmagan bo'lsa — avvalgi holat saqlanadi
    verified = old["phone_verified"] if phone == old["phone"] else phone is not None
    await conn.execute(
        """UPDATE users SET first_name=$2, last_name=$3, phone=$4, phone_verified=$5, company_name=$6, bio=$7,
               updated_at=NOW() WHERE id=$1""",
        user_id, body.first_name.strip(), body.last_name, phone, verified, body.company_name, body.bio,
    )
    await conn.execute("UPDATE drivers SET phone=$2 WHERE user_id=$1", user_id, phone or "")
    return await _user_full(conn, user_id)


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    from app.services.app_auth import revoke_user
    if not await conn.fetchval("SELECT 1 FROM users WHERE id=$1", user_id):
        raise HTTPException(404, "Topilmadi")
    busy = await conn.fetchval(
        """SELECT (SELECT COUNT(*) FROM orders o JOIN drivers d ON d.id=o.driver_id
                   WHERE d.user_id=$1 AND o.status IN ('accepted','driver_arrived','in_progress'))
             + (SELECT COUNT(*) FROM service_requests WHERE provider_id=$1 AND status IN ('assigned','in_progress'))""",
        user_id)
    if busy:
        raise HTTPException(409, "Foydalanuvchining faol ishi bor — avval yakunlansin yoki bekor qilinsin")
    await revoke_user(conn, user_id)
    try:
        async with conn.transaction():
            await conn.execute("DELETE FROM drivers WHERE user_id=$1 AND NOT EXISTS "
                               "(SELECT 1 FROM orders o WHERE o.driver_id=drivers.id)", user_id)
            await conn.execute("DELETE FROM users WHERE id=$1", user_id)
    except asyncpg.ForeignKeyViolationError:
        raise HTTPException(409, "Foydalanuvchining buyurtma yoki to'lov tarixi bor — o'chirib bo'lmaydi, bloklang")
    return {"success": True}


@router.post("/users/{user_id}/credentials")
async def set_user_credentials(user_id: int, body: CredentialsIn, admin=Depends(get_admin_user),
                               conn: asyncpg.Connection = Depends(get_db)):
    """Login/parolni o'rnatadi yoki tiklaydi. Parol javobda bir marta ko'rsatiladi (bazada faqat xesh)."""
    tg = await conn.fetchval("SELECT telegram_id FROM users WHERE id=$1", user_id)
    if tg is None:
        raise HTTPException(404, "Topilmadi")
    try:
        login, password = await credentials.set_credentials(conn, user_id, body.login, body.password)
    except ValueError as e:
        raise HTTPException(422, str(e))
    sent = await credentials.send_credentials(tg, login, password) if body.send else False
    return {"login": login, "password": password, "sent": sent}


@router.put("/users/{user_id}/block")
async def block_user(user_id: int, body: CancelIn | None = None, admin=Depends(get_admin_user),
                     conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE users SET is_blocked=true, updated_at=NOW() WHERE id=$1", user_id)
    from app.services.app_auth import revoke_user
    await revoke_user(conn, user_id)  # Android ilovadagi sessiyalar darhol yopiladi
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
    rows = [{**row_to_dict(r), "documents": docs_out(r["documents"]), "missing_docs": await missing_docs(conn, dict(r))}
            for r in rows]
    return {"vehicles": rows_to_list(rows), "total": total, "page": page}


@router.put("/vehicles/{vehicle_id}/approve")
async def approve_vehicle(vehicle_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    current = await conn.fetchrow("SELECT * FROM vehicles WHERE id=$1", vehicle_id)
    if not current:
        raise HTTPException(404, "Topilmadi")
    missing = await missing_docs(conn, dict(current))
    if missing:
        raise HTTPException(400, "Hujjatlar yetishmaydi: " + ", ".join(m["name"] for m in missing))
    row = await conn.fetchrow(
        "UPDATE vehicles SET status='approved', reject_reason=NULL, updated_at=NOW() WHERE id=$1 RETURNING *",
        vehicle_id,
    )
    if not row:
        raise HTTPException(404, "Topilmadi")
    await conn.execute("UPDATE user_documents SET status='approved' WHERE vehicle_id=$1 AND status='pending'",
                       vehicle_id)
    await sync_roles(conn, row["owner_id"])
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
    await sync_roles(conn, row["owner_id"])
    await notify(row["owner_id"], "vehicle_status", "❌ Transport rad etildi",
                 f"{row['model']}: {reason}", {"vehicle_id": vehicle_id, "status": "rejected"},
                 event="vehicle:status", link="/vehicles")
    return row_to_dict(row)


# Admin ijrochi nomidan transport va hujjatlarni boshqaradi (egasi ilovada hujjat yuklay olmasa ham)
async def _vehicle(conn: asyncpg.Connection, vehicle_id: int) -> asyncpg.Record:
    row = await conn.fetchrow("SELECT * FROM vehicles WHERE id=$1", vehicle_id)
    if not row:
        raise HTTPException(404, "Transport topilmadi")
    return row


def _vehicle_data(body: VehicleIn) -> dict:
    data = body.model_dump()
    if data.get("plate_number"):
        data["plate_number"] = data["plate_number"].upper().replace(" ", "")
    return data


@router.post("/users/{user_id}/vehicles", status_code=201)
async def admin_create_vehicle(user_id: int, body: VehicleIn, admin=Depends(get_admin_user),
                               conn: asyncpg.Connection = Depends(get_db)):
    if not await conn.fetchval("SELECT 1 FROM users WHERE id=$1", user_id):
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    data = _vehicle_data(body)
    cols = ", ".join(data)
    params = ", ".join(f"${i + 2}" for i in range(len(data)))
    row = await conn.fetchrow(
        f"INSERT INTO vehicles(owner_id, {cols}) VALUES($1, {params}) RETURNING *", user_id, *data.values()
    )
    await sync_roles(conn, user_id)
    return row_to_dict(row)


@router.put("/vehicles/{vehicle_id}")
async def admin_update_vehicle(vehicle_id: int, body: VehicleIn, admin=Depends(get_admin_user),
                               conn: asyncpg.Connection = Depends(get_db)):
    old = await _vehicle(conn, vehicle_id)
    data = _vehicle_data(body)
    sets = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(data))
    row = await conn.fetchrow(
        f"UPDATE vehicles SET {sets}, updated_at=NOW() WHERE id=$1 RETURNING *", vehicle_id, *data.values()
    )
    await sync_roles(conn, old["owner_id"])
    return row_to_dict(row)


@router.delete("/vehicles/{vehicle_id}")
async def admin_delete_vehicle(vehicle_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    v = await _vehicle(conn, vehicle_id)
    busy = await conn.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE vehicle_id=$1 AND status IN ('assigned','in_progress')",
        vehicle_id,
    )
    if busy:
        raise HTTPException(409, "Transport faol ishda ishlatilmoqda")
    await conn.execute("DELETE FROM vehicles WHERE id=$1", vehicle_id)
    await sync_roles(conn, v["owner_id"])
    return {"success": True}


@router.post("/vehicles/{vehicle_id}/documents", status_code=201)
async def admin_upload_document(vehicle_id: int, doc_type: str = Form(...), file: UploadFile = File(...),
                                admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    """Admin yuklagan hujjat darhol tasdiqlangan hisoblanadi (admin o'zi ko'rib yuklaydi)."""
    v = await _vehicle(conn, vehicle_id)
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Noma'lum hujjat turi")
    url = await save_private_document(file, f"doc{v['owner_id']}_{doc_type}")
    row = await conn.fetchrow(
        """INSERT INTO user_documents(user_id, vehicle_id, doc_type, file_url, status)
           VALUES($1,$2,$3,$4,'approved') RETURNING *""",
        v["owner_id"], vehicle_id, doc_type, url,
    )
    return doc_out(row)


@router.delete("/documents/{doc_id}")
async def admin_delete_document(doc_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    from app.services.files import delete_private_document
    row = await conn.fetchrow("DELETE FROM user_documents WHERE id=$1 RETURNING file_url", doc_id)
    if not row:
        raise HTTPException(404, "Topilmadi")
    delete_private_document(row["file_url"])
    return {"success": True}


@router.post("/vehicles/{vehicle_id}/photo")
async def admin_upload_photo(vehicle_id: int, file: UploadFile = File(...), admin=Depends(get_admin_user),
                             conn: asyncpg.Connection = Depends(get_db)):
    await _vehicle(conn, vehicle_id)
    url = await save_public_image(file, f"vehicle{vehicle_id}")
    row = await conn.fetchrow("UPDATE vehicles SET photo_url=$2, updated_at=NOW() WHERE id=$1 RETURNING *",
                              vehicle_id, url)
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


# ── Mashhur joylar (qidiruvda Yandex'dan oldin chiqadi) ─────────────────────
class PlaceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = Field(None, max_length=300)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


@router.get("/places")
async def list_places(admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    return rows_to_list(await conn.fetch("SELECT * FROM popular_places ORDER BY name"))


@router.post("/places", status_code=201)
async def create_place(body: PlaceIn, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "INSERT INTO popular_places(name, address, lat, lng) VALUES($1,$2,$3,$4) RETURNING *",
        body.name.strip(), body.address, body.lat, body.lng,
    )
    return row_to_dict(row)


@router.delete("/places/{place_id}")
async def delete_place(place_id: int, admin=Depends(get_admin_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("DELETE FROM popular_places WHERE id=$1", place_id)
    return {"success": True}


# ── Admin harakatlari jurnali ───────────────────────────────────────────────
@router.get("/audit")
async def audit_log(page: int = 1, limit: int = Query(50, le=200), admin=Depends(get_admin_user),
                    conn: asyncpg.Connection = Depends(get_db)):
    lim, off = _page(page, limit)
    rows = await conn.fetch("SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT $1 OFFSET $2", lim, off)
    total = await conn.fetchval("SELECT COUNT(*) FROM admin_audit")
    return {"items": rows_to_list(rows), "total": total, "page": page}
