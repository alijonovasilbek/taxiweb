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


# ── "Chortoq" ilovasi uchun xarita (WebView): kalit serverda qoladi, ilova faqat buyruq/hodisa almashadi ──
_EMBED = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#m{margin:0;padding:0;width:100%;height:100%;background:__BG__}
[class*="map-open-block"],[class*="gototech"]{display:none!important}
[class*="copyright"]{transform:scale(.8);transform-origin:right bottom;opacity:.7}</style>
<script src="https://api-maps.yandex.ru/2.1/?lang=uz_UZ&load=package.standard&apikey=__KEY__"></script></head>
<body><div id="m"></div><script>
var RN=window.ReactNativeWebView, map=null, marks={}, route=null, moving=false;
function send(o){ try{ RN && RN.postMessage(JSON.stringify(o)); }catch(e){} }
var PRESET={pickup:'islands#greenCircleDotIcon',dropoff:'islands#redCircleDotIcon',driver:'islands#blueAutoCircleIcon',
  car:'islands#blackAutoCircleIcon',point:'islands#violetCircleDotIcon'};
window.csCmd=function(c){ if(!map) return;
  if(c.t==='center'){ c.animate===false ? map.setCenter([c.lat,c.lng], c.zoom||map.getZoom())
      : map.panTo([c.lat,c.lng],{duration:350}).then(function(){ if(c.zoom) map.setZoom(c.zoom,{duration:200}); }); }
  else if(c.t==='markers'){ var keep={};
    (c.items||[]).forEach(function(m){ keep[m.id]=1;
      if(marks[m.id]){ marks[m.id].geometry.setCoordinates([m.lat,m.lng]); }
      else { marks[m.id]=new ymaps.Placemark([m.lat,m.lng],{},{preset:PRESET[m.type]||PRESET.point}); map.geoObjects.add(marks[m.id]); } });
    Object.keys(marks).forEach(function(k){ if(!keep[k]){ map.geoObjects.remove(marks[k]); delete marks[k]; } }); }
  else if(c.t==='route'){ if(route){ map.geoObjects.remove(route); route=null; }
    if(c.points && c.points.length>1){ route=new ymaps.Polyline(c.points,{},{strokeColor:'#8c1c3a',strokeWidth:5,strokeOpacity:.85});
      map.geoObjects.add(route); } }
  else if(c.t==='fit'){ var b=map.geoObjects.getBounds(); if(b) map.setBounds(b,{checkZoomRange:true,zoomMargin:[60,40,c.bottom||260,40],duration:300}); }
};
if(!window.ymaps){ send({t:'error'}); } else ymaps.ready(function(){
  map=new ymaps.Map('m',{center:[__LAT__,__LNG__],zoom:16,controls:[]},{suppressMapOpenBlock:true,yandexMapDisablePoiInteractivity:true});
  map.events.add('actionbegin',function(){ if(!moving){ moving=true; send({t:'move'}); } });
  map.events.add('actionend',function(){ moving=false; var c=map.getCenter(); send({t:'center',lat:c[0],lng:c[1]}); });
  map.events.add('click',function(e){ var c=e.get('coords'); send({t:'click',lat:c[0],lng:c[1]}); });
  send({t:'ready'});
});
</script></body></html>"""


@router.get("/embed", include_in_schema=False)
async def embed(lat: float = 41.0694, lng: float = 71.8237, dark: bool = False):
    from fastapi.responses import HTMLResponse
    from app.config import settings
    html = (_EMBED.replace("__KEY__", settings.yandex_maps_api_key).replace("__LAT__", str(lat))
            .replace("__LNG__", str(lng)).replace("__BG__", "#1c1c1e" if dark else "#e9e6df"))
    # Sahifa kichik va o'zgarmas — telefon keshlaydi, xarita keyingi ochilishda tezroq chiqadi
    return HTMLResponse(html, headers={"Cache-Control": "public, max-age=3600"})
