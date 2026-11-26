"""Xavfsizlik yordamchilari: so'rovlar chastotasini cheklash (rate limit) va dev endpoint'larni faqat lokalga ochish."""
import hashlib
import time

from fastapi import HTTPException, Request

from app.config import settings

_LOCAL_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}
_memory: dict[str, tuple[int, float]] = {}  # Redis ishlamasa zaxira hisoblagich


def client_ip(request: Request) -> str:
    """nginx/ngrok ortida haqiqiy IP X-Real-IP / X-Forwarded-For da keladi."""
    fwd = request.headers.get("x-real-ip") or (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    return fwd or (request.client.host if request.client else "unknown")


def is_local_request(request: Request) -> bool:
    """To'g'ridan-to'g'ri shu kompyuterdan (proksi/tunnelsiz) kelgan so'rov."""
    proxied = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for")
    host = request.client.host if request.client else ""
    return not proxied and host in _LOCAL_HOSTS


def require_dev_local(request: Request) -> None:
    """Dev endpoint'lar: DEV_MODE yoqilgan VA so'rov lokal bo'lishi shart (ngrok orqali ochiq emas)."""
    if not settings.dev_mode or not is_local_request(request):
        raise HTTPException(403, "Bu amal faqat lokal ishlab chiqish rejimida mavjud")


def _identity(request: Request) -> str:
    auth = request.headers.get("authorization") or ""
    who = hashlib.sha1(auth.encode()).hexdigest()[:12] if auth else "anon"
    return f"{client_ip(request)}:{who}"


async def _hit(key: str, window: int) -> int:
    from app.redis_client import get_redis

    r = get_redis()
    if r is not None:
        try:
            n = await r.incr(key)
            if n == 1:
                await r.expire(key, window)
            return int(n)
        except Exception:
            pass
    now = time.time()
    count, reset = _memory.get(key, (0, now + window))
    if now > reset:
        count, reset = 0, now + window
    _memory[key] = (count + 1, reset)
    return count + 1


def rate_limit(name: str, times: int, seconds: int):
    """FastAPI dependency: bir foydalanuvchi/IP uchun `seconds` ichida ko'pi bilan `times` so'rov."""
    async def dep(request: Request) -> None:
        bucket = int(time.time() // seconds)
        n = await _hit(f"rl:{name}:{_identity(request)}:{bucket}", seconds)
        if n > times:
            raise HTTPException(429, "Juda ko'p so'rov. Birozdan so'ng qayta urinib ko'ring.")
    return dep
