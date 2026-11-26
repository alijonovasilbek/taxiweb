import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user, verify_webapp_data
from app.security import rate_limit, require_dev_local
from app.database import get_db
from app.deps import current_user
from app.services.roles import ADMIN_ONLY_ROLES, eligible_roles
from app.schemas.services import PreferencesIn, SavedPlace, OnboardIn, PhoneManual, PhoneShare, ProfileUpdate, RolesUpdate
from app.utils import row_to_dict, rows_to_list

router = APIRouter(prefix="/users", tags=["users"])


async def _stats(conn: asyncpg.Connection, user_id: int) -> dict:
    return dict(await conn.fetchrow(
        """SELECT
             (SELECT COUNT(*) FROM vehicles WHERE owner_id=$1) AS vehicles,
             (SELECT COUNT(*) FROM vehicles WHERE owner_id=$1 AND status='approved') AS approved_vehicles,
             (SELECT COUNT(*) FROM carpool_trips WHERE driver_id=$1) AS trips,
             (SELECT COUNT(*) FROM carpool_bookings WHERE passenger_id=$1) AS bookings,
             (SELECT COUNT(*) FROM service_requests WHERE client_id=$1) AS requests,
             (SELECT COUNT(*) FROM service_requests WHERE provider_id=$1 AND status='completed') AS jobs_done,
             (SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read) AS unread_notifications""",
        user_id,
    ))


@router.get("/me")
async def get_me(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    eligible = await eligible_roles(conn, user["id"]) | (set(user.get("roles") or []) & ADMIN_ONLY_ROLES)
    return {**row_to_dict(user), "stats": await _stats(conn, user["id"]), "eligible_roles": sorted(eligible),
            "saved_places": _places(user.get("saved_places")), "preferences": _places(user.get("preferences"))}


@router.put("/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        return row_to_dict(user)
    cols = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(fields))
    row = await conn.fetchrow(
        f"UPDATE users SET {cols}, updated_at=NOW() WHERE id=$1 RETURNING *", user["id"], *fields.values()
    )
    return row_to_dict(row)


def normalize_phone(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 9:  # 90 123 45 67 → O'zbekiston kodi
        digits = "998" + digits
    if len(digits) < 9 or len(digits) > 15:
        raise HTTPException(400, "Telefon raqami noto'g'ri")
    return "+" + digits


async def save_verified_phone(conn: asyncpg.Connection, telegram_id: int, phone: str):
    return await conn.fetchrow(
        "UPDATE users SET phone=$2, phone_verified=TRUE, updated_at=NOW() WHERE telegram_id=$1 RETURNING *",
        telegram_id, normalize_phone(phone),
    )


@router.post("/me/phone", dependencies=[Depends(rate_limit("phone", 10, 300))])
async def share_phone(body: PhoneShare, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    """WebApp.requestContact() javobini tekshiradi: imzo Telegram'niki va kontakt aynan shu foydalanuvchiniki."""
    params = verify_webapp_data(body.response, max_age=600)
    try:
        contact = json.loads(params.get("contact") or "{}")
    except ValueError:
        raise HTTPException(400, "Kontakt ma'lumoti noto'g'ri")
    if not contact.get("phone_number"):
        raise HTTPException(400, "Kontaktda telefon raqami yo'q")
    if contact.get("user_id") and int(contact["user_id"]) != int(user["telegram_id"]):
        raise HTTPException(403, "Faqat o'zingizning raqamingizni ulashishingiz mumkin")
    row = await save_verified_phone(conn, user["telegram_id"], contact["phone_number"])
    return row_to_dict(row)


@router.post("/me/phone/dev", dependencies=[Depends(require_dev_local)])
async def set_phone_dev(body: PhoneManual, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await save_verified_phone(conn, user["telegram_id"], body.phone)
    return row_to_dict(row)


@router.post("/me/onboard")
async def onboard(body: OnboardIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    if not user.get("phone_verified"):
        raise HTTPException(400, "Avval telefon raqamingizni ulashing")
    row = await conn.fetchrow(
        "UPDATE users SET onboarded_at=COALESCE(onboarded_at, NOW()), updated_at=NOW() WHERE id=$1 RETURNING *",
        user["id"],
    )
    return {**row_to_dict(row), "stats": await _stats(conn, user["id"])}


@router.put("/me/preferences")
async def update_preferences(body: PreferencesIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Faqat yuborilgan maydonlar yangilanadi (qolgan sozlamalar saqlanib qoladi)."""
    patch = body.model_dump(exclude_none=True)
    row = await conn.fetchrow(
        "UPDATE users SET preferences = preferences || $2::jsonb, updated_at=NOW() WHERE id=$1 RETURNING preferences",
        user["id"], json.dumps(patch),
    )
    return _places(row["preferences"])


PLACE_KINDS = ("home", "work")


@router.put("/me/places/{kind}")
async def save_place(kind: str, body: SavedPlace, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    if kind not in PLACE_KINDS:
        raise HTTPException(400, "Faqat home yoki work")
    row = await conn.fetchrow(
        "UPDATE users SET saved_places = saved_places || jsonb_build_object($2::text, $3::jsonb), updated_at=NOW() "
        "WHERE id=$1 RETURNING saved_places", user["id"], kind, json.dumps(body.model_dump()),
    )
    return _places(row["saved_places"])


@router.delete("/me/places/{kind}")
async def delete_place(kind: str, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "UPDATE users SET saved_places = saved_places - $2::text, updated_at=NOW() WHERE id=$1 RETURNING saved_places",
        user["id"], kind,
    )
    return _places(row["saved_places"])


def _places(raw) -> dict:
    return json.loads(raw) if isinstance(raw, str) else (raw or {})


@router.put("/me/roles")
async def update_roles(body: RolesUpdate, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Foydalanuvchi rolni faqat o'chira oladi (masalan, vaqtincha ijrochi emas). Yangi rol tasdiqlangan
    transportdan keladi — erkin qo'shib bo'lmaydi."""
    allowed = await eligible_roles(conn, user["id"]) | (set(user.get("roles") or []) & ADMIN_ONLY_ROLES)
    extra = [r for r in body.roles if r not in allowed]
    if extra:
        raise HTTPException(403, "Bu rol uchun admin tasdiqlagan transport kerak: " + ", ".join(extra))
    row = await conn.fetchrow(
        "UPDATE users SET roles=$2::text[], updated_at=NOW() WHERE id=$1 RETURNING *", user["id"], body.roles
    )
    return row_to_dict(row)


@router.get("/me/rides")
async def get_rides(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM orders WHERE passenger_id=$1 ORDER BY created_at DESC LIMIT 50", user["id"]
    )
    return rows_to_list(rows)


@router.get("/me/ratings")
async def get_ratings(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM ratings WHERE rated_user_id=$1 ORDER BY created_at DESC", user["id"]
    )
    return [dict(r) for r in rows]


@router.get("/{user_id}/public")
async def public_profile(user_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        """SELECT id, first_name, last_name, telegram_username, roles, company_name, bio,
                  rating, provider_rating, provider_reviews, created_at
           FROM users WHERE id=$1""",
        user_id,
    )
    if not row:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    vehicles = await conn.fetch(
        "SELECT * FROM vehicles WHERE owner_id=$1 AND status='approved' ORDER BY id", user_id
    )
    reviews = await conn.fetch(
        """SELECT r.rating, r.comment, r.service_type, r.created_at, u.first_name AS rater_name
           FROM reviews r JOIN users u ON u.id=r.rater_id
           WHERE r.target_user_id=$1 ORDER BY r.created_at DESC LIMIT 20""",
        user_id,
    )
    return {**dict(row), "vehicles": rows_to_list(vehicles), "reviews": [dict(r) for r in reviews]}
