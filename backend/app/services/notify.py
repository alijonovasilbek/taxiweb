"""Yagona bildirishnoma servisi: DB yozuvi + Socket.io (`user:{id}` xonasi) + Telegram bot."""
import asyncio
import json

from app.log import log
from app.services.bot_retry import with_retry


async def notify(
    user_id: int,
    type_: str,
    title: str,
    message: str,
    data: dict | None = None,
    *,
    event: str | None = None,
    telegram: bool = True,
    link: str | None = None,
) -> None:
    """Foydalanuvchiga bildirishnoma yuboradi. Xatolar asosiy oqimni to'xtatmaydi."""
    from app.database import pool
    from app.socket_manager import sio

    payload = data or {}
    notif = None
    tg_id = None
    try:
        async with pool.acquire() as conn:
            notif = await conn.fetchrow(
                """INSERT INTO notifications(user_id,type,title,message,data)
                   VALUES($1,$2,$3,$4,$5::jsonb) RETURNING id, created_at""",
                user_id, type_, title, message, json.dumps(payload, default=str),
            )
            tg_id = await conn.fetchval("SELECT telegram_id FROM users WHERE id=$1", user_id)
    except Exception as e:  # pragma: no cover
        log.warning(f"[notify] db error: {e}")

    room = f"user:{user_id}"
    try:
        await sio.emit(
            "notification",
            {
                "id": notif["id"] if notif else None,
                "type": type_,
                "title": title,
                "message": message,
                "data": payload,
                "created_at": str(notif["created_at"]) if notif else None,
            },
            room=room,
        )
        if event:
            await sio.emit(event, payload, room=room)
    except Exception as e:  # pragma: no cover
        log.warning(f"[notify] socket error: {e}")

    # Android ilova (FCM): ilova yopiq bo'lsa ham bildirishnoma keladi
    from app.services import push
    push.fire(user_id, {"type": type_, "event": event or "", "link": link or "", **payload}, title=title, body=message)

    if telegram and tg_id:
        from app.tasks import spawn
        spawn(_send_telegram(tg_id, f"{title}\n\n{message}", link), name="notify_telegram")


async def _send_telegram(telegram_id: int, text: str, link: str | None) -> None:
    from app.services.notification_service import _bot
    from app.config import settings

    if not _bot:
        return
    try:
        from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

        url = settings.passenger_app_url.rstrip("/") + (link or "/")
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="Ilovani ochish", web_app=WebAppInfo(url=url))
        ]])
        await with_retry(lambda: _bot.send_message(telegram_id, text, reply_markup=kb), label="notify")
    except Exception as e:
        log.warning(f"[notify] telegram error: {e}")


async def notify_many(user_ids, type_: str, title: str, message: str, data: dict | None = None, **kw) -> None:
    for uid in set(user_ids):
        await notify(uid, type_, title, message, data, **kw)
