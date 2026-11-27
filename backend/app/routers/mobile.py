"""Chortoq Ijrochi (Android) uchun API: qurilma (push), fon GPS paketi, versiya, ijrochi bosh sahifasi.

PLAN-ANDROID: B3 (devices), B5 (locations), B8 (version), B9 (provider/home).
"""
import re
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.auth import get_current_user
from app.catalog import VEHICLE_CATEGORIES
from app.config import settings
from app.database import get_db
from app.deps import current_user
from app.security import rate_limit
from app.services.driver_location import record_location
from app.services.roles import eligible_roles
from app.utils import rows_to_list

router = APIRouter(tags=["mobile"])


# ── B3: qurilma va push tokeni ───────────────────────────────────────────────
class DeviceIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=100, pattern=r"^[A-Za-z0-9_.:-]+$")
    fcm_token: str | None = Field(None, max_length=4096)
    platform: str = Field("android", pattern=r"^(android|ios)$")
    model: str | None = Field(None, max_length=120)
    os_version: str | None = Field(None, max_length=40)
    app_version: str | None = Field(None, max_length=40)


@router.put("/devices/me")
async def register_device(body: DeviceIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    async with conn.transaction():
        if body.fcm_token:  # token boshqa akkauntda qolib ketgan bo'lsa (telefon boshqaga o'tdi) — ko'chiramiz
            await conn.execute("UPDATE devices SET fcm_token=NULL WHERE fcm_token=$1 AND device_id<>$2",
                               body.fcm_token, body.device_id)
        # Boshqa akkauntdan shu qurilmaga o'tilgan bo'lsa — eski egasining tokeni yangi egaga o'tmasin
        await conn.execute("UPDATE devices SET fcm_token=NULL WHERE device_id=$1 AND user_id<>$2",
                           body.device_id, user["id"])
        row = await conn.fetchrow(
            """INSERT INTO devices(user_id, device_id, fcm_token, platform, model, os_version, app_version)
               VALUES($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (device_id) DO UPDATE SET user_id=EXCLUDED.user_id,
                   fcm_token=CASE WHEN $8 THEN EXCLUDED.fcm_token ELSE devices.fcm_token END,
                   platform=EXCLUDED.platform, model=EXCLUDED.model, os_version=EXCLUDED.os_version,
                   app_version=EXCLUDED.app_version, updated_at=NOW()
               RETURNING id, device_id, platform, model, app_version, updated_at, (fcm_token IS NOT NULL) AS push""",
            user["id"], body.device_id, body.fcm_token or None, body.platform, body.model, body.os_version,
            body.app_version, body.fcm_token is not None,
        )
    return dict(row)


# ── B5: fondagi GPS paketi ───────────────────────────────────────────────────
class LocPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    ts: datetime
    heading: float | None = Field(None, ge=0, le=360)
    speed: float | None = Field(None, ge=0, le=100)  # m/s
    accuracy: float | None = Field(None, ge=0)


class LocBatch(BaseModel):
    points: list[LocPoint] = Field(min_length=1, max_length=20)


@router.post("/drivers/me/locations", dependencies=[Depends(rate_limit("locations", 30, 60))])
async def post_locations(body: LocBatch, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Idempotent: avval qabul qilingan (eskiroq) nuqtalar qayta yuborilsa e'tiborsiz qoldiriladi."""
    driver = await conn.fetchrow(
        "SELECT id, is_online FROM drivers WHERE telegram_id=$1 AND status='approved'", user.get("telegram_id"))
    if not driver:
        raise HTTPException(403, "Tasdiqlangan taksi haydovchisi emas")
    # Takrorlarni QURILMA vaqti bo'yicha ajratamiz (oxirgi qabul qilingan nuqtaning ts'i Redis'da).
    # Server vaqti bilan solishtirib bo'lmaydi: telefon soati bir-ikki daqiqa orqada bo'lsa, barcha yangi
    # nuqtalar "eski" bo'lib tashlanar, heartbeat esa haydovchini oflayn qilib qo'yardi.
    from app.redis_client import get_redis
    r = get_redis()
    key = f"driver:loc_ts:{driver['id']}"
    last = None
    if r is not None:
        try:
            raw = await r.get(key)
            last = datetime.fromisoformat(raw.decode() if isinstance(raw, bytes) else raw) if raw else None
        except Exception:
            last = None
    now = datetime.now(timezone.utc)
    pts = []
    for p in sorted(body.points, key=lambda x: x.ts):
        ts = p.ts if p.ts.tzinfo else p.ts.replace(tzinfo=timezone.utc)
        if abs(ts - now) > timedelta(hours=24):
            continue  # soati butunlay noto'g'ri
        if p.accuracy is not None and p.accuracy > 200:
            continue  # GPS aniqligi juda past
        if last and ts <= last:
            continue
        pts.append(p.model_dump())
    accepted = await record_location(conn, driver["id"], pts) if pts else 0
    if pts and r is not None:
        try:
            newest = max(p["ts"] for p in pts)
            newest = newest if newest.tzinfo else newest.replace(tzinfo=timezone.utc)
            await r.set(key, newest.isoformat(), ex=86400)
        except Exception:
            pass
    return {"accepted": accepted, "is_online": driver["is_online"]}


# ── B8: ilova versiyasi ──────────────────────────────────────────────────────
def _ver(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3]) or (0,)


@router.get("/app/version")
async def app_version(current: str | None = None):
    data = {"min_version": settings.app_min_version, "latest": settings.app_latest_version,
            "apk_url": download_url(), "changelog": settings.app_changelog or None,
            "support": settings.support_username}
    if current:
        data["update_required"] = _ver(current) < _ver(settings.app_min_version)
        data["update_available"] = _ver(current) < _ver(settings.app_latest_version)
    return data


# ── B9: ijrochi bosh sahifasi (bitta so'rov) ─────────────────────────────────
def _sections(categories: set[str], is_taxi: bool) -> list[str]:
    services = set()
    for c in categories:
        services |= set(VEHICLE_CATEGORIES.get(c, {}).get("services", []))
    out = []
    if is_taxi:
        out.append("taxi")
    if "carpool" in services:
        out.append("carpool")
    if services & {"cargo", "equipment"}:
        out.append("requests")
    return out


async def _cached_feed_count(conn, uid: int) -> int:
    """Lenta hisoblash og'ir — natija 60 soniya keshlanadi (bosh sahifa tez-tez yangilanadi). KAMCHILIKLAR-ANDROID #23"""
    from app.redis_client import get_redis
    from app.services import smart_match
    r = get_redis()
    key = f"feed_count:{uid}"
    if r is not None:
        try:
            cached = await r.get(key)
            if cached is not None:
                return int(cached)
        except Exception:
            r = None
    n = len(await smart_match.feed_for_provider(conn, uid))
    if r is not None:
        try:
            await r.set(key, n, ex=60)
        except Exception:
            pass
    return n


def download_url() -> str | None:
    return settings.app_download_url or settings.app_apk_url or None


@router.get("/app/open", include_in_schema=False)
async def open_app():
    """Botdan ilovaga qaytish: Telegram inline tugmasi faqat https qabul qiladi — bu sahifa ilovani ochadi.
    KAMCHILIKLAR-ANDROID.md #20"""
    from fastapi.responses import HTMLResponse
    intent = "intent://login#Intent;scheme=chortoqijrochi;package=uz.chortoq.ijrochi;end"
    html = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Chortoq Ijrochi</title>
<style>body{{font-family:system-ui,sans-serif;background:#7d1531;color:#fff;display:flex;min-height:100vh;
align-items:center;justify-content:center;margin:0;text-align:center}}a{{display:inline-block;margin-top:18px;
background:#fff;color:#7d1531;padding:14px 22px;border-radius:14px;font-weight:700;text-decoration:none}}</style>
</head><body><div><h2>✅ Kirish tasdiqlandi</h2><p>Chortoq Ijrochi ilovasiga qayting.</p>
<a href="{intent}">Ilovani ochish</a></div><script>location.href="{intent}";</script></body></html>"""
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@router.get("/provider/home")
async def provider_home(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    uid = user["id"]
    cats = {r["category"] for r in await conn.fetch(
        "SELECT DISTINCT category FROM vehicles WHERE owner_id=$1 AND status='approved'", uid)}
    pending_vehicles = await conn.fetchval(
        "SELECT COUNT(*) FROM vehicles WHERE owner_id=$1 AND status='pending'", uid)
    driver = await conn.fetchrow(
        """SELECT id, status, is_online, is_on_ride, rating, total_rides, car_model, car_number, car_color
           FROM drivers WHERE telegram_id=$1""", user["telegram_id"])
    is_taxi = bool(driver and driver["status"] == "approved")

    taxi_today = 0.0
    active_order = None
    if driver:
        taxi_today = float(await conn.fetchval(
            """SELECT COALESCE(SUM(final_price),0) FROM orders WHERE driver_id=$1 AND status='completed'
               AND completed_at >= date_trunc('day', NOW())""", driver["id"]))
        row = await conn.fetchrow(
            """SELECT o.*, u.first_name AS passenger_name, u.phone AS passenger_phone, u.rating AS passenger_rating
               FROM orders o JOIN users u ON u.id=o.passenger_id
               WHERE o.driver_id=$1 AND o.status IN ('accepted','driver_arrived','in_progress')
               ORDER BY o.created_at DESC LIMIT 1""", driver["id"])
        active_order = dict(row) if row else None

    jobs_today = float(await conn.fetchval(
        """SELECT COALESCE(SUM(final_price),0) FROM service_requests WHERE provider_id=$1 AND status='completed'
           AND completed_at >= date_trunc('day', NOW())""", uid))
    active_jobs = await conn.fetch(
        """SELECT id, service_type, title, from_address, to_address, status, scheduled_at, final_price
           FROM service_requests WHERE provider_id=$1 AND status IN ('assigned','in_progress')
           ORDER BY scheduled_at NULLS LAST LIMIT 10""", uid)
    trips = await conn.fetch(
        """SELECT t.id, t.from_address, t.to_address, t.departure_at, t.seats_total, t.seats_available, t.status,
                  (SELECT COUNT(*) FROM carpool_bookings b WHERE b.trip_id=t.id AND b.status='pending') AS pending_bookings
           FROM carpool_trips t WHERE t.driver_id=$1 AND t.status IN ('active','full')
           ORDER BY t.departure_at LIMIT 10""", uid)
    new_requests = 0
    if cats & {c for c, v in VEHICLE_CATEGORIES.items() if set(v["services"]) & {"cargo", "equipment"}}:
        new_requests = await _cached_feed_count(conn, uid)
    unread = await conn.fetchval("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read", uid)

    return {
        "phone_required": not (user["phone"] and user.get("phone_verified")),
        "user": {"id": uid, "first_name": user["first_name"], "phone": user["phone"],
                 "phone_verified": user.get("phone_verified"), "roles": user["roles"],
                 "eligible_roles": sorted(await eligible_roles(conn, uid)),
                 "provider_rating": float(user["provider_rating"] or 0) if user.get("provider_rating") is not None else None},
        "sections": _sections(cats, is_taxi),
        "pending_vehicles": pending_vehicles,
        "taxi": dict(driver) if driver else None,
        "active_order": active_order,
        "active_jobs": rows_to_list(active_jobs),
        "carpool_trips": rows_to_list(trips),
        "new_requests": new_requests,
        "earnings_today": round(taxi_today + jobs_today, 2),
        "unread_notifications": unread,
    }
