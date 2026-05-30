from fastapi import APIRouter, Depends, Request, HTTPException
from app.database import get_db
from app.auth import get_current_user
from app.schemas.payment import PaymentCreateRequest
from app.services import payme_service, click_service
from app.config import settings
import asyncpg

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/payme/create")
async def payme_create(body: PaymentCreateRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    amount = round(float(order["estimated_price"]) * 100)
    import json, base64
    params = base64.b64encode(json.dumps({"m": settings.payme_merchant_id, "ac": {"order_id": body.order_id}, "a": amount}).encode()).decode()
    prefix = "test." if settings.payme_is_test else ""
    return {"url": f"https://{prefix}checkout.paycom.uz/{params}", "amount": amount}


@router.post("/payme/verify")
async def payme_webhook(request: Request, conn: asyncpg.Connection = Depends(get_db)):
    body = await request.json()
    auth = request.headers.get("Authorization")
    result = await payme_service.handle_webhook(body.get("method", ""), body.get("params", {}), auth, conn)
    return {"jsonrpc": "2.0", "id": body.get("id"), **result}


@router.post("/click/create")
async def click_create(body: PaymentCreateRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    order = await conn.fetchrow("SELECT estimated_price FROM orders WHERE id=$1", body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    url = (f"https://my.click.uz/services/pay?service_id={settings.click_service_id}"
           f"&merchant_id={settings.click_merchant_id}"
           f"&amount={order['estimated_price']}&transaction_param={body.order_id}")
    return {"url": url}


@router.post("/click/verify")
async def click_webhook(request: Request, conn: asyncpg.Connection = Depends(get_db)):
    data = await request.json()
    if int(data.get("action", 0)) == 0:
        return await click_service.handle_prepare(data, conn)
    return await click_service.handle_complete(data, conn)


@router.post("/telegram/create")
async def telegram_create(body: PaymentCreateRequest, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    order = await conn.fetchrow("SELECT * FROM orders WHERE id=$1", body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return {"order_id": body.order_id, "amount": float(order["estimated_price"]), "currency": "UZS"}


@router.get("/{order_id}")
async def get_status(order_id: int, user=Depends(get_current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow("SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1", order_id)
    return dict(row) if row else {"status": "not_found"}
