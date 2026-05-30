import asyncio
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_pool, close_pool
from app.redis_client import init_redis, close_redis
from app.socket_manager import sio
from app.routers import auth, users, drivers, orders, payments, ratings, maps, admin


async def _run_bot(dp, bot_obj):
    try:
        await dp.start_polling(bot_obj, handle_signals=False)
    except Exception as e:
        print(f"[bot] polling error: {e}")


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
            from app.bot.handlers import create_bot
            bot_obj, dp = create_bot()
            bot_task = asyncio.create_task(_run_bot(dp, bot_obj))
            print("[bot] Telegram bot polling started")
        except Exception as e:
            print(f"[bot] Failed to start bot: {e}")
    else:
        print("[bot] TELEGRAM_BOT_TOKEN not set or invalid — bot disabled")

    print(f"[server] TaxiGo backend started on port {settings.port}")
    yield

    # ── Shutdown ──
    if bot_task:
        bot_task.cancel()
    await close_pool()
    await close_redis()
    print("[server] shutdown complete")


app = FastAPI(
    title="TaxiGo API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

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
for r in [auth.router, users.router, drivers.router, orders.router,
          payments.router, ratings.router, maps.router, admin.router]:
    app.include_router(r, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


# Mount Socket.io — ASGI combined app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")
