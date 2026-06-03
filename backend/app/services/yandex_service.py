import math
import httpx
from app.config import settings


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def geocode(address: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://geocode-maps.yandex.ru/1.x/",
            params={"geocode": address, "format": "json", "apikey": settings.yandex_geocoder_api_key, "lang": "uz_UZ", "results": 5},
            timeout=10,
        )
    response.raise_for_status()
    members = response.json()["response"]["GeoObjectCollection"]["featureMember"]
    result = []
    for member in members:
        obj = member["GeoObject"]
        lng, lat = map(float, obj["Point"]["pos"].split())
        result.append({"address": obj["metaDataProperty"]["GeocoderMetaData"]["text"], "lat": lat, "lng": lng})
    return result


async def reverse_geocode(lat: float, lng: float) -> str | None:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://geocode-maps.yandex.ru/1.x/",
            params={"geocode": f"{lng},{lat}", "format": "json", "apikey": settings.yandex_geocoder_api_key, "kind": "house", "results": 1},
            timeout=10,
        )
    response.raise_for_status()
    members = response.json()["response"]["GeoObjectCollection"]["featureMember"]
    if not members:
        return None
    return members[0]["GeoObject"]["metaDataProperty"]["GeocoderMetaData"]["text"]


async def get_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict:
    try:
        url = f"{settings.osrm_url}/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params={"overview": "full", "geometries": "geojson"}, timeout=8)
        response.raise_for_status()
        data = response.json()
        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            polyline = [
                {"lat": lat, "lng": lng}
                for lng, lat in route.get("geometry", {}).get("coordinates", [])
            ]
            return {
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_min": max(1, int(route["duration"] / 60)),
                "polyline": polyline,
            }
    except Exception:
        pass

    api_key = settings.yandex_router_api_key
    if api_key and not api_key.startswith("your_"):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://router.yandex.net/v2/route",
                    params={"waypoints": f"{from_lat},{from_lng}|{to_lat},{to_lng}", "mode": "driving", "apikey": api_key},
                    timeout=15,
                )
            response.raise_for_status()
            data = response.json()
            legs = data.get("route", {}).get("legs", [])
            if legs:
                steps = legs[0].get("steps", [])
                distance_km = sum(step.get("length", 0) for step in steps) / 1000
                duration_min = sum(step.get("duration", 0) for step in steps) / 60
                return {
                    "distance_km": round(distance_km, 2),
                    "duration_min": max(1, int(duration_min)),
                    "polyline": [
                        {"lat": from_lat, "lng": from_lng},
                        {"lat": to_lat, "lng": to_lng},
                    ],
                }
        except Exception:
            pass

    straight_km = _haversine_km(from_lat, from_lng, to_lat, to_lng)
    distance_km = round(straight_km * 1.4, 2)
    duration_min = max(1, int(distance_km / 40 * 60))
    return {
        "distance_km": distance_km,
        "duration_min": duration_min,
        "polyline": [
            {"lat": from_lat, "lng": from_lng},
            {"lat": to_lat, "lng": to_lng},
        ],
    }


async def suggest(text: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://suggest-maps.yandex.ru/v1/suggest",
            params={"text": text, "lang": "uz_UZ", "results": 5, "apikey": settings.yandex_maps_api_key},
            timeout=10,
        )
    response.raise_for_status()
    return [
        {"title": item.get("title", {}).get("text"), "subtitle": item.get("subtitle", {}).get("text")}
        for item in response.json().get("results", [])
    ]
