import asyncio
import asyncpg
from app.services.matching_service import find_nearest_drivers
from app.services.bot_retry import with_retry
from app.services.notification_service import send_to_passenger

ORDER_TIMEOUT_SEC = 30


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
    asyncio.create_task(_dispatch(conn, order))
    return order


async def _dispatch(conn: asyncpg.Connection, order: dict):
    from app.socket_manager import sio
    from app.database import pool

    await asyncio.sleep(0)  # yield to event loop

    async with pool.acquire() as c:
        drivers = await find_nearest_drivers(c, order["pickup_lat"], order["pickup_lng"])
        passenger = await c.fetchrow("SELECT * FROM users WHERE id=$1", order["passenger_id"])

    if not drivers:
        from app.database import pool
        async with pool.acquire() as c:
            await c.execute("UPDATE orders SET status='no_drivers' WHERE id=$1", order["id"])
        await sio.emit("no_drivers_found", {"order_id": order["id"]}, room=f"passenger:{order['passenger_id']}")
        return

    order_data = {
        "order_id": order["id"],
        "pickup": {"address": order["pickup_address"], "lat": float(order["pickup_lat"]), "lng": float(order["pickup_lng"])},
        "dropoff": {"address": order["dropoff_address"], "lat": float(order["dropoff_lat"]), "lng": float(order["dropoff_lng"])},
        "distance_km": float(order["distance_km"] or 0),
        "duration_min": order["duration_min"] or 0,
        "price": float(order["estimated_price"]),
        "passenger_rating": float(passenger["rating"]) if passenger else 5.0,
        "timeout": ORDER_TIMEOUT_SEC,
    }

    for driver in drivers:
        await sio.emit("new_order", order_data, room=f"driver:{driver['id']}")
        asyncio.create_task(_driver_timeout(driver["id"], order["id"]))
        asyncio.create_task(_notify_driver_bot(driver, order_data))

    asyncio.create_task(_order_timeout(order["id"], order["passenger_id"]))


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
        print(f"[bot] driver notify error: {e}")


async def _driver_timeout(driver_id: int, order_id: int):
    from app.socket_manager import sio
    await asyncio.sleep(ORDER_TIMEOUT_SEC)
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT status FROM orders WHERE id=$1", order_id)
    if row and row["status"] == "searching":
        await sio.emit("new_order_timeout", {"order_id": order_id}, room=f"driver:{driver_id}")


async def _order_timeout(order_id: int, passenger_id: int):
    from app.socket_manager import sio
    await asyncio.sleep(ORDER_TIMEOUT_SEC + 5)
    from app.database import pool
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT status FROM orders WHERE id=$1", order_id)
        if row and row["status"] == "searching":
            await conn.execute("UPDATE orders SET status='no_drivers' WHERE id=$1", order_id)
    await sio.emit("no_drivers_found", {"order_id": order_id}, room=f"passenger:{passenger_id}")


async def accept_order(conn: asyncpg.Connection, order_id: int, driver_id: int):
    from app.socket_manager import sio
    row = await conn.fetchrow("SELECT * FROM orders WHERE id=$1 AND status='searching'", order_id)
    if not row:
        raise ValueError("Order not available")

    await conn.execute(
        "UPDATE orders SET driver_id=$1, status='accepted', accepted_at=NOW() WHERE id=$2",
        driver_id, order_id,
    )
    await conn.execute("UPDATE drivers SET is_on_ride=true WHERE id=$1", driver_id)

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
