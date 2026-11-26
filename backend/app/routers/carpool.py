"""Po'puti / Kunlik yo'nalish (ishchi qatnov).

Oqim: haydovchi qatnov e'lon qiladi → mijoz qidiradi va joy bron qiladi →
haydovchi tasdiqlaydi → qatnov jo'naydi → yakunlanadi → o'zaro baho.
"""
from datetime import date, datetime, timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.catalog import CARPOOL_MATCH_RADIUS_KM, VEHICLE_CATEGORIES
from app.database import get_db
from app.deps import current_user
from app.schemas.services import TripIn, TripStatus, BookingIn, CancelIn
from app.services.notify import notify, notify_many
from app.services.yandex_service import get_route
from app.services import service_pricing
from app.utils import row_to_dict, rows_to_list, to_local_naive, local_now, LOCAL_NOW_SQL

router = APIRouter(prefix="/carpool", tags=["carpool"])

TRIP_SELECT = """
SELECT t.*, u.first_name AS driver_name, u.last_name AS driver_last_name,
       u.provider_rating AS driver_rating, u.provider_reviews AS driver_reviews,
       v.model AS vehicle_model, v.color AS vehicle_color, v.plate_number AS vehicle_plate,
       v.category AS vehicle_category, v.photo_url AS vehicle_photo
FROM carpool_trips t
JOIN users u ON u.id = t.driver_id
LEFT JOIN vehicles v ON v.id = t.vehicle_id
"""


def _fmt_price(v) -> str:
    return f"{int(float(v)):,}".replace(",", " ")


async def _trip(conn: asyncpg.Connection, trip_id: int) -> asyncpg.Record:
    row = await conn.fetchrow(f"{TRIP_SELECT} WHERE t.id=$1", trip_id)
    if not row:
        raise HTTPException(404, "Qatnov topilmadi")
    return row


@router.post("/trips", status_code=201)
async def create_trip(body: TripIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    departure = to_local_naive(body.departure_at)
    if departure < local_now() - timedelta(minutes=5):
        raise HTTPException(400, "Jo'nash vaqti o'tib ketgan")
    # Qatnov faqat admin tasdiqlagan transport bilan ochiladi
    if not body.vehicle_id:
        raise HTTPException(400, "Qatnov uchun tasdiqlangan transportingizni tanlang")
    if body.vehicle_id:
        v = await conn.fetchrow(
            "SELECT * FROM vehicles WHERE id=$1 AND owner_id=$2", body.vehicle_id, user["id"]
        )
        if not v:
            raise HTTPException(404, "Transport topilmadi")
        if v["status"] != "approved":
            raise HTTPException(403, "Transport hali admin tomonidan tasdiqlanmagan")
        if "carpool" not in VEHICLE_CATEGORIES[v["category"]]["services"]:
            raise HTTPException(400, "Bu transport po'puti uchun mos emas")
        if v["seats"] and body.seats_total > v["seats"]:
            raise HTTPException(400, f"Transportda {v['seats']} ta o'rin bor")
    f, t = body.from_point, body.to_point
    row = await conn.fetchrow(
        """INSERT INTO carpool_trips(driver_id, vehicle_id, from_address, from_lat, from_lng, from_location,
               to_address, to_lat, to_lng, to_location, departure_at, seats_total, seats_available,
               price_per_seat, recurring_days, allow_parcels, note)
           VALUES($1,$2,$3,$4::float8,$5::float8,ST_MakePoint($5::float8,$4::float8)::geography,
                  $6,$7::float8,$8::float8,ST_MakePoint($8::float8,$7::float8)::geography,
                  $9,$10,$10,$11,$12::smallint[],$13,$14) RETURNING id""",
        user["id"], body.vehicle_id, f.address, f.lat, f.lng, t.address, t.lat, t.lng,
        departure, body.seats_total, body.price_per_seat, body.recurring_days, body.allow_parcels, body.note,
    )
    return row_to_dict(await _trip(conn, row["id"]))


@router.get("/trips/search")
async def search_trips(
    from_lat: float | None = None, from_lng: float | None = None,
    to_lat: float | None = None, to_lng: float | None = None,
    q: str | None = Query(None, max_length=100),
    day: date | None = Query(None, alias="date"),
    seats: int = Query(1, ge=1, le=50),
    max_price: float | None = None,
    radius_km: float = Query(CARPOOL_MATCH_RADIUS_KM, gt=0, le=100),
    user=Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    """Yo'nalish bo'yicha qatnovlar: boshlanish va manzil nuqtalariga yaqinlik + sana + bo'sh o'rin."""
    args: list = [seats]
    cond = ["t.status='active'", "t.seats_available >= $1", f"t.departure_at >= {LOCAL_NOW_SQL} - INTERVAL '30 minutes'"]
    dist_from = dist_to = "NULL::float"
    if from_lat is not None and from_lng is not None:
        args += [from_lat, from_lng, radius_km * 1000]
        a, b, r = len(args) - 2, len(args) - 1, len(args)
        cond.append(f"ST_DWithin(t.from_location, ST_MakePoint(${b},${a})::geography, ${r})")
        dist_from = f"ST_Distance(t.from_location, ST_MakePoint(${b},${a})::geography)/1000"
    if to_lat is not None and to_lng is not None:
        args += [to_lat, to_lng, radius_km * 1000]
        a, b, r = len(args) - 2, len(args) - 1, len(args)
        cond.append(f"ST_DWithin(t.to_location, ST_MakePoint(${b},${a})::geography, ${r})")
        dist_to = f"ST_Distance(t.to_location, ST_MakePoint(${b},${a})::geography)/1000"
    if q:
        args.append(f"%{q}%")
        cond.append(f"(t.from_address ILIKE ${len(args)} OR t.to_address ILIKE ${len(args)})")
    if max_price:
        args.append(max_price)
        cond.append(f"t.price_per_seat <= ${len(args)}")
    if day:
        args += [day, (day.isoweekday() - 1)]
        cond.append(f"(t.departure_at::date = ${len(args) - 1} OR ${len(args)}::smallint = ANY(t.recurring_days))")
    rows = await conn.fetch(
        f"""{TRIP_SELECT.replace('SELECT t.*', f'SELECT t.*, {dist_from} AS from_distance_km, {dist_to} AS to_distance_km', 1)}
            WHERE {' AND '.join(cond)}
            ORDER BY t.departure_at ASC LIMIT 50""",
        *args,
    )
    trips = rows_to_list(rows)
    for tr in trips:
        dist = (tr["from_distance_km"] or 0) + (tr["to_distance_km"] or 0)
        rating = float(tr["driver_rating"] or 5)
        tr["match_score"] = round(max(0.0, 60 * (1 - dist / (2 * radius_km))) + 40 * (rating - 1) / 4, 1)
    if from_lat is not None or to_lat is not None:
        trips.sort(key=lambda x: (-x["match_score"], x["departure_at"]))
    return trips


@router.get("/trips/my")
async def my_trips(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        f"""{TRIP_SELECT} WHERE t.driver_id=$1
            ORDER BY (t.status IN ('active','full','departed')) DESC, t.departure_at DESC LIMIT 100""",
        user["id"],
    )
    pend = await conn.fetch(
        """SELECT trip_id, COUNT(*) AS c FROM carpool_bookings b JOIN carpool_trips t ON t.id=b.trip_id
           WHERE t.driver_id=$1 AND b.status='pending' GROUP BY trip_id""",
        user["id"],
    )
    pmap = {p["trip_id"]: p["c"] for p in pend}
    return [{**row_to_dict(r), "pending_bookings": pmap.get(r["id"], 0)} for r in rows]


@router.get("/trips/{trip_id}")
async def get_trip(trip_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    trip = row_to_dict(await _trip(conn, trip_id))
    if trip["driver_id"] == user["id"]:
        bookings = await conn.fetch(
            """SELECT b.*, u.first_name, u.last_name, u.rating AS passenger_rating,
                      COALESCE(b.phone, u.phone) AS contact_phone
               FROM carpool_bookings b JOIN users u ON u.id=b.passenger_id
               WHERE b.trip_id=$1 ORDER BY b.created_at""",
            trip_id,
        )
        trip["bookings"] = [dict(b) for b in bookings]
        trip["is_owner"] = True
    else:
        my = await conn.fetchrow(
            "SELECT * FROM carpool_bookings WHERE trip_id=$1 AND passenger_id=$2 ORDER BY id DESC LIMIT 1",
            trip_id, user["id"],
        )
        trip["my_booking"] = dict(my) if my else None
        trip["is_owner"] = False
        if my and my["status"] in ("confirmed", "completed"):
            trip["driver_phone"] = await conn.fetchval("SELECT phone FROM users WHERE id=$1", trip["driver_id"])
    return trip


@router.put("/trips/{trip_id}/status")
async def update_trip_status(trip_id: int, body: TripStatus, user=Depends(current_user),
                             conn: asyncpg.Connection = Depends(get_db)):
    trip = await _trip(conn, trip_id)
    if trip["driver_id"] != user["id"]:
        raise HTTPException(403, "Bu sizning qatnovingiz emas")
    allowed = {
        "active": {"departed", "completed", "cancelled"},
        "full": {"departed", "completed", "cancelled", "active"},
        "departed": {"completed"},
    }
    if body.status not in allowed.get(trip["status"], set()):
        raise HTTPException(409, f"'{trip['status']}' holatidan '{body.status}' ga o'tib bo'lmaydi")
    async with conn.transaction():
        await conn.execute(
            "UPDATE carpool_trips SET status=$2, updated_at=NOW() WHERE id=$1", trip_id, body.status
        )
        if body.status == "cancelled":
            affected = await conn.fetch(
                """UPDATE carpool_bookings SET status='cancelled', updated_at=NOW()
                   WHERE trip_id=$1 AND status IN ('pending','confirmed') RETURNING passenger_id""",
                trip_id,
            )
        elif body.status == "completed":
            affected = await conn.fetch(
                """UPDATE carpool_bookings SET status='completed', updated_at=NOW()
                   WHERE trip_id=$1 AND status='confirmed' RETURNING passenger_id""",
                trip_id,
            )
            await conn.execute(
                "UPDATE carpool_bookings SET status='rejected', updated_at=NOW() WHERE trip_id=$1 AND status='pending'",
                trip_id,
            )
        else:
            affected = await conn.fetch(
                "SELECT passenger_id FROM carpool_bookings WHERE trip_id=$1 AND status='confirmed'", trip_id
            )
    route = f"{trip['from_address']} → {trip['to_address']}"
    messages = {
        "cancelled": ("❌ Qatnov bekor qilindi", f"{route} qatnovi haydovchi tomonidan bekor qilindi."),
        "departed": ("🚐 Qatnov yo'lga chiqdi", f"{route} qatnovi jo'nadi."),
        "completed": ("✅ Qatnov yakunlandi", f"{route} qatnovi yakunlandi. Haydovchini baholang!"),
        "active": ("ℹ️ Qatnov faollashtirildi", route),
    }
    title, msg = messages[body.status]
    await notify_many([a["passenger_id"] for a in affected], "carpool_trip", title, msg,
                      {"trip_id": trip_id, "status": body.status}, event="carpool:trip_status",
                      link="/carpool/bookings")
    return row_to_dict(await _trip(conn, trip_id))


@router.post("/trips/{trip_id}/book", status_code=201)
async def book_trip(trip_id: int, body: BookingIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    trip = await _trip(conn, trip_id)
    if trip["driver_id"] == user["id"]:
        raise HTTPException(400, "O'z qatnovingizni bron qila olmaysiz")
    if trip["status"] != "active":
        raise HTTPException(409, "Qatnov bron uchun ochiq emas")
    if trip["seats_available"] < body.seats:
        raise HTTPException(409, f"Faqat {trip['seats_available']} ta bo'sh o'rin qoldi")
    existing = await conn.fetchval(
        "SELECT id FROM carpool_bookings WHERE trip_id=$1 AND passenger_id=$2 AND status IN ('pending','confirmed')",
        trip_id, user["id"],
    )
    if existing:
        raise HTTPException(409, "Siz bu qatnovni allaqachon bron qilgansiz")
    row = await conn.fetchrow(
        """INSERT INTO carpool_bookings(trip_id, passenger_id, seats, pickup_note, phone, is_subscription)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING *""",
        trip_id, user["id"], body.seats, body.pickup_note, body.phone or user.get("phone"), body.is_subscription,
    )
    await notify(
        trip["driver_id"], "carpool_booking", "🙋 Yangi bron so'rovi",
        f"{user['first_name']} {body.seats} ta o'rin bron qilmoqchi.\n"
        f"{trip['from_address']} → {trip['to_address']}\n"
        f"Jami: {_fmt_price(float(trip['price_per_seat']) * body.seats)} so'm",
        {"trip_id": trip_id, "booking_id": row["id"]}, event="carpool:booking_new", link=f"/carpool/trips/{trip_id}",
    )
    return dict(row)


async def _driver_booking(conn, booking_id: int, user_id: int):
    row = await conn.fetchrow(
        """SELECT b.*, t.driver_id, t.from_address, t.to_address, t.seats_available, t.status AS trip_status
           FROM carpool_bookings b JOIN carpool_trips t ON t.id=b.trip_id WHERE b.id=$1""",
        booking_id,
    )
    if not row:
        raise HTTPException(404, "Bron topilmadi")
    if row["driver_id"] != user_id:
        raise HTTPException(403, "Ruxsat yo'q")
    return row


@router.post("/bookings/{booking_id}/confirm")
async def confirm_booking(booking_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    b = await _driver_booking(conn, booking_id, user["id"])
    if b["status"] != "pending":
        raise HTTPException(409, "Bron allaqachon ko'rib chiqilgan")
    async with conn.transaction():
        trip = await conn.fetchrow(
            """UPDATE carpool_trips SET seats_available = seats_available - $2,
                   status = CASE WHEN seats_available - $2 = 0 THEN 'full' ELSE status END, updated_at=NOW()
               WHERE id=$1 AND seats_available >= $2 AND status IN ('active') RETURNING *""",
            b["trip_id"], b["seats"],
        )
        if not trip:
            raise HTTPException(409, "Bo'sh o'rin yetarli emas")
        await conn.execute(
            "UPDATE carpool_bookings SET status='confirmed', updated_at=NOW() WHERE id=$1", booking_id
        )
    driver_phone = user.get("phone") or "—"
    await notify(
        b["passenger_id"], "carpool_booking", "✅ Bron tasdiqlandi",
        f"{b['from_address']} → {b['to_address']}\nHaydovchi: {user['first_name']}, tel: {driver_phone}",
        {"trip_id": b["trip_id"], "booking_id": booking_id, "status": "confirmed"},
        event="carpool:booking_updated", link=f"/carpool/trips/{b['trip_id']}",
    )
    return {"success": True, "seats_available": trip["seats_available"]}


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(booking_id: int, body: CancelIn | None = None, user=Depends(current_user),
                         conn: asyncpg.Connection = Depends(get_db)):
    b = await _driver_booking(conn, booking_id, user["id"])
    if b["status"] not in ("pending", "confirmed"):
        raise HTTPException(409, "Bronni rad etib bo'lmaydi")
    async with conn.transaction():
        await conn.execute("UPDATE carpool_bookings SET status='rejected', updated_at=NOW() WHERE id=$1", booking_id)
        if b["status"] == "confirmed":
            await conn.execute(
                """UPDATE carpool_trips SET seats_available=seats_available+$2,
                       status=CASE WHEN status='full' THEN 'active' ELSE status END WHERE id=$1""",
                b["trip_id"], b["seats"],
            )
    reason = (body.reason if body else None) or "Haydovchi rad etdi"
    await notify(
        b["passenger_id"], "carpool_booking", "❌ Bron rad etildi",
        f"{b['from_address']} → {b['to_address']}\nSabab: {reason}",
        {"trip_id": b["trip_id"], "booking_id": booking_id, "status": "rejected"},
        event="carpool:booking_updated", link="/carpool",
    )
    return {"success": True}


@router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    b = await conn.fetchrow(
        """SELECT b.*, t.driver_id, t.from_address, t.to_address FROM carpool_bookings b
           JOIN carpool_trips t ON t.id=b.trip_id WHERE b.id=$1 AND b.passenger_id=$2""",
        booking_id, user["id"],
    )
    if not b:
        raise HTTPException(404, "Bron topilmadi")
    if b["status"] not in ("pending", "confirmed"):
        raise HTTPException(409, "Bronni bekor qilib bo'lmaydi")
    async with conn.transaction():
        await conn.execute("UPDATE carpool_bookings SET status='cancelled', updated_at=NOW() WHERE id=$1", booking_id)
        if b["status"] == "confirmed":
            await conn.execute(
                """UPDATE carpool_trips SET seats_available=seats_available+$2,
                       status=CASE WHEN status='full' THEN 'active' ELSE status END WHERE id=$1""",
                b["trip_id"], b["seats"],
            )
    await notify(
        b["driver_id"], "carpool_booking", "↩️ Bron bekor qilindi",
        f"{user['first_name']} bronini bekor qildi ({b['seats']} o'rin).\n{b['from_address']} → {b['to_address']}",
        {"trip_id": b["trip_id"], "booking_id": booking_id, "status": "cancelled"},
        event="carpool:booking_updated", link=f"/carpool/trips/{b['trip_id']}",
    )
    return {"success": True}


@router.get("/bookings/my")
async def my_bookings(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT b.*, t.from_address, t.to_address, t.departure_at, t.price_per_seat, t.status AS trip_status,
                  t.driver_id, u.first_name AS driver_name, u.provider_rating AS driver_rating,
                  CASE WHEN b.status IN ('confirmed','completed') THEN u.phone END AS driver_phone,
                  v.model AS vehicle_model, v.plate_number AS vehicle_plate, v.color AS vehicle_color,
                  EXISTS(SELECT 1 FROM reviews r WHERE r.service_type='carpool' AND r.ref_id=b.id
                         AND r.rater_id=$1) AS reviewed
           FROM carpool_bookings b
           JOIN carpool_trips t ON t.id=b.trip_id
           JOIN users u ON u.id=t.driver_id
           LEFT JOIN vehicles v ON v.id=t.vehicle_id
           WHERE b.passenger_id=$1 ORDER BY t.departure_at DESC LIMIT 100""",
        user["id"],
    )
    return [dict(r) for r in rows]


@router.get("/suggest-price")
async def suggest_price(from_lat: float, from_lng: float, to_lat: float, to_lng: float,
                        user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    route = await get_route(from_lat, from_lng, to_lat, to_lng)
    est = await service_pricing.estimate(conn, "carpool", None, distance_km=route["distance_km"], seats=1)
    return {"distance_km": route["distance_km"], "duration_min": route["duration_min"],
            "suggested_price_per_seat": est["estimated_price"]}
