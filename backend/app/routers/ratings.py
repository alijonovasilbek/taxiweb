from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.auth import get_current_user
from app.schemas.driver import RatingRequest
import asyncpg

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("", status_code=201)
async def create(body: RatingRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    if not (1 <= body.rating <= 5):
        raise HTTPException(400, "Rating must be 1-5")
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1 AND status='completed'", body.order_id)
    if not order:
        raise HTTPException(400, "Order not completed")
    existing = await conn.fetchrow("SELECT id FROM ratings WHERE order_id=$1 AND rater_id=$2", body.order_id, user["id"])
    if existing:
        raise HTTPException(409, "Already rated")

    if body.target_role == "driver":
        await conn.execute(
            "INSERT INTO ratings(order_id,rater_id,rated_driver_id,rating,comment) VALUES($1,$2,$3,$4,$5)",
            body.order_id, user["id"], order["driver_id"], body.rating, body.comment,
        )
        avg = await conn.fetchval("SELECT AVG(rating) FROM ratings WHERE rated_driver_id=$1", order["driver_id"])
        await conn.execute("UPDATE drivers SET rating=$2 WHERE id=$1", order["driver_id"], float(avg or 5))
        await conn.execute("UPDATE orders SET passenger_rated=true WHERE id=$1", body.order_id)
    else:
        await conn.execute(
            "INSERT INTO ratings(order_id,rater_id,rated_user_id,rating,comment) VALUES($1,$2,$3,$4,$5)",
            body.order_id, user["id"], order["passenger_id"], body.rating, body.comment,
        )
        avg = await conn.fetchval("SELECT AVG(rating) FROM ratings WHERE rated_user_id=$1", order["passenger_id"])
        await conn.execute("UPDATE users SET rating=$2 WHERE id=$1", order["passenger_id"], float(avg or 5))
        await conn.execute("UPDATE orders SET driver_rated=true WHERE id=$1", body.order_id)

    return {"success": True}


@router.get("/driver/{driver_id}")
async def driver_ratings(driver_id: int, conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM ratings WHERE rated_driver_id=$1 ORDER BY created_at DESC LIMIT 20", driver_id)
    avg = await conn.fetchval("SELECT AVG(rating) FROM ratings WHERE rated_driver_id=$1", driver_id)
    return {"ratings": [dict(r) for r in rows], "average": round(float(avg or 0), 2)}


@router.get("/user/{user_id}")
async def user_ratings(user_id: int, conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch("SELECT * FROM ratings WHERE rated_user_id=$1 ORDER BY created_at DESC LIMIT 20", user_id)
    avg = await conn.fetchval("SELECT AVG(rating) FROM ratings WHERE rated_user_id=$1", user_id)
    return {"ratings": [dict(r) for r in rows], "average": round(float(avg or 0), 2)}
