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
        row = await conn.fetchrow(
            """INSERT INTO devices(user_id, device_id, fcm_token, platform, model, os_version, app_version)
               VALUES($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (device_id) DO UPDATE SET user_id=EXCLUDED.user_id, fcm_token=EXCLUDED.fcm_token,
                   platform=EXCLUDED.platform, model=EXCLUDED.model, os_version=EXCLUDED.os_version,
                   app_version=EXCLUDED.app_version, updated_at=NOW()
               RETURNING id, device_id, platform, model, app_version, updated_at, (fcm_token IS NOT NULL) AS push""",
            user["id"], body.device_id, body.fcm_token, body.platform, body.model, body.os_version, body.app_version,
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
        """SELECT id, last_location_update::timestamptz AS last_location_update, is_online
           FROM drivers WHERE telegram_id=$1 AND status='approved'""",
        user.get("telegram_id"))
    if not driver:
        raise HTTPException(403, "Tasdiqlangan taksi haydovchisi emas")
    now = datetime.now(timezone.utc)
    last = driver["last_location_update"]
    pts = []
    for p in sorted(body.points, key=lambda x: x.ts):
        ts = p.ts if p.ts.tzinfo else p.ts.replace(tzinfo=timezone.utc)
        if ts > now + timedelta(minutes=2) or ts < now - timedelta(hours=1):
            continue  # soati noto'g'ri yoki juda eski
        if p.accuracy is not None and p.accuracy > 200:
            continue  # GPS aniqligi juda past
        if last and ts <= last:
            continue
        pts.append(p.model_dump())
    accepted = await record_location(conn, driver["id"], pts) if pts else 0
    return {"accepted": accepted, "is_online": driver["is_online"]}


# ── B8: ilova versiyasi ──────────────────────────────────────────────────────
def _ver(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3]) or (0,)


@router.get("/app/version")
async def app_version(current: str | None = None):
    data = {"min_version": settings.app_min_version, "latest": settings.app_latest_version,
            "apk_url": settings.app_apk_url or None, "changelog": settings.app_changelog or None}
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
        from app.services import smart_match
        new_requests = len(await smart_match.feed_for_provider(conn, uid))
    unread = await conn.fetchval("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read", uid)

    return {
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
