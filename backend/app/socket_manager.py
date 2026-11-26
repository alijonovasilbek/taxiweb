import socketio
from app.log import log
from app.config import settings
from app.auth import decode_token

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins,
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        return False
    try:
        payload = decode_token(token)
    except Exception:
        try:  # admin panel tokeni alohida kalit bilan imzolangan
            from app.config import settings
            payload = decode_token(token, settings.admin_jwt_secret or settings.jwt_secret)
            if payload.get("role") != "admin":
                return False
        except Exception:
            return False
    if payload.get("sid"):
        from app.auth import session_revoked
        if await session_revoked(payload["sid"]):
            return False
    await sio.save_session(sid, payload)
    if payload.get("sid"):
        # Ilova sessiyasi yopilsa (chiqish, bloklash) — shu xona orqali ulanishlar uziladi
        await sio.enter_room(sid, f"session:{payload['sid']}")

    role = payload.get("role")
    if role == "driver":
        driver_id = payload.get("driver_id")
        if driver_id:
            await sio.enter_room(sid, f"driver:{driver_id}")
    elif role == "passenger":
        user_id = payload.get("id")
        if user_id:
            await sio.enter_room(sid, f"passenger:{user_id}")
    elif role == "admin":
        await sio.enter_room(sid, "admin")

    # Chortoq Services: yagona foydalanuvchi xonasi (barcha servislar bildirishnomalari)
    if payload.get("id"):
        await sio.enter_room(sid, f"user:{payload['id']}")
        # Yagona akkaunt: tasdiqlangan taksi haydovchisi bo'lsa — haydovchi xonasi ham (new_order va h.k.)
        if not payload.get("driver_id") and payload.get("telegram_id"):
            from app.database import pool
            async with pool.acquire() as conn:
                drv = await conn.fetchrow(
                    "SELECT id FROM drivers WHERE telegram_id=$1 AND status='approved'", payload["telegram_id"]
                )
            if drv:
                await sio.save_session(sid, {**payload, "driver_id": drv["id"]})
                await sio.enter_room(sid, f"driver:{drv['id']}")

    log.info(f"[socket] connected {sid} role={role}")


async def kick_sessions(session_ids: list[int]) -> None:
    """Bekor qilingan ilova sessiyalarining ochiq socket ulanishlarini uzadi. KAMCHILIKLAR-ANDROID.md #10"""
    for s_id in session_ids:
        room = f"session:{s_id}"
        try:
            await sio.emit("session_revoked", {}, room=room)
            for sock, _ in list(sio.manager.get_participants("/", room)):
                await sio.disconnect(sock)
        except Exception as e:  # pragma: no cover
            log.warning(f"[socket] kick {s_id}: {e}")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    if session.get("role") == "driver":
        driver_id = session.get("driver_id")
        if driver_id:
            from app.database import pool
            if pool:
                async with pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE drivers SET is_online=false WHERE id=$1", driver_id
                    )
    log.info(f"[socket] disconnected {sid}")


# ─── Driver events ────────────────────────────────────────────────────────────

@sio.on("driver:go_online")
async def driver_go_online(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    if not driver_id:
        return
    lat, lng = data.get("lat"), data.get("lng")
    from app.database import pool
    import json
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE drivers SET is_online=true,
               current_location=ST_MakePoint($2,$1)::geography,
               last_location_update=NOW() WHERE id=$3""",
            lat, lng, driver_id,
        )
    from app.redis_client import redis
    await redis.setex(f"driver:loc:{driver_id}", 30, json.dumps({"lat": lat, "lng": lng}))
    await sio.emit("driver_online", {"driver_id": driver_id, "lat": lat, "lng": lng}, room="admin")


@sio.on("driver:go_offline")
async def driver_go_offline(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    if not driver_id:
        return
    from app.database import pool
    async with pool.acquire() as conn:
        await conn.execute("UPDATE drivers SET is_online=false WHERE id=$1", driver_id)
    from app.redis_client import redis
    await redis.delete(f"driver:loc:{driver_id}")
    await sio.emit("driver_offline", {"driver_id": driver_id}, room="admin")


@sio.on("driver:location_update")
async def driver_location_update(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    if not driver_id:
        return
    try:
        point = {"lat": float(data["lat"]), "lng": float(data["lng"]),
                 "heading": data.get("heading"), "speed": data.get("speed")}
    except (KeyError, TypeError, ValueError):
        return
    from app.database import pool
    from app.services.driver_location import record_location
    async with pool.acquire() as conn:
        await record_location(conn, driver_id, [point])


@sio.on("driver:accept_order")
async def driver_accept_order(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    order_id = data.get("order_id")
    if not driver_id or not order_id:
        return
    from app.database import pool
    from app.services.order_service import accept_order
    async with pool.acquire() as conn:
        try:
            await accept_order(conn, order_id, driver_id)
        except ValueError:
            await sio.emit("order_unavailable", {"order_id": order_id}, to=sid)


@sio.on("driver:reject_order")
async def driver_reject_order(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    order_id = data.get("order_id")
    if not driver_id or not order_id:
        return
    from app.database import pool
    from app.services.order_service import reject_offer
    async with pool.acquire() as conn:
        await reject_offer(conn, order_id, driver_id)


@sio.on("driver:arrived")
async def driver_arrived(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    order_id = data.get("order_id")
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE orders SET status='driver_arrived',arrived_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
            order_id, driver_id,
        )
        if row:
            await sio.emit("driver_arrived", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")


@sio.on("driver:start_ride")
async def driver_start_ride(sid, data):
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    order_id = data.get("order_id")
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE orders SET status='in_progress',started_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
            order_id, driver_id,
        )
        if row:
            await sio.emit("ride_started", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")


@sio.on("driver:complete_ride")
async def driver_complete_ride(sid, data):
    from app.services.order_service import complete_order
    session = await sio.get_session(sid)
    driver_id = session.get("driver_id")
    order_id = data.get("order_id")
    from app.database import pool
    async with pool.acquire() as conn:
        await complete_order(conn, order_id, driver_id)


# ─── Passenger events ─────────────────────────────────────────────────────────

@sio.on("passenger:track_order")
async def passenger_track_order(sid, data):
    session = await sio.get_session(sid)
    order_id = data.get("order_id")
    user_id = session.get("id")
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM orders WHERE id=$1 AND passenger_id=$2", order_id, user_id
        )
        if row:
            await sio.enter_room(sid, f"order:{order_id}")


@sio.on("passenger:cancel_order")
async def passenger_cancel_order(sid, data):
    session = await sio.get_session(sid)
    user_id = session.get("id")
    order_id = data.get("order_id")
    reason = data.get("reason", "Yo'lovchi bekor qildi")
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """UPDATE orders SET status='cancelled',cancelled_at=NOW(),cancel_reason=$3
               WHERE id=$1 AND passenger_id=$2 AND status IN ('searching','accepted')
               RETURNING driver_id""",
            order_id, user_id, reason,
        )
        if row:
            from app.services.order_service import close_offers
            await close_offers(conn, order_id)
        if row and row["driver_id"]:
            await conn.execute("UPDATE drivers SET is_on_ride=false WHERE id=$1", row["driver_id"])
            await sio.emit("order_cancelled", {"order_id": order_id, "reason": reason, "cancelled_by": "passenger"},
                           room=f"driver:{row['driver_id']}")


# ─── Admin events ─────────────────────────────────────────────────────────────

@sio.on("admin:join")
async def admin_join(sid, data):
    # Faqat admin tokeni bilan ulangan sessiya (aks holda istalgan foydalanuvchi haydovchilar joylashuvini ko'rardi)
    session = await sio.get_session(sid)
    from app.config import settings
    if session.get("role") != "admin" or session.get("telegram_id") not in settings.admin_ids:
        return
    await sio.enter_room(sid, "admin")
    from app.database import pool
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id,first_name,last_name,is_online,is_on_ride,
               ST_X(current_location::geometry) as lng,
               ST_Y(current_location::geometry) as lat
               FROM drivers WHERE status='approved' AND current_location IS NOT NULL"""
        )
    await sio.emit("admin:driver_locations", [dict(r) for r in rows], to=sid)
