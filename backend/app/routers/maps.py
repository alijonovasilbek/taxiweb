from fastapi import APIRouter, Depends, Query, HTTPException
from app.auth import get_current_user
from app.services import yandex_service

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/geocode")
async def geocode(address: str = Query(...), user=Depends(get_current_user)):
    try:
        return await yandex_service.geocode(address)
    except Exception as e:
        raise HTTPException(502, f"Yandex geocoder error: {e}")


@router.get("/reverse-geocode")
async def reverse_geocode(lat: float = Query(...), lng: float = Query(...), user=Depends(get_current_user)):
    addr = await yandex_service.reverse_geocode(lat, lng)
    return {"address": addr}


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


@router.post("/suggest")
async def suggest(body: dict, user=Depends(get_current_user)):
    text = body.get("text", "")
    if not text:
        raise HTTPException(400, "text required")
    return await yandex_service.suggest(text)
