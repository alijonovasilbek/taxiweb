"""Testlar ALOHIDA bazada (taxigo_test) va Redis'ning 15-bazasida ishlaydi — ishlayotgan tizimga tegmaydi.

Avval testlar asosiy bazaga yozardi: admin panelda test buyurtmalari/foydalanuvchilari ko'rinib qolardi
(PLAN-MIJOZ-ANDROID M7). Bu fayl `app` import qilinishidan OLDIN muhit o'zgaruvchilarini almashtiradi
(pydantic Settings muhitni .env dan ustun qo'yadi), test bazasini yaratadi va migratsiyalarni qo'llaydi.
"""
import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import asyncpg

BACKEND = Path(__file__).resolve().parents[1]
TEST_DB = "taxigo_test"


def _env_file_value(key: str) -> str | None:
    env = BACKEND / ".env"
    if not env.exists():
        return None
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _with_db(url: str, db: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, f"/{db}", p.query, p.fragment))


async def _ensure_db(admin_url: str) -> None:
    conn = await asyncpg.connect(admin_url)
    try:
        if not await conn.fetchval("SELECT 1 FROM pg_database WHERE datname=$1", TEST_DB):
            await conn.execute(f'CREATE DATABASE "{TEST_DB}"')
    finally:
        await conn.close()


def _setup() -> None:
    if os.environ.get("CHORTOQ_TEST_DB_READY"):
        return
    base = os.environ.get("DATABASE_URL") or _env_file_value("DATABASE_URL")
    if not base:
        raise RuntimeError("DATABASE_URL topilmadi (backend/.env)")
    if urlsplit(base).path.strip("/") == TEST_DB:
        test_url = base
    else:
        test_url = _with_db(base, TEST_DB)
        # Ulanish uchun mavjud asosiy baza (CREATE DATABASE boshqa bazadan bajariladi)
        asyncio.run(_ensure_db(base))
    env = {**os.environ, "DATABASE_URL": test_url}
    r = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=BACKEND, env=env,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"Test bazasi migratsiyasi yiqildi:\n{r.stderr[-2000:]}")
    os.environ["DATABASE_URL"] = test_url
    redis = os.environ.get("REDIS_URL") or _env_file_value("REDIS_URL") or "redis://localhost:6379"
    p = urlsplit(redis)
    os.environ["REDIS_URL"] = urlunsplit((p.scheme, p.netloc, "/15", p.query, p.fragment))
    os.environ["CHORTOQ_TEST_DB_READY"] = "1"


_setup()
