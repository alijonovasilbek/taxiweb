import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import current_user
from app.schemas.services import ReviewIn
from app.services.notify import notify

router = APIRouter(prefix="/reviews", tags=["reviews"])


async def _resolve_target(conn: asyncpg.Connection, body: ReviewIn, user_id: int) -> tuple[int, str]:
    """Baholanuvchini aniqlash: (target_user_id, target_role)."""
    if body.service_type == "carpool":
        b = await conn.fetchrow(
            """SELECT b.passenger_id, b.status, t.driver_id FROM carpool_bookings b
               JOIN carpool_trips t ON t.id=b.trip_id WHERE b.id=$1""",
            body.ref_id,
        )
        if not b:
            raise HTTPException(404, "Bron topilmadi")
        if b["status"] != "completed":
            raise HTTPException(400, "Faqat yakunlangan qatnovni baholash mumkin")
        if user_id == b["passenger_id"]:
            return b["driver_id"], "provider"
        if user_id == b["driver_id"]:
            return b["passenger_id"], "client"
        raise HTTPException(403, "Ruxsat yo'q")

    r = await conn.fetchrow(
        "SELECT client_id, provider_id, status, service_type FROM service_requests WHERE id=$1", body.ref_id
    )
    if not r or r["service_type"] != body.service_type:
        raise HTTPException(404, "So'rov topilmadi")
    if r["status"] != "completed":
        raise HTTPException(400, "Faqat yakunlangan ishni baholash mumkin")
    if user_id == r["client_id"]:
        return r["provider_id"], "provider"
    if user_id == r["provider_id"]:
        return r["client_id"], "client"
    raise HTTPException(403, "Ruxsat yo'q")


async def recalc_user_rating(conn: asyncpg.Connection, user_id: int) -> None:
    prov = await conn.fetchrow(
        "SELECT AVG(rating) AS avg, COUNT(*) AS c FROM reviews WHERE target_user_id=$1 AND target_role='provider'",
        user_id,
    )
    client = await conn.fetchval(
        "SELECT AVG(rating) FROM reviews WHERE target_user_id=$1 AND target_role='client'", user_id
    )
    await conn.execute(
        """UPDATE users SET provider_rating=COALESCE($2, provider_rating), provider_reviews=$3,
               rating=COALESCE($4, rating) WHERE id=$1""",
        user_id, float(prov["avg"]) if prov["avg"] else None, prov["c"], float(client) if client else None,
    )


@router.post("", status_code=201)
async def create_review(body: ReviewIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    target_id, target_role = await _resolve_target(conn, body, user["id"])
    try:
        row = await conn.fetchrow(
            """INSERT INTO reviews(service_type, ref_id, rater_id, target_user_id, target_role, rating, comment)
               VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *""",
            body.service_type, body.ref_id, user["id"], target_id, target_role, body.rating, body.comment,
        )
    except asyncpg.UniqueViolationError:
        raise HTTPException(409, "Siz allaqachon baho qo'ygansiz")
    await recalc_user_rating(conn, target_id)
    await notify(target_id, "review_new", f"⭐ Yangi baho: {body.rating}/5",
                 f"{user['first_name']}: {body.comment or 'izohsiz'}", {"review_id": row["id"]},
                 telegram=False)
    return dict(row)


@router.get("/user/{user_id}")
async def user_reviews(user_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        """SELECT r.*, u.first_name AS rater_name FROM reviews r JOIN users u ON u.id=r.rater_id
           WHERE r.target_user_id=$1 ORDER BY r.created_at DESC LIMIT 50""",
        user_id,
    )
    stats = await conn.fetchrow(
        """SELECT COALESCE(AVG(rating),0) AS avg, COUNT(*) AS total FROM reviews WHERE target_user_id=$1""", user_id
    )
    return {"reviews": [dict(r) for r in rows], "average": round(float(stats["avg"]), 2), "total": stats["total"]}
