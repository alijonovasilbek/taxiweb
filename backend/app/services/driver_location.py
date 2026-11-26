"""Haydovchi joylashuvini qayd qilish — socket (Mini App) va REST paketi (Android fon xizmati) uchun umumiy."""
import json

from app.log import log


async def record_location(conn, driver_id: int, points: list[dict]) -> int:
    """`points` vaqt bo'yicha o'sib boradi; oxirgisi joriy joylashuv. Safarda bo'lsa barchasi tarixga yoziladi.

    Har bir nuqta: {lat, lng, heading?, speed?, ts?(datetime)}. Qabul qilingan nuqtalar sonini qaytaradi.
    """
    from app.redis_client import get_redis
    from app.socket_manager import sio

    if not points:
        return 0
    last = points[-1]
    lat, lng = last["lat"], last["lng"]
    r = get_redis()
    if r is not None:
        try:
            await r.setex(f"driver:loc:{driver_id}", 30, json.dumps(
                {"lat": lat, "lng": lng, "heading": last.get("heading"), "speed": last.get("speed")}))
        except Exception as e:  # Redis bo'lmasa ham PostgreSQL yetarli
            log.warning(f"[location] redis: {e}")
    await conn.execute(
        """UPDATE drivers SET current_location=ST_MakePoint($2,$1)::geography, last_location_update=NOW()
           WHERE id=$3""",
        lat, lng, driver_id,
    )
    ride = await conn.fetchrow(
        """SELECT id, passenger_id FROM orders
           WHERE driver_id=$1 AND status IN ('accepted','driver_arrived','in_progress') LIMIT 1""",
        driver_id,
    )
    if ride:
        await conn.executemany(
            """INSERT INTO driver_location_history(driver_id, order_id, location)
               VALUES($1,$2,ST_MakePoint($4,$3)::geography)""",
            [(driver_id, ride["id"], p["lat"], p["lng"]) for p in points],
        )
        await sio.emit("driver_location", {"order_id": ride["id"], "lat": lat, "lng": lng, "heading": last.get("heading")},
                       room=f"passenger:{ride['passenger_id']}")
    await sio.emit("driver_location_update", {"driver_id": driver_id, "lat": lat, "lng": lng}, room="admin")
    return len(points)
