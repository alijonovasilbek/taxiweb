from fastapi import APIRouter, Depends
from app.database import get_db
from app.auth import get_current_user
import asyncpg

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM users WHERE id=$1", user["id"])
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "User not found")
    return dict(row)


@router.put("/me")
async def update_me(body: dict, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        "UPDATE users SET phone=$2,language=$3,updated_at=NOW() WHERE id=$1 RETURNING *",
        user["id"], body.get("phone"), body.get("language", "uz"),
    )
    return dict(row)


@router.get("/me/rides")
async def get_rides(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM orders WHERE passenger_id=$1 ORDER BY created_at DESC LIMIT 50", user["id"]
    )
    return [dict(r) for r in rows]


@router.get("/me/ratings")
async def get_ratings(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM ratings WHERE rated_user_id=$1 ORDER BY created_at DESC", user["id"]
    )
    return [dict(r) for r in rows]
