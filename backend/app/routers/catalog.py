import asyncpg
from fastapi import APIRouter, Depends, Query

from app.catalog import ROLES, VEHICLE_CATEGORIES, DOC_TYPES
from app.database import get_db
from app.deps import current_user
from app.services import service_pricing
from app.services.yandex_service import get_route

router = APIRouter(tags=["catalog"])


@router.get("/catalog")
async def catalog(conn: asyncpg.Connection = Depends(get_db)):
    services = await conn.fetch("SELECT * FROM service_types ORDER BY sort_order")
    return {
        "services": [dict(s) for s in services],
        "roles": [{"code": k, **v} for k, v in ROLES.items()],
        "vehicle_categories": [{"code": k, **v} for k, v in VEHICLE_CATEGORIES.items()],
        "doc_types": [{"code": k, "name": v} for k, v in DOC_TYPES.items()],
    }


@router.get("/tariffs/estimate")
async def estimate(
    service: str,
    category: str | None = None,
    from_lat: float | None = None, from_lng: float | None = None,
    to_lat: float | None = None, to_lng: float | None = None,
    distance_km: float | None = None,
    duration_value: float | None = None,
    duration_unit: str | None = None,
    seats: int = Query(1, ge=1, le=50),
    user=Depends(current_user),
    conn: asyncpg.Connection = Depends(get_db),
):
    route = None
    if distance_km is None and None not in (from_lat, from_lng, to_lat, to_lng):
        route = await get_route(from_lat, from_lng, to_lat, to_lng)
        distance_km = route["distance_km"]
    result = await service_pricing.estimate(
        conn, service, category, distance_km=distance_km, duration_value=duration_value,
        duration_unit=duration_unit, seats=seats,
    )
    result.pop("tariff", None)
    return {**result, "distance_km": distance_km, "route": route}
