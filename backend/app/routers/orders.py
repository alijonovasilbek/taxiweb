from fastapi import APIRouter, Depends, HTTPException
from app.database import get_db
from app.auth import get_current_user
from app.schemas.order import CreateOrderRequest, CancelOrderRequest
from app.services.order_service import create_order, accept_order, complete_order
from app.services.yandex_service import get_route
from app.services.pricing_service import estimate_price
from app.socket_manager import sio
import asyncpg

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post("", status_code=201)
async def create(body: CreateOrderRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    route = await get_route(body.pickup.lat, body.pickup.lng, body.dropoff.lat, body.dropoff.lng)
    price, _ = await estimate_price(conn, route["distance_km"], route["duration_min"])
    order = await create_order(
        conn,
        passenger_id=user["id"],
        pickup=body.pickup.model_dump(),
        dropoff=body.dropoff.model_dump(),
        distance_km=route["distance_km"],
        duration_min=route["duration_min"],
        price=price,
        payment_method=body.payment_method,
    )
    return {**order, "estimated_price": price, "route": route}


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
    return dict(row) if row else None


@router.get("/{order_id}")
async def get_by_id(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", order_id)
    if not row:
        raise HTTPException(404, "Order not found")
    return dict(row)


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
    order = await conn.fetchrow("SELECT passenger_id FROM orders WHERE id=$1", order_id)
    if order:
        await sio.emit("order_rejected", {"order_id": order_id, "reason": body.reason}, room=f"passenger:{order['passenger_id']}")
    return {"success": True}


@router.put("/{order_id}/arrived")
async def arrived(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    row = await conn.fetchrow(
        "UPDATE orders SET status='driver_arrived',arrived_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
        order_id, driver["id"],
    )
    if row:
        await sio.emit("driver_arrived", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")
    return {"success": True}


@router.put("/{order_id}/start")
async def start_ride(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    row = await conn.fetchrow(
        "UPDATE orders SET status='in_progress',started_at=NOW() WHERE id=$1 AND driver_id=$2 RETURNING passenger_id",
        order_id, driver["id"],
    )
    if row:
        await sio.emit("ride_started", {"order_id": order_id}, room=f"passenger:{row['passenger_id']}")
    return {"success": True}


@router.put("/{order_id}/complete")
async def complete(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    driver = await conn.fetchrow("SELECT id FROM drivers WHERE telegram_id=$1", user.get("telegram_id"))
    if not driver:
        raise HTTPException(404, "Driver not found")
    await complete_order(conn, order_id, driver["id"])
    return {"success": True}


@router.put("/{order_id}/cancel")
async def cancel(order_id: int, body: CancelOrderRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    cancelled_by = "driver" if user.get("role") == "driver" else "passenger"
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

    if row["driver_id"]:
        await conn.execute("UPDATE drivers SET is_on_ride=false WHERE id=$1", row["driver_id"])

    target_room = f"passenger:{row['passenger_id']}" if cancelled_by == "driver" else (f"driver:{row['driver_id']}" if row["driver_id"] else None)
    if target_room:
        await sio.emit(
            "order_cancelled",
            {"order_id": order_id, "reason": reason, "cancelled_by": cancelled_by},
            room=target_room,
        )
    return {"success": True}
