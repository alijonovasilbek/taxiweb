_bot = None


def set_bot(bot):
    global _bot
    _bot = bot


async def send_to_passenger(user_id: int, message: str):
    if not _bot:
        return
    try:
        from app.database import pool
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT telegram_id FROM users WHERE id=$1", user_id)
        if row:
            await _bot.send_message(row["telegram_id"], message)
    except Exception as e:
        print(f"[bot] send_to_passenger error: {e}")


async def send_to_driver(driver_id: int, message: str):
    if not _bot:
        return
    try:
        from app.database import pool
        async with pool.acquire() as conn:
            row = await conn.fetchrow("SELECT telegram_id FROM drivers WHERE id=$1", driver_id)
        if row:
            await _bot.send_message(row["telegram_id"], message)
    except Exception as e:
        print(f"[bot] send_to_driver error: {e}")
