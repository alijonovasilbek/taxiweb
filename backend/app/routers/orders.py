from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.auth import get_current_user
from app.schemas.order import CreateOrderRequest, CancelOrderRequest
from app.services.order_service import create_order, accept_order, complete_order, reject_offer, close_offers
from app.services import push
from app.services.yandex_service import resolve_route
from app.services.pricing_service import estimate_price, tariff_public
from app.socket_manager import sio
import asyncpg

router = APIRouter(prefix="/orders", tags=["orders"])


async def _driver_id(conn: asyncpg.Connection, user: dict) -> int | None:
    if user.get("driver_id"):
        return user["driver_id"]
    if user.get("telegram_id"):
        return await conn.fetchval("SELECT id FROM drivers WHERE telegram_id=$1", user["telegram_id"])
    return None


@router.post("", status_code=201)
async def create(body: CreateOrderRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    active = await conn.fetchval(
        "SELECT id FROM orders WHERE passenger_id=$1 AND status IN ('searching','accepted','driver_arrived','in_progress') LIMIT 1",
        user["id"],
    )
    if active:
        raise HTTPException(409, f"Sizda faol buyurtma bor (#{active}). Avval uni yakunlang yoki bekor qiling.")
    route = await resolve_route(body.pickup.lat, body.pickup.lng, body.dropoff.lat, body.dropoff.lng,
                                body.road_distance_km, body.road_duration_min)
    try:
        price, tariff = await estimate_price(conn, route["distance_km"], route["duration_min"], body.tariff_id)
    except LookupError as e:
        raise HTTPException(400, str(e))
    except ValueError:
        raise HTTPException(503, "Taksi tarifi sozlanmagan. Admin panel → Tarif bo'limida tarifni saqlang.")
    order = await create_order(
        conn,
        passenger_id=user["id"],
        pickup=body.pickup.model_dump(),
        dropoff=body.dropoff.model_dump(),
        distance_km=route["distance_km"],
        duration_min=route["duration_min"],
        price=price,
        payment_method=body.payment_method,
        tariff=tariff,
    )
    return {**order, "estimated_price": price, "route": route, "tariff": tariff_public(tariff)}


@router.get("/active")
async def get_active(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver_id = user.get("driver_id")
    if driver_id:
        row = await conn.fetchrow(
            "SELECT * FROM orders WHERE driver_id=$1 AND status NOT IN ('completed','cancelled','no_drivers') LIMIT 1",
            driver_id,
        )
    else:
        row = await conn.fetchrow(
            "SELECT * FROM orders WHERE passenger_id=$1 AND status NOT IN ('completed','cancelled','no_drivers') LIMIT 1",
            user["id"],
        )
        return await _with_driver(conn, row) if row else None
    return dict(row) if row else None


@router.get("/driver/active")
async def driver_active(user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    """Mini App ijrochi rejimi: haydovchining joriy taksi buyurtmasi (yo'lovchi ma'lumoti bilan)."""
    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        return {"driver": None, "order": None}
    row = await conn.fetchrow(
        """SELECT o.*, u.first_name AS passenger_name, u.phone AS passenger_phone, u.rating AS passenger_rating
           FROM orders o JOIN users u ON u.id=o.passenger_id
           WHERE o.driver_id=$1 AND o.status IN ('accepted','driver_arrived','in_progress')
           ORDER BY o.created_at DESC LIMIT 1""",
        driver["id"],
    )
    d = dict(driver)
    d.pop("password_hash", None)
    d.pop("current_location", None)
    return {"driver": d, "order": dict(row) if row else None}


@router.get("/{order_id}")
async def get_by_id(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", order_id)
    if not row:
        raise HTTPException(404, "Order not found")
    driver_id = await _driver_id(conn, user)
    if row["passenger_id"] != user.get("id") and (not driver_id or row["driver_id"] != driver_id):
        raise HTTPException(404, "Order not found")  # boshqaning buyurtmasi borligini ham oshkor qilmaymiz
    return await _with_driver(conn, row)


async def _with_driver(conn: asyncpg.Connection, row) -> dict:
    """Yo'lovchi uchun: haydovchi va mashina ma'lumoti hamda faol safarda uning joylashuvi (ilova qayta ochilsa ham)."""
    data = dict(row)
    data.pop("pickup_location", None)
    data.pop("dropoff_location", None)
    data["driver"] = None
    data["tariff_name"] = (await conn.fetchval("SELECT name FROM tariffs WHERE id=$1", row["tariff_id"])
                           if row.get("tariff_id") else None)
    if row["driver_id"]:
        d = await conn.fetchrow(
            """SELECT first_name, last_name, phone, car_model, car_number, car_color, rating,
                      ST_Y(current_location::geometry) AS lat, ST_X(current_location::geometry) AS lng
               FROM drivers WHERE id=$1""", row["driver_id"])
        if d:
            active = row["status"] in ("accepted", "driver_arrived", "in_progress")
            data["driver"] = {
                "name": f"{d['first_name']} {d['last_name']}".strip(), "phone": d["phone"],
                "car_model": d["car_model"], "car_number": d["car_number"], "car_color": d["car_color"],
                "rating": float(d["rating"] or 5),
                "lat": d["lat"] if active else None, "lng": d["lng"] if active else None,
            }
    return data


@router.put("/{order_id}/accept")
async def accept(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    try:
        await accept_order(conn, order_id, driver["id"])
    except ValueError as e:
        raise HTTPException(409, str(e))
    return {"success": True}


@router.put("/{order_id}/reject")
async def reject(order_id: int, body: CancelOrderRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver_id = await _driver_id(conn, user)
    if not driver_id:
        raise HTTPException(403, "Faqat haydovchi rad eta oladi")
    # Taklif keyingi haydovchiga o'tadi; yo'lovchiga xabar shart emas (u qidiruvni ko'rib turadi)
    return {"success": await reject_offer(conn, order_id, driver_id)}


@router.put("/{order_id}/arrived")
async def arrived(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    row = await conn.fetchrow(
        "UPDATE orders SET status='driver_arrived',arrived_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
        order_id, driver["id"],
    )
    if row:
        await sio.emit("driver_arrived", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")
        from app.services import push
        push.client_taxi(row["passenger_id"], "driver_arrived", order_id)
    return {"success": True}


@router.put("/{order_id}/start")
async def start_ride(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    row = await conn.fetchrow(
        "UPDATE orders SET status='in_progress',started_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
        order_id, driver["id"],
    )
    if row:
        await sio.emit("ride_started", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")
        from app.services import push
        push.client_taxi(row["passenger_id"], "ride_started", order_id)
    return {"success": True}


@router.put("/{order_id}/complete")
async def complete(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    await complete_order(conn, order_id, driver["id"])
    return {"success": True}


@router.put("/{order_id}/cancel")
async def cancel(order_id: int, body: CancelOrderRequest, as_driver: bool = False, user=Depends(get_current_user),
                 conn: asyncpg.Connection = Depends(get_db)):
    # Yagona akkauntda haydovchi tomonidan bekor qilish: ?as_driver=true
    cancelled_by = "driver" if (user.get("role") == "driver" or as_driver) else "passenger"
    reason = body.reason or "Bekor qilindi"

    if cancelled_by == "driver":
        driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
        if not driver:
            raise HTTPException(404, "Driver not found")
        row = await conn.fetchrow(
            """UPDATE orders
               SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2
               WHERE id=$1
                 AND driver_id=$3
                 AND status IN ('accepted','driver_arrived')
               RETURNING driver_id, passenger_id""",
            order_id, reason, driver["id"],
        )
    else:
        row = await conn.fetchrow(
            """UPDATE orders
               SET status='cancelled', cancelled_at=NOW(), cancel_reason=$2
               WHERE id=$1
                 AND passenger_id=$3
                 AND status IN ('searching','accepted','driver_arrived')
               RETURNING driver_id, passenger_id""",
            order_id, reason, user["id"],
        )

    if not row:
        raise HTTPException(409, "Order cannot be cancelled")

    await close_offers(conn, order_id)
    if row["driver_id"]:
        await conn.execute("UPDATE drivers SET is_on_ride=false WHERE id=$1", row["driver_id"])
        if cancelled_by == "passenger":  # ilova fonda bo'lsa ham haydovchi bilsin
            uid = await conn.fetchval("SELECT user_id FROM drivers WHERE id=$1", row["driver_id"])
            if uid:
                push.fire(uid, {"type": "order_cancelled", "order_id": order_id, "reason": reason},
                          title="Buyurtma bekor qilindi", body=reason)

    if cancelled_by == "driver":
        push.client_taxi(row["passenger_id"], "order_cancelled", order_id, reason or None)
    target_room = f"passenger:{row['passenger_id']}" if cancelled_by == "driver" else (f"driver:{row['driver_id']}" if row["driver_id"] else None)
    if target_room:
        await sio.emit(
            "order_cancelled",
            {"order_id": order_id, "reason": reason, "cancelled_by": cancelled_by},
            room=target_room,
        )
    return {"success": True}
