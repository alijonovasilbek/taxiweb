import asyncio
import math
import re
import httpx
from app.config import settings


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return radius_km * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"
SUGGEST_URL = "https://suggest-maps.yandex.ru/v1/suggest"
# Manzilning qisqa ko'rinishi uchun tashlab yuboriladigan umumiy qismlar
_SKIP_KINDS = {"country", "province", "area"}


_MFY = re.compile(r"\s+mahalla\s+fuqarolar\s+yi[gʻ'‘’`]+ini", re.IGNORECASE)


def _clean(name: str | None) -> str | None:
    return _MFY.sub(" mahallasi", name).strip() if name else name


def _parse(obj: dict) -> dict:
    """GeoObject → {title, subtitle, address, lat, lng, kind}. Title — ko'cha/uy yoki joy nomi, subtitle — shahar/mahalla."""
    meta = obj["metaDataProperty"]["GeocoderMetaData"]
    lng, lat = map(float, obj["Point"]["pos"].split())
    comps = meta.get("Address", {}).get("Components", [])
    by_kind: dict[str, list[str]] = {}
    for c in comps:
        by_kind.setdefault(c["kind"], []).append(_clean(c["name"]))

    street = (by_kind.get("street") or [None])[-1]
    house = (by_kind.get("house") or [None])[-1]
    district = (by_kind.get("district") or [None])[-1]
    locality = (by_kind.get("locality") or [None])[0]
    name = _clean(obj.get("name") or meta.get("text", ""))

    if street:
        title = f"{street}, {house}" if house else street
    elif district:
        title = district
    else:
        title = name
    sub_parts = [x for x in (district if street else None, locality) if x and x != title]
    if not sub_parts:
        sub_parts = [n for c in comps if c["kind"] in ("area", "province") for n in [c["name"]]][-1:]
    subtitle = ", ".join(sub_parts)
    address = f"{title}, {locality}" if locality and locality not in title else title
    return {
        "title": title, "subtitle": subtitle, "address": address,
        "full_address": meta.get("text", ""), "lat": lat, "lng": lng, "kind": meta.get("kind"),
    }


async def _geocoder(params: dict) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            GEOCODER_URL,
            params={"format": "json", "lang": "uz_UZ", "apikey": settings.yandex_geocoder_api_key, **params},
            timeout=10,
        )
    response.raise_for_status()
    members = response.json()["response"]["GeoObjectCollection"]["featureMember"]
    return [_parse(m["GeoObject"]) for m in members]


async def geocode(address: str | None = None, uri: str | None = None,
                  lat: float | None = None, lng: float | None = None) -> list[dict]:
    if uri:
        return await _geocoder({"uri": uri, "results": 1})
    lat = lat if lat is not None else settings.default_lat
    lng = lng if lng is not None else settings.default_lng
    return await _geocoder({"geocode": address, "results": 5, "ll": f"{lng},{lat}", "spn": "0.6,0.6"})


async def reverse_geocode_full(lat: float, lng: float) -> dict | None:
    """Uy → ko'cha → mahalla tartibida eng aniq nomni topadi."""
    for kind in ("house", "street", None):
        params = {"geocode": f"{lng},{lat}", "results": 1}
        if kind:
            params["kind"] = kind
        items = await _geocoder(params)
        if items:
            # Uy/ko'cha juda uzoqda bo'lsa (300 m+), keyingi darajaga o'tamiz
            if kind and _haversine_km(lat, lng, items[0]["lat"], items[0]["lng"]) > 0.3:
                continue
            return items[0]
    return None


async def reverse_geocode(lat: float, lng: float) -> str | None:
    item = await reverse_geocode_full(lat, lng)
    return item["address"] if item else None


async def _geosuggest(text: str, lat: float, lng: float, strict: bool) -> list[dict]:
    """Yandex Geosuggest: joy nomlari (biz) va manzillar (geo). Natija bo'lmasa Yandex bo'sh javob qaytaradi."""
    params = {
        "text": text, "lang": "uz", "results": 7, "ll": f"{lng},{lat}", "spn": "1.2,1.2",
        "types": "biz,geo", "print_address": 1, "attrs": "uri", "apikey": settings.yandex_suggest_api_key,
    }
    if strict:
        params["strict_bounds"] = 1
    async with httpx.AsyncClient() as client:
        response = await client.get(SUGGEST_URL, params=params, timeout=8)
    response.raise_for_status()
    if not response.content.strip():
        return []
    out = []
    for it in response.json().get("results", []):
        meters = (it.get("distance") or {}).get("value")
        out.append({
            "title": _clean((it.get("title") or {}).get("text")),
            "subtitle": _clean((it.get("subtitle") or {}).get("text")),
            "uri": it.get("uri"),
            "distance_km": round(meters / 1000, 1) if meters is not None else None,
        })
    return out


async def suggest(text: str, lat: float | None = None, lng: float | None = None) -> list[dict]:
    """Qidiruv takliflari: avval Geosuggest (viloyat ichida, keyin kengroq), so'ng geocoder bilan to'ldiriladi."""
    lat = lat if lat is not None else settings.default_lat
    lng = lng if lng is not None else settings.default_lng

    near = lambda it: it["distance_km"] is None or it["distance_km"] <= 150  # boshqa viloyat/davlat kerak emas
    items: list[dict] = []
    if settings.yandex_suggest_api_key:
        # Umumiy va viloyat chegarasidagi qidiruv parallel: Yandex ikkalasida turli joylarni qaytaradi
        results = await asyncio.gather(
            _geosuggest(text, lat, lng, False), _geosuggest(text, lat, lng, True), return_exceptions=True,
        )
        for res in results:
            if isinstance(res, list):
                items += [it for it in res if near(it)]

    if len(items) < 4:
        try:
            geo = await _geocoder({"geocode": text, "results": 10, "ll": f"{lng},{lat}", "spn": "0.6,0.6"})
        except Exception:
            geo = []
        for it in geo:
            it["distance_km"] = round(_haversine_km(lat, lng, it["lat"], it["lng"]), 1)
        items += sorted((it for it in geo if it["distance_km"] <= 150), key=lambda x: x["distance_km"])

    # Yandex Go kabi: yaqin joylar birinchi
    items.sort(key=lambda it: it["distance_km"] if it["distance_km"] is not None else 999)
    seen, out = set(), []
    for it in items:
        k = ((it["title"] or "") + "|" + (it["subtitle"] or "")[:40]).lower()
        if k and k not in seen:
            seen.add(k)
            out.append(it)
    return out[:8]


# Zaxira OSRM (FOSSGIS, OpenStreetMap Germaniya) — asosiy server javob bermasa
OSRM_FALLBACKS = ("https://routing.openstreetmap.de/routed-car",)
ROUTE_CACHE_TTL = 24 * 3600


async def _osrm(base: str, from_lat: float, from_lng: float, to_lat: float, to_lng: float, timeout: float) -> dict | None:
    url = f"{base.rstrip('/')}/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}"
    # Ommaviy OSRM serverlari (FOSSGIS) User-Agent'siz so'rovni rad etadi
    async with httpx.AsyncClient(headers={"User-Agent": "chortoq-services/1.0"}) as client:
        response = await client.get(url, params={"overview": "full", "geometries": "geojson"}, timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        return None
    route = data["routes"][0]
    polyline = [{"lat": lat, "lng": lng} for lng, lat in route.get("geometry", {}).get("coordinates", [])]
    if len(polyline) < 2:
        return None
    return {
        "distance_km": round(route["distance"] / 1000, 2),
        "duration_min": max(1, int(route["duration"] / 60)),
        "polyline": polyline,
    }


async def get_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict:
    """Ko'chalar bo'ylab marshrut. Tartib: Redis kesh → asosiy OSRM (2 urinish) → zaxira OSRM → Yandex → taxminiy.
    Taxminiy (to'g'ri chiziq) natijada `approx: True` — mijozlar uni yo'l sifatida chizmaydi."""
    import json
    from app.redis_client import get_redis
    r = get_redis()
    key = f"route:{from_lat:.4f},{from_lng:.4f}:{to_lat:.4f},{to_lng:.4f}"
    if r is not None:
        try:
            hit = await r.get(key)
            if hit:
                return json.loads(hit)
        except Exception:
            pass
    async def attempt(base: str, timeout: float) -> dict | None:
        try:
            return await _osrm(base, from_lat, from_lng, to_lat, to_lng, timeout)
        except Exception:
            return None

    # Asosiy va zaxira serverga bir vaqtda: birinchi muvaffaqiyatli javob olinadi (kutish uzaymaydi)
    route = None
    bases = [b for b in (settings.osrm_url, *OSRM_FALLBACKS) if b]
    for _round in range(2):
        tasks = [asyncio.create_task(attempt(b, 8)) for b in bases]
        for fut in asyncio.as_completed(tasks):
            route = await fut
            if route:
                break
        for t in tasks:
            t.cancel()
        if route:
            break
    if route:
        if r is not None:
            try:
                await r.set(key, json.dumps(route), ex=ROUTE_CACHE_TTL)
            except Exception:
                pass
        return route

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
                    "approx": True,
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
        "approx": True,
    }


def plausible_road(straight_km: float, km: float | None, minutes: float | None) -> bool:
    """Mijoz yuborgan yo'l masofasi/vaqti haqiqatga yaqinmi (narxni soxtalashtirishdan himoya)."""
    if not km or not minutes or km <= 0 or minutes <= 0:
        return False
    if km < straight_km * 0.95 or km > straight_km * 3 + 1:
        return False
    speed = km / (minutes / 60)
    return 3 <= speed <= 130


async def resolve_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float,
                        km: float | None = None, minutes: float | None = None) -> dict:
    straight = _haversine_km(from_lat, from_lng, to_lat, to_lng)
    if plausible_road(straight, km, minutes):
        return {"distance_km": round(km, 2), "duration_min": max(1, int(round(minutes))), "polyline": [], "source": "map"}
    route = await get_route(from_lat, from_lng, to_lat, to_lng)
    return {**route, "source": "server"}
