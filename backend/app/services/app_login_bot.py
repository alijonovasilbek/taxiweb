"""Botdagi "Ilovaga kirish" tasdig'i (Telegram bog'liqliklarisiz — testda to'g'ridan-to'g'ri chaqiriladi).

Fishingdan himoya: havolani bosishning o'zi yetmaydi — foydalanuvchi qurilma nomini ko'rib, "✅ Ha, kirish"ni
bosishi kerak. Begona odam yuborgan havola bilan o'z akkauntini boshqaga berib qo'ymasligi uchun ogohlantirish bor.
"""
import html

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

from app.services.app_auth import sha

PREFIX_LEN = 40  # callback_data ≤ 64 bayt: "al:y:" + xeshning 40 belgisi


async def _pending(conn, code_hash_prefix: str):
    return await conn.fetchrow(
        """SELECT * FROM app_login_codes WHERE code_hash LIKE $1 || '%' AND status='pending' AND expires_at > NOW()""",
        code_hash_prefix,
    )


async def describe_login(code: str) -> tuple[str, InlineKeyboardMarkup | None]:
    from app.database import pool
    h = sha(code)[:PREFIX_LEN]
    async with pool.acquire() as conn:
        row = await _pending(conn, h)
    if not row:
        return "⌛️ Kirish havolasi eskirgan. Ilovada \"Telegram orqali kirish\"ni qaytadan bosing.", None
    device = html.escape(row["device_name"] or "Android qurilma")
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Ha, kirish", callback_data=f"al:y:{h}"),
        InlineKeyboardButton(text="✖️ Yo'q", callback_data=f"al:n:{h}"),
    ]])
    return (
        f"📱 <b>Chortoq Ijrochi</b> ilovasiga kirish\n\nQurilma: <b>{device}</b>\n\n"
        "Agar hozir ilovada «Telegram orqali kirish»ni o'zingiz bosgan bo'lsangiz — tasdiqlang.\n"
        "⚠️ Havolani boshqa odam yuborgan bo'lsa, <b>bosmang</b>: u sizning akkauntingizga kirib oladi.",
        kb,
    )


async def answer_login(data: str, tg_user) -> str:
    from app.database import pool
    try:
        _, decision, h = data.split(":", 2)
    except ValueError:
        return "Noto'g'ri so'rov"
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await _pending(conn, h)
            if not row:
                return "⌛️ Havola eskirgan yoki ishlatilgan. Ilovada qaytadan urinib ko'ring."
            if decision != "y":
                await conn.execute("UPDATE app_login_codes SET status='denied' WHERE code_hash=$1", row["code_hash"])
                return "✖️ Kirish rad etildi."
            user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", tg_user.id)
            if user and user["is_blocked"]:
                await conn.execute("UPDATE app_login_codes SET status='denied' WHERE code_hash=$1", row["code_hash"])
                return "⛔️ Hisobingiz bloklangan. Qo'llab-quvvatlash: @taxigo_support"
            if not user:
                user = await conn.fetchrow(
                    """INSERT INTO users(telegram_id, telegram_username, first_name, last_name)
                       VALUES($1,$2,$3,$4) RETURNING *""",
                    tg_user.id, tg_user.username, tg_user.first_name or "", tg_user.last_name,
                )
            await conn.execute("UPDATE app_login_codes SET status='approved', user_id=$2 WHERE code_hash=$1",
                               row["code_hash"], user["id"])
    return "✅ Kirish tasdiqlandi. <b>Chortoq Ijrochi</b> ilovasiga qayting."


async def needs_phone(telegram_id: int) -> bool:
    from app.database import pool
    async with pool.acquire() as conn:
        ok = await conn.fetchval(
            "SELECT phone IS NOT NULL AND phone <> '' AND phone_verified FROM users WHERE telegram_id=$1", telegram_id)
    return not ok
