import json

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.deps import current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(limit: int = Query(50, ge=1, le=200), unread: bool = False,
                             user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    cond = "user_id=$1" + (" AND NOT is_read" if unread else "")
    rows = await conn.fetch(
        f"SELECT * FROM notifications WHERE {cond} ORDER BY created_at DESC LIMIT $2", user["id"], limit
    )
    count = await conn.fetchval("SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read", user["id"])
    return {"items": [_item(r) for r in rows], "unread": count}


def _item(r) -> dict:
    """asyncpg jsonb'ni matn qilib qaytaradi — mijozlar (Web App, ilova) `data.request_id` kabi obyekt kutadi."""
    d = dict(r)
    if isinstance(d.get("data"), str):
        try:
            d["data"] = json.loads(d["data"])
        except ValueError:
            d["data"] = {}
    return d


@router.get("/unread-count")
async def unread_count(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    return {"unread": await conn.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND NOT is_read", user["id"]
    )}


@router.put("/read-all")
async def read_all(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute("UPDATE notifications SET is_read=true WHERE user_id=$1 AND NOT is_read", user["id"])
    return {"success": True}


@router.put("/{notification_id}/read")
async def read_one(notification_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    await conn.execute(
        "UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2", notification_id, user["id"]
    )
    return {"success": True}
