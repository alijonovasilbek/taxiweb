"""Smart Search va Matching.

Ijrochini tanlash bali (0..100):
  * masofa       — 40%  (yaqinroq = yaxshiroq)
  * reyting      — 25%
  * bo'sh vaqt   — 20%  (jadval / hozir bo'shligi)
  * narx         — 15%  (mijoz byudjetiga moslik)

Sohalararo moslashtirish: kategoriya qaysi servislarga mos bo'lsa (catalog.VEHICLE_CATEGORIES),
o'sha servis so'rovlarida taklif qilinadi — masalan, Damas egasi yuk tashish so'rovini ham oladi.
"""
from datetime import datetime

import asyncpg

from app.catalog import (
    REQUEST_MATCH_RADIUS_KM, categories_for_service, VEHICLE_CATEGORIES,
)
from app.utils import local_now

W_DIST, W_RATING, W_AVAIL, W_PRICE = 40, 25, 20, 15


async def _slots_by_user(conn: asyncpg.Connection, user_ids: list[int]) -> dict[int, list[dict]]:
    if not user_ids:
        return {}
    rows = await conn.fetch(
        "SELECT user_id, vehicle_id, weekday, start_time, end_time FROM availability WHERE user_id = ANY($1::int[])",
        user_ids,
    )
    out: dict[int, list[dict]] = {}
    for r in rows:
        out.setdefault(r["user_id"], []).append(dict(r))
    return out


def availability_score(slots: list[dict], vehicle_id: int, is_available: bool, when: datetime | None) -> tuple[float, str]:
    """1.0 — aniq bo'sh, 0.6 — jadval kiritilmagan (moslashuvchan), 0.0 — band."""
    when = when or local_now()
    is_now = abs((when - local_now()).total_seconds()) < 3 * 3600
    if is_now and not is_available:
        return 0.0, "hozir band"
    relevant = [s for s in slots if s["vehicle_id"] in (None, vehicle_id)]
    if not relevant:
        return (0.8 if is_available else 0.5), "jadval kiritilmagan"
    t = when.time()
    for s in relevant:
        if s["weekday"] == when.weekday() and s["start_time"] <= t <= s["end_time"]:
            return 1.0, "jadval bo'yicha bo'sh"
    return 0.15, "jadvaldan tashqari vaqt"


def unit_price(vehicle: dict, request: dict) -> float | None:
    unit = request.get("duration_unit")
    dur = float(request.get("duration_value") or 0)
    if unit and dur:
        rate = vehicle.get(f"price_per_{unit}")
        if rate:
            return float(rate) * dur
    if vehicle.get("price_per_km") and request.get("distance_km"):
        return float(vehicle["price_per_km"]) * float(request["distance_km"])
    return None


def price_score(expected: float | None, budget: float | None) -> float:
    if not expected or not budget:
        return 0.6
    ratio = expected / budget
    if ratio <= 1:
        return 1.0
    return max(0.0, 1.0 - (ratio - 1))  # byudjetdan 100% oshsa — 0


def score_provider(vehicle: dict, request: dict, slots: list[dict], radius_km: float) -> dict:
    dist = vehicle.get("distance_km")
    d_score = 0.5 if dist is None else max(0.0, 1.0 - float(dist) / radius_km)
    rating = float(vehicle.get("provider_rating") or 5)
    r_score = max(0.0, (rating - 1) / 4)
    when = request.get("scheduled_at")
    a_score, a_reason = availability_score(slots, vehicle["id"], vehicle.get("is_available", True), when)
    expected = unit_price(vehicle, request)
    p_score = price_score(expected, float(request["budget"]) if request.get("budget") else None)
    total = W_DIST * d_score + W_RATING * r_score + W_AVAIL * a_score + W_PRICE * p_score
    reasons = []
    if dist is not None:
        reasons.append(f"{float(dist):.1f} km uzoqlikda")
    reasons.append(f"reyting {rating:.1f}")
    reasons.append(a_reason)
    if expected:
        reasons.append(f"taxminiy narx {int(expected):,} so'm".replace(",", " "))
    cat = VEHICLE_CATEGORIES.get(vehicle["category"], {})
    if request.get("service_type") and cat and cat["services"][0] != request["service_type"]:
        reasons.append("sohalararo moslik")
    return {"score": round(total, 1), "expected_price": expected, "reasons": reasons,
            "availability": a_reason}


async def find_providers(conn: asyncpg.Connection, request: dict, limit: int = 30,
                         require_available: bool = False) -> list[dict]:
    """So'rovga mos ijrochilar (transport bo'yicha), ball bo'yicha saralangan."""
    service = request["service_type"]
    cats = [request["vehicle_category"]] if request.get("vehicle_category") else categories_for_service(service)
    radius_km = REQUEST_MATCH_RADIUS_KM.get(service, 50)
    rows = await conn.fetch(
        """SELECT v.*, u.first_name, u.last_name, u.telegram_id, u.provider_rating, u.provider_reviews,
                  CASE WHEN v.location IS NULL THEN NULL
                       ELSE ST_Distance(v.location, ST_MakePoint($2,$1)::geography)/1000 END AS distance_km
           FROM vehicles v JOIN users u ON u.id = v.owner_id
           WHERE v.status='approved' AND NOT u.is_blocked
             AND v.category = ANY($3::text[])
             AND v.owner_id <> $4
             AND (v.location IS NULL OR ST_DWithin(v.location, ST_MakePoint($2,$1)::geography, $5))""",
        float(request["from_lat"]), float(request["from_lng"]), cats, request.get("client_id") or 0,
        radius_km * 1000,
    )
    vehicles = [dict(r) for r in rows]
    slots = await _slots_by_user(conn, list({v["owner_id"] for v in vehicles}))
    results = []
    for v in vehicles:
        info = score_provider(v, request, slots.get(v["owner_id"], []), radius_km)
        if require_available and info["availability"] == "hozir band":
            continue
        v.pop("location", None)
        results.append({**v, **info})
    results.sort(key=lambda x: x["score"], reverse=True)
    # Bir egadan faqat eng yaxshi transport
    seen, uniq = set(), []
    for r in results:
        if r["owner_id"] in seen:
            continue
        seen.add(r["owner_id"])
        uniq.append(r)
    return uniq[:limit]


async def provider_vehicles(conn: asyncpg.Connection, user_id: int) -> list[dict]:
    rows = await conn.fetch(
        """SELECT id, category, model, plate_number, is_available,
                  ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
           FROM vehicles WHERE owner_id=$1 AND status='approved'""",
        user_id,
    )
    return [dict(r) for r in rows]


async def feed_for_provider(conn: asyncpg.Connection, user_id: int, service: str | None = None,
                            limit: int = 50) -> list[dict]:
    """Ijrochi uchun mos ochiq so'rovlar lentasi (sohalararo)."""
    vehicles = await provider_vehicles(conn, user_id)
    if not vehicles:
        return []
    cats = list({v["category"] for v in vehicles})
    services = sorted({s for c in cats for s in VEHICLE_CATEGORIES[c]["services"] if s in REQUEST_MATCH_RADIUS_KM})
    if service:
        services = [s for s in services if s == service]
    if not services:
        return []
    located = [v for v in vehicles if v["lat"] is not None]
    ref = located[0] if located else None
    rows = await conn.fetch(
        f"""SELECT r.*, u.first_name AS client_name, u.rating AS client_rating,
                  {"ST_Distance(r.from_location, ST_MakePoint($4,$3)::geography)/1000" if ref else "NULL::float"} AS distance_km,
                  (SELECT o.status FROM offers o WHERE o.request_id=r.id AND o.provider_id=$1) AS my_offer_status,
                  (SELECT o.price FROM offers o WHERE o.request_id=r.id AND o.provider_id=$1) AS my_offer_price
           FROM service_requests r JOIN users u ON u.id=r.client_id
           WHERE r.status='open' AND r.client_id<>$1
             AND r.service_type = ANY($2::text[])
             AND (r.vehicle_category IS NULL OR r.vehicle_category = ANY($5::text[]))
           ORDER BY r.created_at DESC LIMIT $6""",
        user_id, services, ref["lat"] if ref else 0.0, ref["lng"] if ref else 0.0, cats, limit * 2,
    )
    out = []
    for r in rows:
        d = dict(r)
        radius = REQUEST_MATCH_RADIUS_KM.get(d["service_type"], 50)
        if d["distance_km"] is not None and d["distance_km"] > radius:
            continue
        # vehicle_category bo'lmasa, ijrochining kamida bitta transporti shu servisga mos bo'lishi kerak
        if not d["vehicle_category"] and not any(d["service_type"] in VEHICLE_CATEGORIES[c]["services"] for c in cats):
            continue
        for k in ("from_location", "to_location", "phone"):
            d.pop(k, None)
        out.append(d)
    return out[:limit]
