"""Smart Search — barcha servislar bo'yicha yagona qidiruv.

Lokatsiya (radius), vaqt (jadval/bo'shlik), filtrlar (xizmat turi, narx, reyting, kategoriya)
asosida eng mos natijalarni qaytaradi va sohalararo tavsiyalar beradi.
"""
from datetime import date, datetime, time

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.catalog import VEHICLE_CATEGORIES, categories_for_service, REQUEST_MATCH_RADIUS_KM
from app.database import get_db
from app.deps import current_user
from app.routers.carpool import search_trips
from app.services import smart_match
from app.utils import local_now

router = APIRouter(prefix="/search", tags=["search"])

CHORTOQ = (41.0694, 71.8237)


@router.get("")
async def smart_search(
    service: str | None = Query(None, description="taxi | carpool | cargo | equipment"),
    q: str | None = Query(None, max_length=100),
    lat: float | None = None,
    lng: float | None = None,
    to_lat: float | None = None,
    to_lng: float | None = None,
    category: str | None = None,
    day: date | None = Query(None, alias="date"),
    at: str | None = Query(None, description="HH:MM — kerakli vaqt"),
    max_price: float | None = None,
    min_rating: float | None = Query(None, ge=1, le=5),
    seats: int = Query(1, ge=1, le=50),
    available_only: bool = False,
    user=Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    lat = lat if lat is not None else CHORTOQ[0]
    lng = lng if lng is not None else CHORTOQ[1]
    when = None
    if day or at:
        try:
            t = time.fromisoformat(at) if at else time(9, 0)
        except ValueError:
            t = time(9, 0)
        when = datetime.combine(day or local_now().date(), t)

    result: dict = {"query": {"service": service, "lat": lat, "lng": lng, "when": when}}

    # 1. Po'puti qatnovlari
    if service in (None, "carpool"):
        result["trips"] = await search_trips(
            from_lat=lat if service == "carpool" or to_lat is not None else None,
            from_lng=lng if service == "carpool" or to_lat is not None else None,
            to_lat=to_lat, to_lng=to_lng, q=q, day=day, seats=seats, max_price=max_price,
            radius_km=10, user=user, conn=conn,
        )

    # 2. Ijrochilar (yuk, texnika) — smart matching bali bilan
    provider_services = [s for s in ("cargo", "equipment") if service in (None, s)]
    providers = []
    for svc in provider_services:
        if category and svc not in VEHICLE_CATEGORIES.get(category, {}).get("services", []):
            continue
        pseudo = {
            "service_type": svc, "vehicle_category": category, "from_lat": lat, "from_lng": lng,
            "client_id": user["id"], "scheduled_at": when, "budget": max_price,
        }
        for p in await smart_match.find_providers(conn, pseudo, limit=30, require_available=available_only):
            p["service_type"] = svc
            providers.append(p)
    if q:
        ql = q.lower()
        providers = [p for p in providers if ql in (p.get("model") or "").lower()
                     or ql in VEHICLE_CATEGORIES[p["category"]]["name"].lower()
                     or ql in (p.get("first_name") or "").lower() or ql in (p.get("description") or "").lower()]
    if min_rating:
        providers = [p for p in providers if float(p.get("provider_rating") or 5) >= min_rating]
    if max_price:
        providers = [p for p in providers if not p.get("expected_price") or p["expected_price"] <= max_price]
    # takrorlarni olib tashlash (sohalararo transport ikki servisda chiqishi mumkin)
    uniq: dict = {}
    for p in sorted(providers, key=lambda x: x["score"], reverse=True):
        uniq.setdefault(p["id"], p)
    result["providers"] = [
        {k: v for k, v in p.items() if k not in ("telegram_id",)} for p in list(uniq.values())[:40]
    ]

    # 3. Taksi — yaqin onlayn haydovchilar soni
    if service in (None, "taxi"):
        result["taxi_nearby"] = await conn.fetchval(
            """SELECT COUNT(*) FROM drivers WHERE is_online AND NOT is_on_ride AND status='approved'
               AND ST_DWithin(current_location, ST_MakePoint($2,$1)::geography, 5000)""",
            lat, lng,
        )

    # 4. Ijrochi uchun: mos ochiq so'rovlar (sohalararo)
    result["open_requests"] = await smart_match.feed_for_provider(
        conn, user["id"], service if service in ("cargo", "equipment") else None, limit=20
    )

    # 5. Sohalararo tavsiyalar
    result["cross_service_tips"] = await _cross_tips(conn, user["id"])
    return result


async def _cross_tips(conn: asyncpg.Connection, user_id: int) -> list[str]:
    tips = []
    vehicles = await conn.fetch(
        "SELECT category, is_available FROM vehicles WHERE owner_id=$1 AND status='approved'", user_id
    )
    for v in vehicles:
        services = VEHICLE_CATEGORIES[v["category"]]["services"]
        name = VEHICLE_CATEGORIES[v["category"]]["name"]
        if v["is_available"] and "cargo" in services and "carpool" in services:
            tips.append(f"{name} transportingiz bo'sh bo'lsa, yuk tashish so'rovlarida ham taklif bera olasiz")
        if "carpool" in services:
            tips.append(f"{name} bilan doimiy po'puti qatnov e'lon qilib, bo'sh o'rinlarni to'ldiring")
    return list(dict.fromkeys(tips))[:3]
