import httpx
from app.config import settings


async def geocode(address: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://geocode-maps.yandex.ru/1.x/",
            params={"geocode": address, "format": "json", "apikey": settings.yandex_geocoder_api_key, "lang": "uz_UZ", "results": 5},
            timeout=10,
        )
    r.raise_for_status()
    members = r.json()["response"]["GeoObjectCollection"]["featureMember"]
    result = []
    for m in members:
        obj = m["GeoObject"]
        lng, lat = map(float, obj["Point"]["pos"].split())
        result.append({"address": obj["metaDataProperty"]["GeocoderMetaData"]["text"], "lat": lat, "lng": lng})
    return result


async def reverse_geocode(lat: float, lng: float) -> str | None:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://geocode-maps.yandex.ru/1.x/",
            params={"geocode": f"{lng},{lat}", "format": "json", "apikey": settings.yandex_geocoder_api_key, "kind": "house", "results": 1},
            timeout=10,
        )
    r.raise_for_status()
    members = r.json()["response"]["GeoObjectCollection"]["featureMember"]
    if not members:
        return None
    return members[0]["GeoObject"]["metaDataProperty"]["GeocoderMetaData"]["text"]


async def get_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://router.yandex.net/v2/route",
            params={"waypoints": f"{from_lat},{from_lng}|{to_lat},{to_lng}", "mode": "driving", "apikey": settings.yandex_router_api_key},
            timeout=15,
        )
    r.raise_for_status()
    data = r.json()
    legs = data.get("route", {}).get("legs", [])
    if not legs:
        raise ValueError("Route not found")
    steps = legs[0].get("steps", [])
    distance_km = sum(s.get("length", 0) for s in steps) / 1000
    duration_min = sum(s.get("duration", 0) for s in steps) / 60
    return {"distance_km": round(distance_km, 2), "duration_min": int(duration_min)}


async def suggest(text: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://suggest-maps.yandex.ru/v1/suggest",
            params={"text": text, "lang": "uz_UZ", "results": 5, "apikey": settings.yandex_maps_api_key},
            timeout=10,
        )
    r.raise_for_status()
    return [
        {"title": item.get("title", {}).get("text"), "subtitle": item.get("subtitle", {}).get("text")}
        for item in r.json().get("results", [])
    ]
