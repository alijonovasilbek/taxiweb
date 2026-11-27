import asyncio
import asyncpg
from app.log import log
from app.services.matching_service import find_drivers_expanding
from app.services.bot_retry import with_retry
from app.services.notification_service import send_to_passenger

async def create_order(conn: asyncpg.Connection, passenger_id: int, pickup: dict, dropoff: dict,
                       distance_km: float, duration_min: int, price: float, payment_method: str) -> dict:
    row = await conn.fetchrow(
        """INSERT INTO orders(
               passenger_id, pickup_address, pickup_lat, pickup_lng, pickup_location,
               dropoff_address, dropoff_lat, dropoff_lng, dropoff_location,
               distance_km, duration_min, estimated_price, payment_method, status
           ) VALUES(
               $1, $2, $3, $4, ST_MakePoint($5, $6)::geography,
               $7, $8, $9, ST_MakePoint($10, $11)::geography,
               $12, $13, $14, $15, 'searching'
           ) RETURNING *""",
        passenger_id,
        pickup["address"], pickup["lat"], pickup["lng"],
        pickup["lng"], pickup["lat"],
        dropoff["address"], dropoff["lat"], dropoff["lng"],
        dropoff["lng"], dropoff["lat"],
        distance_km, duration_min, price, payment_method,
    )
    order = dict(row)
    from app.tasks import spawn
    spawn(_dispatch(conn, order), name=f"dispatch:{order['id']}")
    return order


# Har bir buyurtma uchun "joriy haydovchi javob berdi / buyurtma o'zgardi" signali (bitta jarayon ichida)
_offer_events: dict[int, asyncio.Event] = {}


def _wake(order_id: int) -> None:
    ev = _offer_events.get(order_id)
    if ev:
        ev.set()


def _order_payload(order: dict, passenger) -> dict:
    from app.config import settings
    return {
        "order_id": order["id"],
        "pickup": {"address": order["pickup_address"], "lat": float(order["pickup_lat"]), "lng": float(order["pickup_lng"])},
        "dropoff": {"address": order["dropoff_address"], "lat": float(order["dropoff_lat"]), "lng": float(order["dropoff_lng"])},
        "distance_km": float(order["distance_km"] or 0),
        "duration_min": order["duration_min"] or 0,
        "price": float(order["estimated_price"]),
        "payment_method": order.get("payment_method") or "cash",
        "passenger_rating": float(passenger["rating"]) if passenger else 5.0,
        "timeout": settings.offer_timeout_sec,
    }


async def _dispatch(conn: asyncpg.Connection, order: dict):
    """Buyurtmani yaqin haydovchilarga KETMA-KET taklif qiladi (PLAN-ANDROID B7).

    Eng yaqiniga `offer_timeout_sec` soniya; rad etsa yoki javob bermasa — keyingisiga. Shunda ilovadagi
    to'liq ekranli "qo'ng'iroq" hammani birdan bezovta qilmaydi va qabul qilish poygasi bo'lmaydi.
    """
    from app.config import settings
    from app.database import pool
    from app.services import push
    from app.socket_manager import sio

    await asyncio.sleep(0)
    order_id = order["id"]
    async with pool.acquire() as c:
        drivers = await find_drivers_expanding(c, order["pickup_lat"], order["pickup_lng"])
        passenger = await c.fetchrow("SELECT * FROM users WHERE id=$1", order["passenger_id"])
    order_data = _order_payload(order, passenger)
    ev = _offer_events.setdefault(order_id, asyncio.Event())
    try:
        for driver in drivers[: settings.max_offer_drivers]:
            async with pool.acquire() as c:
                if await c.fetchval("SELECT status FROM orders WHERE id=$1", order_id) != "searching":
                    return
                offered = await c.fetchval(
                    """INSERT INTO order_offers(order_id, driver_id, distance_km)
                       SELECT $1, d.id, $3 FROM drivers d
                       WHERE d.id=$2 AND d.is_online AND NOT d.is_on_ride AND d.status='approved'
                       ON CONFLICT (order_id, driver_id) DO NOTHING RETURNING id""",
                    order_id, driver["id"], round(float(driver["distance_km"] or 0), 2),
                )
                user_id = await c.fetchval("SELECT user_id FROM drivers WHERE id=$1", driver["id"])
            if not offered:
                continue  # shu orada band bo'ldi yoki oflayn
            ev.clear()
            payload = {**order_data, "distance_to_pickup_km": round(float(driver["distance_km"] or 0), 2)}
            await sio.emit("new_order", payload, room=f"driver:{driver['id']}")
            if user_id:
                push.fire(user_id, {"type": "new_order", **payload}, urgent=True, ttl=settings.offer_timeout_sec)
            from app.tasks import spawn
            spawn(_notify_driver_bot(driver, order_data), name="notify_driver_bot")
            try:
                await asyncio.wait_for(ev.wait(), settings.offer_timeout_sec)
            except asyncio.TimeoutError:
                pass
            async with pool.acquire() as c:
                expired = await c.fetchval(
                    """UPDATE order_offers SET status='expired', answered_at=NOW()
                       WHERE order_id=$1 AND driver_id=$2 AND status='offered' RETURNING id""",
                    order_id, driver["id"])
            if expired:
                await sio.emit("new_order_timeout", {"order_id": order_id}, room=f"driver:{driver['id']}")
        async with pool.acquire() as c:
            changed = await c.fetchval(
                "UPDATE orders SET status='no_drivers' WHERE id=$1 AND status='searching' RETURNING id", order_id)
        if changed:
            await sio.emit("no_drivers_found", {"order_id": order_id}, room=f"passenger:{order['passenger_id']}")
    finally:
        _offer_events.pop(order_id, None)


async def reject_offer(conn: asyncpg.Connection, order_id: int, driver_id: int) -> bool:
    """Haydovchi rad etdi — darhol keyingi haydovchiga o'tiladi."""
    done = await conn.fetchval(
        """UPDATE order_offers SET status='rejected', answered_at=NOW()
           WHERE order_id=$1 AND driver_id=$2 AND status='offered' RETURNING id""", order_id, driver_id)
    if done:
        _wake(order_id)
    return bool(done)


async def close_offers(conn: asyncpg.Connection, order_id: int) -> None:
    """Buyurtma bekor qilindi — ochiq taklif ekrani haydovchida yopilsin."""
    from app.socket_manager import sio
    rows = await conn.fetch(
        """UPDATE order_offers SET status='cancelled', answered_at=NOW()
           WHERE order_id=$1 AND status='offered' RETURNING driver_id""", order_id)
    for r in rows:
        await sio.emit("new_order_timeout", {"order_id": order_id}, room=f"driver:{r['driver_id']}")
    _wake(order_id)


async def _notify_driver_bot(driver: dict, order_data: dict):
    from app.services.notification_service import _bot
    from app.config import settings
    if not _bot:
        return
    try:
        pickup = order_data["pickup"]["address"]
        dropoff = order_data["dropoff"]["address"]
        dist = order_data["distance_km"]
        price = int(order_data["price"])
        text = (
            f"🚖 Yangi buyurtma!\n\n"
            f"📍 {pickup}\n"
            f"🏁 {dropoff}\n\n"
            f"📏 {dist} km · 💰 {price:,} so'm\n\n"
            f"Qabul qilish uchun ilovani oching 👇"
        )
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Ilovani ochish", url=settings.driver_app_url)
        ]])
        await with_retry(
            lambda: _bot.send_message(driver["telegram_id"], text, reply_markup=kb),
            label="notify_driver_bot",
        )
    except Exception as e:
        log.warning(f"[bot] driver notify error: {e}")


async def accept_order(conn: asyncpg.Connection, order_id: int, driver_id: int):
    from app.socket_manager import sio
    async with conn.transaction():
        # Haydovchi tasdiqlangan, onlayn va bo'sh bo'lishi shart; band qilish ham shu yerda (qulf bilan)
        drv = await conn.fetchrow(
            """UPDATE drivers SET is_on_ride=true
               WHERE id=$1 AND status='approved' AND is_online AND NOT is_on_ride RETURNING id""", driver_id)
        if not drv:
            raise ValueError("Driver not available")
        # Faqat shu haydovchiga taklif qilingan va muddati o'tmagan buyurtmani qabul qilish mumkin
        offer = await conn.fetchval(
            """UPDATE order_offers SET status='accepted', answered_at=NOW()
               WHERE order_id=$1 AND driver_id=$2 AND status='offered' RETURNING id""", order_id, driver_id)
        if not offer:
            raise ValueError("Bu buyurtma sizga taklif qilinmagan yoki muddati o'tgan")
        # Atomar: faqat birinchi qabul qilgan haydovchi oladi
        row = await conn.fetchrow(
            """UPDATE orders SET driver_id=$1, status='accepted', accepted_at=NOW()
               WHERE id=$2 AND status='searching' AND passenger_id <> COALESCE(
                   (SELECT user_id FROM drivers WHERE id=$1), -1)
               RETURNING *""", driver_id, order_id)
        if not row:
            raise ValueError("Order not available")  # tranzaksiya bekor → haydovchi band qilinmaydi
    _wake(order_id)

    driver = await conn.fetchrow("SELECT * FROM drivers WHERE id=$1", driver_id)
    await sio.emit(
        "order_accepted",
        {
            "order_id": order_id,
            "driver": {
                "name": f"{driver['first_name']} {driver['last_name']}",
                "phone": driver["phone"],
                "car_model": driver["car_model"],
                "car_number": driver["car_number"],
                "car_color": driver["car_color"],
                "rating": float(driver["rating"]),
            },
        },
        room=f"passenger:{row['passenger_id']}",
    )
    await send_to_passenger(row["passenger_id"], f"Haydovchi {driver['first_name']} buyurtmangizni qabul qildi!")


async def complete_order(conn: asyncpg.Connection, order_id: int, driver_id: int):
    from app.socket_manager import sio
    row = await conn.fetchrow("SELECT * FROM orders WHERE id=$1 AND driver_id=$2", order_id, driver_id)
    if not row:
        return

    payment_status = "paid" if row["payment_method"] == "cash" else "pending"
    await conn.execute(
        """UPDATE orders SET status='completed', completed_at=NOW(),
           final_price=estimated_price, payment_status=$3 WHERE id=$1 AND driver_id=$2""",
        order_id, driver_id, payment_status,
    )
    await conn.execute(
        """UPDATE drivers SET is_on_ride=false, total_rides=total_rides+1,
           total_earnings=total_earnings+$2 WHERE id=$1""",
        driver_id, float(row["estimated_price"]),
    )
    await conn.execute("UPDATE users SET total_rides=total_rides+1 WHERE id=$1", row["passenger_id"])

    await sio.emit(
        "ride_completed",
        {"order_id": order_id, "final_price": float(row["estimated_price"])},
        room=f"passenger:{row['passenger_id']}",
    )
    await sio.emit(
        "ride_completed",
        {"order_id": order_id, "final_price": float(row["estimated_price"])},
        room=f"driver:{driver_id}",
    )
