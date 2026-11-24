"""Yuk tashish va Spets texnika — umumiy biznes jarayoni.

Mijoz so'rov yaratadi → tizim mos ijrochilarni topadi va xabar beradi (smart matching) →
ijrochilar narx/vaqt taklif qiladi → mijoz eng mos taklifni tanlaydi →
ijrochi ishni boshlaydi → yakunlanadi → o'zaro baho.
"""
import asyncio

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.catalog import VEHICLE_CATEGORIES
from app.database import get_db
from app.deps import current_user
from app.schemas.services import RequestIn, OfferIn, CancelIn
from app.services import service_pricing, smart_match
from app.services.notify import notify
from app.services.yandex_service import get_route
from app.utils import row_to_dict, rows_to_list, to_local_naive

router = APIRouter(tags=["service-requests"])

SERVICE_NAMES = {"cargo": "Yuk tashish", "equipment": "Spets texnika"}
REQ_SELECT = """
SELECT r.*, u.first_name AS client_name, u.rating AS client_rating,
       p.first_name AS provider_name, p.provider_rating AS provider_rating,
       v.model AS vehicle_model, v.plate_number AS vehicle_plate, v.category AS assigned_vehicle_category
FROM service_requests r
JOIN users u ON u.id = r.client_id
LEFT JOIN users p ON p.id = r.provider_id
LEFT JOIN vehicles v ON v.id = r.vehicle_id
"""


def _money(v) -> str:
    return f"{int(float(v)):,}".replace(",", " ") if v is not None else "—"


def _summary(r) -> str:
    cat = VEHICLE_CATEGORIES.get(r.get("vehicle_category") or "", {}).get("name")
    parts = [r.get("title") or SERVICE_NAMES.get(r["service_type"], "")]
    if cat:
        parts.append(cat)
    parts.append(f"📍 {r['from_address']}")
    if r.get("to_address"):
        parts.append(f"🏁 {r['to_address']}")
    if r.get("budget"):
        parts.append(f"💰 byudjet: {_money(r['budget'])} so'm")
    return "\n".join(parts)


async def _get_request(conn, request_id: int):
    row = await conn.fetchrow(f"{REQ_SELECT} WHERE r.id=$1", request_id)
    if not row:
        raise HTTPException(404, "So'rov topilmadi")
    return row


async def _dispatch(request: dict) -> None:
    """Mos ijrochilarga real vaqtda va Telegram orqali xabar berish."""
    from app.database import pool
    async with pool.acquire() as conn:
        providers = await smart_match.find_providers(conn, request, limit=25)
    for p in providers:
        await notify(
            p["owner_id"], "request_new", f"🔔 Yangi {SERVICE_NAMES[request['service_type']].lower()} so'rovi",
            _summary(request) + f"\n\nMoslik: {p['score']}/100",
            {"request_id": request["id"], "service_type": request["service_type"], "score": p["score"]},
            event="request:new", link=f"/requests/{request['id']}",
        )


@router.post("/requests", status_code=201)
async def create_request(body: RequestIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    active = await conn.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE client_id=$1 AND status IN ('open','assigned','in_progress')",
        user["id"],
    )
    if active >= 10:
        raise HTTPException(429, "Faol so'rovlar soni juda ko'p")
    if body.service_type == "cargo" and not body.to_point:
        raise HTTPException(422, "Yuk tashish uchun manzil (qayerga) majburiy")
    if body.vehicle_category and body.service_type not in VEHICLE_CATEGORIES[body.vehicle_category]["services"]:
        raise HTTPException(422, "Tanlangan transport bu xizmat uchun mos emas")
    distance_km = None
    if body.to_point:
        route = await get_route(body.from_point.lat, body.from_point.lng, body.to_point.lat, body.to_point.lng)
        distance_km = route["distance_km"]
    est = await service_pricing.estimate(
        conn, body.service_type, body.vehicle_category, distance_km=distance_km,
        duration_value=body.duration_value, duration_unit=body.duration_unit,
    )
    f, t = body.from_point, body.to_point
    row = await conn.fetchrow(
        """INSERT INTO service_requests(service_type, client_id, vehicle_category, title, description, cargo_type,
               weight_kg, volume_m3, work_volume, duration_value, duration_unit,
               from_address, from_lat, from_lng, from_location,
               to_address, to_lat, to_lng, to_location,
               distance_km, scheduled_at, budget, estimated_price, phone)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::float8,$14::float8,
                  ST_MakePoint($14::float8,$13::float8)::geography,
                  $15,$16::float8,$17::float8,
                  CASE WHEN $16::float8 IS NULL THEN NULL ELSE ST_MakePoint($17::float8,$16::float8)::geography END,
                  $18,$19,$20,$21,$22)
           RETURNING *""",
        body.service_type, user["id"], body.vehicle_category, body.title, body.description, body.cargo_type,
        body.weight_kg, body.volume_m3, body.work_volume, body.duration_value, body.duration_unit,
        f.address, f.lat, f.lng,
        t.address if t else None, t.lat if t else None, t.lng if t else None,
        distance_km, to_local_naive(body.scheduled_at), body.budget, est["estimated_price"],
        body.phone or user.get("phone"),
    )
    req = row_to_dict(row)
    matches = await smart_match.find_providers(conn, {**req, "from_lat": f.lat, "from_lng": f.lng}, limit=25)
    asyncio.create_task(_dispatch(req))
    return {**req, "matched_providers": len(matches)}


@router.get("/requests/my")
async def my_requests(status: str | None = None, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    args = [user["id"]]
    cond = "r.client_id=$1"
    if status:
        args.append(status)
        cond += " AND r.status=$2"
    rows = await conn.fetch(
        f"""{REQ_SELECT} WHERE {cond}
            ORDER BY (r.status IN ('open','assigned','in_progress')) DESC, r.created_at DESC LIMIT 100""",
        *args,
    )
    return rows_to_list(rows)


@router.get("/requests/feed")
async def provider_feed(service: str | None = Query(None), user=Depends(current_user),
                        conn: asyncpg.Connection = Depends(get_db)):
    """Ijrochiga mos ochiq so'rovlar (transport kategoriyasi va masofa bo'yicha)."""
    vehicles = await smart_match.provider_vehicles(conn, user["id"])
    items = await smart_match.feed_for_provider(conn, user["id"], service)
    return {"vehicles": vehicles, "requests": items,
            "hint": None if vehicles else "So'rovlarni ko'rish uchun tasdiqlangan transport qo'shing"}


@router.get("/requests/jobs")
async def provider_jobs(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Ijrochining ishlari: tanlangan va yakunlangan so'rovlar + kutilayotgan takliflar."""
    jobs = await conn.fetch(
        f"""{REQ_SELECT} WHERE r.provider_id=$1
            ORDER BY (r.status IN ('assigned','in_progress')) DESC, r.updated_at DESC LIMIT 100""",
        user["id"],
    )
    offers = await conn.fetch(
        """SELECT o.*, r.service_type, r.title, r.from_address, r.to_address, r.status AS request_status,
                  r.scheduled_at, r.vehicle_category
           FROM offers o JOIN service_requests r ON r.id=o.request_id
           WHERE o.provider_id=$1 AND o.status='pending' ORDER BY o.created_at DESC""",
        user["id"],
    )
    return {"jobs": rows_to_list(jobs), "pending_offers": [dict(o) for o in offers]}


@router.get("/requests/{request_id}")
async def get_request(request_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    req = row_to_dict(await _get_request(conn, request_id))
    is_client = req["client_id"] == user["id"]
    is_provider = req["provider_id"] == user["id"]
    req["is_client"] = is_client
    req["is_provider"] = is_provider
    if is_client:
        offers = await conn.fetch(
            """SELECT o.*, u.first_name, u.last_name, u.provider_rating, u.provider_reviews,
                      v.model AS vehicle_model, v.category AS vehicle_category, v.plate_number AS vehicle_plate,
                      v.capacity_kg, v.photo_url AS vehicle_photo,
                      CASE WHEN o.status='accepted' THEN u.phone END AS provider_phone
               FROM offers o JOIN users u ON u.id=o.provider_id LEFT JOIN vehicles v ON v.id=o.vehicle_id
               WHERE o.request_id=$1 AND o.status <> 'withdrawn'
               ORDER BY (o.status='accepted') DESC, o.price ASC""",
            request_id,
        )
        req["offers"] = [dict(o) for o in offers]
        if req["status"] == "open":
            req["suggested_providers"] = [
                {k: p[k] for k in ("owner_id", "first_name", "category", "model", "distance_km", "score",
                                   "reasons", "provider_rating", "expected_price")}
                for p in await smart_match.find_providers(conn, req, limit=5)
            ]
    else:
        my = await conn.fetchrow(
            "SELECT * FROM offers WHERE request_id=$1 AND provider_id=$2", request_id, user["id"]
        )
        req["my_offer"] = dict(my) if my else None
        if not is_provider:
            req.pop("phone", None)
    if is_provider:
        req["client_phone"] = req.get("phone") or await conn.fetchval(
            "SELECT phone FROM users WHERE id=$1", req["client_id"]
        )
    req["reviewed"] = bool(await conn.fetchval(
        "SELECT 1 FROM reviews WHERE service_type=$1 AND ref_id=$2 AND rater_id=$3",
        req["service_type"], request_id, user["id"],
    ))
    return req


@router.post("/requests/{request_id}/offers", status_code=201)
async def make_offer(request_id: int, body: OfferIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    req = await _get_request(conn, request_id)
    if req["status"] != "open":
        raise HTTPException(409, "So'rov takliflar uchun yopiq")
    if req["client_id"] == user["id"]:
        raise HTTPException(400, "O'z so'rovingizga taklif bera olmaysiz")
    v = await conn.fetchrow("SELECT * FROM vehicles WHERE id=$1 AND owner_id=$2", body.vehicle_id, user["id"])
    if not v:
        raise HTTPException(404, "Transport topilmadi")
    if v["status"] != "approved":
        raise HTTPException(403, "Transport hali admin tomonidan tasdiqlanmagan")
    if req["service_type"] not in VEHICLE_CATEGORIES[v["category"]]["services"]:
        raise HTTPException(400, "Bu transport ushbu xizmat uchun mos emas")
    if req["vehicle_category"] and req["vehicle_category"] != v["category"]:
        raise HTTPException(400, f"Mijoz {VEHICLE_CATEGORIES[req['vehicle_category']]['name']} so'ragan")
    existing = await conn.fetchrow(
        "SELECT * FROM offers WHERE request_id=$1 AND provider_id=$2", request_id, user["id"]
    )
    async with conn.transaction():
        if existing:
            if existing["status"] in ("accepted", "rejected"):
                raise HTTPException(409, "Taklifingiz allaqachon ko'rib chiqilgan")
            offer = await conn.fetchrow(
                """UPDATE offers SET vehicle_id=$2, price=$3, available_at=$4, message=$5, status='pending',
                       updated_at=NOW() WHERE id=$1 RETURNING *""",
                existing["id"], body.vehicle_id, body.price, to_local_naive(body.available_at), body.message,
            )
        else:
            offer = await conn.fetchrow(
                """INSERT INTO offers(request_id, provider_id, vehicle_id, price, available_at, message)
                   VALUES($1,$2,$3,$4,$5,$6) RETURNING *""",
                request_id, user["id"], body.vehicle_id, body.price, to_local_naive(body.available_at), body.message,
            )
        await conn.execute(
            """UPDATE service_requests SET offers_count=(SELECT COUNT(*) FROM offers WHERE request_id=$1
                   AND status='pending'), updated_at=NOW() WHERE id=$1""",
            request_id,
        )
    await notify(
        req["client_id"], "offer_new", "💬 Yangi taklif",
        f"{user['first_name']} ({VEHICLE_CATEGORIES[v['category']]['name']} {v['model']}) — {_money(body.price)} so'm"
        + (f"\n{body.message}" if body.message else ""),
        {"request_id": request_id, "offer_id": offer["id"]}, event="offer:new", link=f"/requests/{request_id}",
    )
    return dict(offer)


@router.post("/offers/{offer_id}/withdraw")
async def withdraw_offer(offer_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    offer = await conn.fetchrow(
        "UPDATE offers SET status='withdrawn', updated_at=NOW() WHERE id=$1 AND provider_id=$2 AND status='pending' RETURNING *",
        offer_id, user["id"],
    )
    if not offer:
        raise HTTPException(404, "Faol taklif topilmadi")
    await conn.execute(
        """UPDATE service_requests SET offers_count=(SELECT COUNT(*) FROM offers WHERE request_id=$1
               AND status='pending') WHERE id=$1""",
        offer["request_id"],
    )
    return {"success": True}


@router.post("/requests/{request_id}/offers/{offer_id}/accept")
async def accept_offer(request_id: int, offer_id: int, user=Depends(current_user),
                       conn: asyncpg.Connection = Depends(get_db)):
    req = await _get_request(conn, request_id)
    if req["client_id"] != user["id"]:
        raise HTTPException(403, "Ruxsat yo'q")
    async with conn.transaction():
        offer = await conn.fetchrow(
            "SELECT * FROM offers WHERE id=$1 AND request_id=$2 AND status='pending' FOR UPDATE", offer_id, request_id
        )
        if not offer:
            raise HTTPException(404, "Taklif topilmadi yoki faol emas")
        updated = await conn.fetchrow(
            """UPDATE service_requests SET status='assigned', accepted_offer_id=$2, provider_id=$3, vehicle_id=$4,
                   final_price=$5, assigned_at=NOW(), updated_at=NOW()
               WHERE id=$1 AND status='open' RETURNING id""",
            request_id, offer_id, offer["provider_id"], offer["vehicle_id"], offer["price"],
        )
        if not updated:
            raise HTTPException(409, "So'rov allaqachon band")
        await conn.execute("UPDATE offers SET status='accepted', updated_at=NOW() WHERE id=$1", offer_id)
        losers = await conn.fetch(
            """UPDATE offers SET status='rejected', updated_at=NOW()
               WHERE request_id=$1 AND id<>$2 AND status='pending' RETURNING provider_id""",
            request_id, offer_id,
        )
    client_phone = req["phone"] or user.get("phone") or "—"
    await notify(
        offer["provider_id"], "offer_accepted", "🎉 Taklifingiz qabul qilindi!",
        _summary(dict(req)) + f"\n\nNarx: {_money(offer['price'])} so'm\nMijoz: {user['first_name']}, tel: {client_phone}",
        {"request_id": request_id, "offer_id": offer_id}, event="offer:accepted", link=f"/requests/{request_id}",
    )
    for l in losers:
        await notify(
            l["provider_id"], "offer_rejected", "Taklif tanlanmadi",
            f"Mijoz boshqa taklifni tanladi: {req['title'] or SERVICE_NAMES[req['service_type']]}",
            {"request_id": request_id}, event="offer:rejected", telegram=False,
        )
    return await get_request(request_id, user, conn)


@router.post("/requests/{request_id}/start")
async def start_job(request_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        """UPDATE service_requests SET status='in_progress', started_at=NOW(), updated_at=NOW()
           WHERE id=$1 AND provider_id=$2 AND status='assigned' RETURNING *""",
        request_id, user["id"],
    )
    if not row:
        raise HTTPException(409, "Ishni boshlab bo'lmaydi")
    if row["vehicle_id"]:
        await conn.execute("UPDATE vehicles SET is_available=false WHERE id=$1", row["vehicle_id"])
    await notify(row["client_id"], "request_status", "🚀 Ish boshlandi",
                 f"{user['first_name']} ishni boshladi: {row['title'] or SERVICE_NAMES[row['service_type']]}",
                 {"request_id": request_id, "status": "in_progress"}, event="request:status",
                 link=f"/requests/{request_id}")
    return row_to_dict(row)


@router.post("/requests/{request_id}/complete")
async def complete_job(request_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        """UPDATE service_requests SET status='completed', completed_at=NOW(), updated_at=NOW()
           WHERE id=$1 AND (provider_id=$2 OR client_id=$2) AND status IN ('assigned','in_progress') RETURNING *""",
        request_id, user["id"],
    )
    if not row:
        raise HTTPException(409, "Ishni yakunlab bo'lmaydi")
    if row["vehicle_id"]:
        await conn.execute("UPDATE vehicles SET is_available=true WHERE id=$1", row["vehicle_id"])
    other = row["client_id"] if user["id"] == row["provider_id"] else row["provider_id"]
    await notify(other, "request_status", "✅ Ish yakunlandi",
                 f"{row['title'] or SERVICE_NAMES[row['service_type']]} yakunlandi. Iltimos, baho qoldiring!",
                 {"request_id": request_id, "status": "completed"}, event="request:status",
                 link=f"/requests/{request_id}")
    return row_to_dict(row)


@router.post("/requests/{request_id}/cancel")
async def cancel_request(request_id: int, body: CancelIn | None = None, user=Depends(current_user),
                         conn: asyncpg.Connection = Depends(get_db)):
    req = await _get_request(conn, request_id)
    reason = (body.reason if body else None) or "Sabab ko'rsatilmagan"
    if req["client_id"] == user["id"]:
        if req["status"] not in ("open", "assigned"):
            raise HTTPException(409, "So'rovni bekor qilib bo'lmaydi")
        async with conn.transaction():
            await conn.execute(
                """UPDATE service_requests SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2,
                       updated_at=NOW() WHERE id=$1""",
                request_id, reason,
            )
            offerers = await conn.fetch(
                """UPDATE offers SET status='rejected', updated_at=NOW()
                   WHERE request_id=$1 AND status IN ('pending','accepted') RETURNING provider_id""",
                request_id,
            )
        for o in offerers:
            await notify(o["provider_id"], "request_status", "❌ So'rov bekor qilindi",
                         f"{req['title'] or SERVICE_NAMES[req['service_type']]}\nSabab: {reason}",
                         {"request_id": request_id, "status": "cancelled"}, event="request:status")
        return {"success": True}

    if req["provider_id"] == user["id"] and req["status"] == "assigned":
        # Ijrochi voz kechsa — so'rov qayta ochiladi
        async with conn.transaction():
            await conn.execute(
                """UPDATE service_requests SET status='open', provider_id=NULL, vehicle_id=NULL,
                       accepted_offer_id=NULL, final_price=NULL, assigned_at=NULL, updated_at=NOW() WHERE id=$1""",
                request_id,
            )
            await conn.execute(
                "UPDATE offers SET status='withdrawn', updated_at=NOW() WHERE request_id=$1 AND provider_id=$2",
                request_id, user["id"],
            )
        await notify(req["client_id"], "request_status", "⚠️ Ijrochi voz kechdi",
                     f"{user['first_name']} ishdan voz kechdi. So'rovingiz yana ochiq — boshqa taklifni tanlang.\n"
                     f"Sabab: {reason}",
                     {"request_id": request_id, "status": "open"}, event="request:status",
                     link=f"/requests/{request_id}")
        asyncio.create_task(_dispatch(dict(req)))
        return {"success": True, "reopened": True}
    raise HTTPException(403, "Ruxsat yo'q")


@router.get("/requests/{request_id}/matches")
async def request_matches(request_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Smart matching natijasi — mijoz uchun eng mos ijrochilar."""
    req = row_to_dict(await _get_request(conn, request_id))
    if req["client_id"] != user["id"]:
        raise HTTPException(403, "Ruxsat yo'q")
    providers = await smart_match.find_providers(conn, req, limit=20)
    return [{k: v for k, v in p.items() if k not in ("telegram_id",)} for p in providers]
