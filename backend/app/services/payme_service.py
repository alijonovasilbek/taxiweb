import base64
import asyncpg
from app.config import settings


def _verify_auth(auth_header: str | None) -> bool:
    if not auth_header or not auth_header.startswith("Basic "):
        return False
    decoded = base64.b64decode(auth_header[6:]).decode()
    _, password = decoded.split(":", 1) if ":" in decoded else ("", "")
    secret = settings.payme_test_secret_key if settings.payme_is_test else settings.payme_secret_key
    return password == secret


async def handle_webhook(method: str, params: dict, auth_header: str | None, conn: asyncpg.Connection) -> dict:
    if not _verify_auth(auth_header):
        return {"error": {"code": -32504, "message": "Insufficient privilege"}}

    match method:
        case "CheckPerformTransaction":
            return await _check_perform(params, conn)
        case "CreateTransaction":
            return await _create_transaction(params, conn)
        case "PerformTransaction":
            return await _perform_transaction(params, conn)
        case "CancelTransaction":
            return await _cancel_transaction(params, conn)
        case "CheckTransaction":
            return await _check_transaction(params, conn)
        case _:
            return {"error": {"code": -32601, "message": "Method not found"}}


async def _check_perform(params: dict, conn: asyncpg.Connection) -> dict:
    order_id = params.get("account", {}).get("order_id")
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", order_id)
    if not order:
        return {"error": {"code": -31050, "message": "Order not found"}}
    if order["payment_status"] == "paid":
        return {"error": {"code": -31050, "message": "Already paid"}}
    if round(float(order["estimated_price"]) * 100) != params.get("amount"):
        return {"error": {"code": -31001, "message": "Wrong amount"}}
    return {"result": {"allow": True}}


async def _create_transaction(params: dict, conn: asyncpg.Connection) -> dict:
    ext_id = params["id"]
    order_id = params.get("account", {}).get("order_id")
    amount = params.get("amount", 0)
    payment = await conn.fetchrow("SELECT * FROM payments WHERE external_id=$1", ext_id)
    if not payment:
        payment = await conn.fetchrow(
            "INSERT INTO payments(order_id,amount,method,status,external_id) VALUES($1,$2,'payme','processing',$3) RETURNING *",
            order_id, amount / 100, ext_id,
        )
    import time
    return {"result": {"create_time": int(time.time() * 1000), "transaction": str(payment["id"]), "state": 1}}


async def _perform_transaction(params: dict, conn: asyncpg.Connection) -> dict:
    from app.socket_manager import sio
    import time
    payment = await conn.fetchrow("SELECT * FROM payments WHERE external_id=$1", params["id"])
    if not payment:
        return {"error": {"code": -31003, "message": "Transaction not found"}}
    await conn.execute("UPDATE payments SET status='completed',completed_at=NOW() WHERE id=$1", payment["id"])
    await conn.execute("UPDATE orders SET payment_status='paid' WHERE id=$1", payment["order_id"])
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", payment["order_id"])
    if order:
        data = {"order_id": payment["order_id"], "amount": float(payment["amount"]), "method": "payme"}
        await sio.emit("payment_confirmed", data, room=f"passenger:{order['passenger_id']}")
        if order["driver_id"]:
            await sio.emit("payment_confirmed", data, room=f"driver:{order['driver_id']}")
    return {"result": {"transaction": str(payment["id"]), "perform_time": int(time.time() * 1000), "state": 2}}


async def _cancel_transaction(params: dict, conn: asyncpg.Connection) -> dict:
    import time
    payment = await conn.fetchrow("SELECT * FROM payments WHERE external_id=$1", params["id"])
    if not payment:
        return {"error": {"code": -31003, "message": "Transaction not found"}}
    await conn.execute("UPDATE payments SET status='failed' WHERE id=$1", payment["id"])
    return {"result": {"transaction": str(payment["id"]), "cancel_time": int(time.time() * 1000), "state": -1}}


async def _check_transaction(params: dict, conn: asyncpg.Connection) -> dict:
    payment = await conn.fetchrow("SELECT * FROM payments WHERE external_id=$1", params["id"])
    if not payment:
        return {"error": {"code": -31003, "message": "Transaction not found"}}
    state_map = {"processing": 1, "completed": 2, "failed": -1}
    return {"result": {"transaction": str(payment["id"]), "state": state_map.get(payment["status"], 1)}}
