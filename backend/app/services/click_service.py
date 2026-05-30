import hashlib
import asyncpg
from app.config import settings


def _verify_sign(data: dict) -> bool:
    raw = (f"{data.get('click_trans_id')}{settings.click_service_id}"
           f"{settings.click_secret_key}{data.get('merchant_trans_id')}"
           f"{data.get('amount')}{data.get('action')}{data.get('sign_time')}")
    return hashlib.md5(raw.encode()).hexdigest() == data.get("sign_string")


async def handle_prepare(data: dict, conn: asyncpg.Connection) -> dict:
    if not _verify_sign(data):
        return {"error": -1, "error_note": "SIGN CHECK FAILED!"}
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", data.get("merchant_trans_id"))
    if not order:
        return {"error": -5, "error_note": "Order not found"}
    if order["payment_status"] == "paid":
        return {"error": -4, "error_note": "Already paid"}
    payment = await conn.fetchrow(
        "INSERT INTO payments(order_id,amount,method,status,external_id) VALUES($1,$2,'click','processing',$3) RETURNING *",
        order["id"], float(data.get("amount", 0)), str(data.get("click_trans_id")),
    )
    return {"click_trans_id": data["click_trans_id"], "merchant_trans_id": data["merchant_trans_id"],
            "merchant_prepare_id": payment["id"], "error": 0, "error_note": "Success"}


async def handle_complete(data: dict, conn: asyncpg.Connection) -> dict:
    from app.socket_manager import sio
    payment = await conn.fetchrow("SELECT * FROM payments WHERE id=$1", data.get("merchant_prepare_id"))
    if not payment:
        return {"error": -6, "error_note": "Transaction not found"}
    if int(data.get("error", 0)) < 0:
        await conn.execute("UPDATE payments SET status='failed' WHERE id=$1", payment["id"])
        return {"error": 0, "error_note": "cancelled"}
    await conn.execute("UPDATE payments SET status='completed',completed_at=NOW() WHERE id=$1", payment["id"])
    await conn.execute("UPDATE orders SET payment_status='paid' WHERE id=$1", payment["order_id"])
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", payment["order_id"])
    if order:
        ev_data = {"order_id": payment["order_id"], "amount": float(payment["amount"]), "method": "click"}
        await sio.emit("payment_confirmed", ev_data, room=f"passenger:{order['passenger_id']}")
        if order["driver_id"]:
            await sio.emit("payment_confirmed", ev_data, room=f"driver:{order['driver_id']}")
    return {"click_trans_id": data["click_trans_id"], "merchant_trans_id": data["merchant_trans_id"],
            "merchant_confirm_id": payment["id"], "error": 0, "error_note": "Success"}
