"""Ilovaga login/parol bilan kirish.

- Birinchi marta Telegram orqali kirganda bot login va parolni yuboradi (keyin Telegram'siz ham kirish mumkin).
- Botda /parol — yangi parol. Admin panel — login/parolni o'rnatish yoki tiklash.
- Login: tasdiqlangan telefon raqami (998901234567) yoki `id<raqam>`; kirishda telefonning istalgan yozilishi ham qabul qilinadi.
"""
import re
import secrets

import asyncpg

from app.auth import hash_password, verify_password

# Adashtiradigan belgilarsiz (0/o, 1/l/i): telefon klaviaturasida terish oson
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
LOGIN_RE = re.compile(r"^[a-z0-9_.]{3,32}$")
MIN_PASSWORD = 6


def gen_password(n: int = 8) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def norm_login(value: str) -> str:
    v = (value or "").strip().lower()
    digits = re.sub(r"\D", "", v)
    # "+998 90 123-45-67" / "90 123 45 67" → 998901234567
    if digits and re.fullmatch(r"[\d\s+()-]+", v):
        if len(digits) == 9:
            digits = "998" + digits
        return digits
    return v


async def default_login(conn: asyncpg.Connection, user: dict) -> str:
    phone = re.sub(r"\D", "", user.get("phone") or "")
    if len(phone) >= 9:
        login = norm_login(phone)
        taken = await conn.fetchval("SELECT 1 FROM users WHERE login=$1 AND id<>$2", login, user["id"])
        if not taken:
            return login
    return f"id{user['id']}"


async def set_credentials(conn: asyncpg.Connection, user_id: int, login: str | None = None,
                          password: str | None = None) -> tuple[str, str]:
    """Login/parolni o'rnatadi. Berilmasa — login avtomatik, parol tasodifiy. Ochiq parolni qaytaradi (saqlanmaydi)."""
    user = await conn.fetchrow("SELECT id, phone, login FROM users WHERE id=$1", user_id)
    if not user:
        raise ValueError("Foydalanuvchi topilmadi")
    login = norm_login(login) if login else (user["login"] or await default_login(conn, dict(user)))
    if not LOGIN_RE.match(login):
        raise ValueError("Login 3–32 belgi: lotin harflari, raqamlar, _ yoki .")
    if await conn.fetchval("SELECT 1 FROM users WHERE login=$1 AND id<>$2", login, user_id):
        raise ValueError("Bu login band")
    password = password or gen_password()
    if len(password) < MIN_PASSWORD:
        raise ValueError(f"Parol kamida {MIN_PASSWORD} belgi")
    await conn.execute(
        "UPDATE users SET login=$2, password_hash=$3, password_set_at=NOW(), updated_at=NOW() WHERE id=$1",
        user_id, login, hash_password(password),
    )
    return login, password


async def find_by_credentials(conn: asyncpg.Connection, login: str, password: str) -> asyncpg.Record | None:
    row = await conn.fetchrow("SELECT * FROM users WHERE login=$1", norm_login(login))
    if row and verify_password(password, row["password_hash"]):
        return row
    # Admin panel → Haydovchilar sahifasida berilgan taksi login/paroli (drivers.driver_login) ham o'tadi
    drv = await conn.fetchrow(
        "SELECT user_id, password_hash FROM drivers WHERE lower(driver_login)=lower($1) AND user_id IS NOT NULL",
        login.strip())
    if drv and verify_password(password, drv["password_hash"]):
        return await conn.fetchrow("SELECT * FROM users WHERE id=$1", drv["user_id"])
    return None


async def ensure_credentials(conn: asyncpg.Connection, telegram_id: int) -> tuple[str, str] | None:
    """Birinchi Telegram kirishidan keyin: paroli yo'q bo'lsa — yaratadi va (login, parol) qaytaradi, aks holda None."""
    row = await conn.fetchrow("SELECT id, password_hash FROM users WHERE telegram_id=$1", telegram_id)
    if not row or row["password_hash"]:
        return None
    return await set_credentials(conn, row["id"])


def credentials_text(login: str, password: str, first: bool = False) -> str:
    head = ("🔑 <b>Chortoq</b> va <b>Chortoq Ijrochi</b> ilovalari uchun login va parolingiz.\n"
            "Endi ilovaga Telegram'siz ham kira olasiz:\n\n") if first else "🔑 Yangi parol o'rnatildi:\n\n"
    return (head + f"Login: <code>{login}</code>\nParol: <code>{password}</code>\n\n"
            "Ilovada «Login va parol bilan kirish»ni tanlang.\n"
            "⚠️ Parolni hech kimga bermang. Yangi parol olish: /parol")


async def send_credentials(telegram_id: int, login: str, password: str, first: bool = False) -> bool:
    """Bot orqali yuboradi. Telegram'siz (admin qo'shgan, telegram_id < 0) foydalanuvchiga yuborilmaydi."""
    if not telegram_id or telegram_id <= 0:
        return False
    from app.bot import handlers
    from app.services.bot_retry import with_retry
    if handlers.bot is None:
        return False
    try:
        await with_retry(lambda: handlers.bot.send_message(
            telegram_id, credentials_text(login, password, first), parse_mode="HTML"), label="send_credentials")
        return True
    except Exception:
        return False
