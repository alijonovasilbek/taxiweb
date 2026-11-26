import asyncpg
from fastapi import APIRouter, Depends, Query, HTTPException
from app.auth import get_current_user
from app.database import get_db
from app.schemas.order import RouteEstimateRequest
from app.security import rate_limit
from app.services import yandex_service
from app.services.pricing_service import estimate_price

# Yandex kunlik limitini himoya qilish: umumiy va qidiruv uchun alohida cheklov
router = APIRouter(prefix="/maps", tags=["maps"], dependencies=[Depends(rate_limit("maps", 120, 60))])


@router.get("/geocode")
async def geocode(
    address: str | None = Query(None), uri: str | None = Query(None),
    lat: float | None = Query(None), lng: float | None = Query(None), user=Depends(get_current_user),
):
    if not address and not uri:
        raise HTTPException(400, "address yoki uri kerak")
    try:
        return await yandex_service.geocode(address, uri=uri, lat=lat, lng=lng)
    except Exception as e:
        raise HTTPException(502, f"Yandex geocoder error: {e}")


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float = Query(...), lng: float = Query(...), user=Depends(get_current_user)):
    try:
        item = await yandex_service.reverse_geocode_full(lat, lng)
    except Exception:
        item = None
    if not item:
        return {"address": None, "title": None, "subtitle": None}
    return {"address": item["address"], "title": item["title"], "subtitle": item["subtitle"]}


@router.get("/route")
async def route(
    from_lat: float = Query(..., alias="fromLat"),
    from_lng: float = Query(..., alias="fromLng"),
    to_lat: float = Query(..., alias="toLat"),
    to_lng: float = Query(..., alias="toLng"),
    user=Depends(get_current_user),
):
    try:
        return await yandex_service.get_route(from_lat, from_lng, to_lat, to_lng)
    except Exception as e:
        raise HTTPException(502, f"Yandex router error: {e}")


@router.post("/suggest", dependencies=[Depends(rate_limit("suggest", 40, 60))])
async def suggest(body: dict, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    text = (body.get("text") or "").strip()
    if len(text) < 2:
        return []
    lat, lng = body.get("lat"), body.get("lng")
    # Admin qo'shgan mashhur joylar (Yandex bazasida yo'q yoki noto'g'ri bo'lganlar) — birinchi
    rows = await conn.fetch(
        """SELECT name, address, lat, lng FROM popular_places
           WHERE is_active AND (name ILIKE '%' || $1 || '%' OR address ILIKE '%' || $1 || '%') ORDER BY name LIMIT 4""",
        text,
    )
    local = [{
        "title": r["name"], "subtitle": r["address"] or "Mashhur joy", "address": r["name"], "lat": r["lat"], "lng": r["lng"],
        "distance_km": round(yandex_service._haversine_km(lat, lng, r["lat"], r["lng"]), 1) if lat and lng else None,
        "popular": True,
    } for r in rows]
    try:
        found = await yandex_service.suggest(text, lat=lat, lng=lng)
    except Exception as e:
        if local:
            return local
        raise HTTPException(502, f"Qidiruv xizmati ishlamadi: {e}")
    names = {x["title"].lower() for x in local}
    return local + [x for x in found if (x.get("title") or "").lower() not in names][: max(0, 8 - len(local))]


@router.post("/estimate")
async def estimate(body: RouteEstimateRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Masofa, vaqt va narx — buyurtma yaratishdagi bilan bir xil qoida (resolve_route)."""
    route = await yandex_service.resolve_route(
        body.from_lat, body.from_lng, body.to_lat, body.to_lng, body.distance_km, body.duration_min,
    )
    try:
        price, _ = await estimate_price(conn, route["distance_km"], route["duration_min"])
    except ValueError:
        price = None
    return {**route, "price": price}
