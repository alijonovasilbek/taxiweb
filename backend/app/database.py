import asyncpg
from app.config import settings

pool: asyncpg.Pool | None = None


async def init_pool():
    global pool
    pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )


async def close_pool():
    if pool:
        await pool.close()


async def get_db() -> asyncpg.Connection:
    async with pool.acquire() as conn:
        yield conn
