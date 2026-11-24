import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.database import get_db
from app.deps import current_user
from app.schemas.services import ProfileUpdate, RolesUpdate
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
    return {**row_to_dict(user), "stats": await _stats(conn, user["id"])}


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


@router.put("/me/roles")
async def update_roles(body: RolesUpdate, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
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
