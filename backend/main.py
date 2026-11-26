import asyncio
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.log import init_sentry, log

init_sentry()
from app.config import settings
from app.database import init_pool, close_pool
from app.redis_client import init_redis, close_redis
from app.socket_manager import sio
from app.routers import auth, users, drivers, orders, payments, ratings, maps, admin
from app.routers import (
    catalog, vehicles, schedules, carpool, requests as service_requests, reviews, notifications,
    search, admin_services, files, app_auth, mobile,
)


async def _run_bot():
    retry_delay = 3
    while True:
        bot_obj = None
        try:
            from app.bot.handlers import create_bot

            bot_obj, dp = create_bot()
            await bot_obj.delete_webhook(drop_pending_updates=False)
            log.info("[bot] webhook cleared, starting polling")
            await dp.start_polling(bot_obj, handle_signals=False)
        except asyncio.CancelledError:
            if bot_obj:
                await bot_obj.session.close()
            raise
        except Exception as e:
            log.warning(f"[bot] polling error: {e}")
            if bot_obj:
                try:
                    await bot_obj.session.close()
                except Exception:
                    pass
            await asyncio.sleep(retry_delay)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await init_pool()
    await init_redis()
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs("logs", exist_ok=True)

    # Telegram bot
    bot_task = None
    token = settings.telegram_bot_token
    if token and not token.startswith("0000000000"):
        try:
            bot_task = asyncio.create_task(_run_bot())
            log.info("[bot] Telegram bot polling started")
        except Exception as e:
            log.warning(f"[bot] Failed to start bot: {e}")
    else:
        log.warning("[bot] TELEGRAM_BOT_TOKEN not set or invalid — bot disabled")

    from app.services import maintenance
    maintenance_task = asyncio.create_task(maintenance.loop())

    log.info(f"[server] Chortoq Services backend started on port {settings.port}")
    yield

    maintenance_task.cancel()

    # ── Shutdown ──
    if bot_task:
        bot_task.cancel()
    await close_pool()
    await close_redis()
    log.info("[server] shutdown complete")


app = FastAPI(
    title="Chortoq Services API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

@app.middleware("http")
async def security_headers(request, call_next):
    """Brauzer fayl turini taxmin qilmasin (XSS'dan himoya), referer tashqariga to'liq ketmasin."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


AUDIT_PREFIXES = ("/api/admin", "/api/drivers", "/api/tariffs", "/api/dashboard", "/api/orders", "/api/payments")


@app.middleware("http")
async def admin_audit(request, call_next):
    """Admin tokeni bilan qilingan har bir o'zgartirish (POST/PUT/PATCH/DELETE) jurnalga yoziladi."""
    response = await call_next(request)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith(AUDIT_PREFIXES):
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            try:
                from app.auth import decode_token
                payload = decode_token(auth[7:], settings.admin_jwt_secret or settings.jwt_secret)
            except Exception:
                payload = None
            if payload and payload.get("role") == "admin":
                try:
                    from app import database
                    from app.security import client_ip
                    async with database.pool.acquire() as conn:
                        await conn.execute(
                            "INSERT INTO admin_audit(telegram_id, method, path, status, ip) VALUES($1,$2,$3,$4,$5)",
                            payload.get("telegram_id"), request.method, request.url.path[:300],
                            response.status_code, client_ip(request)[:64],
                        )
                except Exception as e:
                    log.warning(f"[audit] yozib bo'lmadi: {e}")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (uploads)
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# API routes
for r in [files.router, auth.router, users.router, drivers.router, orders.router,
          payments.router, ratings.router, maps.router, admin.router,
          # Chortoq Services
          catalog.router, vehicles.router, schedules.router, carpool.router,
          service_requests.router, reviews.router, notifications.router, search.router,
          admin_services.router,
          # Chortoq Ijrochi (Android)
          app_auth.router, mobile.router]:
    app.include_router(r, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


# Mount Socket.io — ASGI combined app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")
