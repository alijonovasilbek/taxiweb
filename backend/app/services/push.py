"""Firebase Cloud Messaging (HTTP v1) orqali push (PLAN-ANDROID B4).

- Kalit: FCM_SERVICE_ACCOUNT = service account JSON fayli yo'li yoki JSON matni. Bo'lmasa push o'chiq
  (xato emas — Mini App va bot ishlayveradi).
- `new_order` kabi shoshilinch xabarlar: data-only + priority=high → ilova yopiq bo'lsa ham Notifee
  to'liq ekranli "qo'ng'iroq" chiqaradi. Oddiy bildirishnomalar: notification + data.
- Token eskirgan bo'lsa (UNREGISTERED / 404) — bazadan o'chiriladi.
- Testlar uchun: `push.sent` ro'yxati va `push.transport` almashtiriladi.
"""
import asyncio
import json
import os
import time

import httpx

from app.config import settings
from app.log import log

SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
TOKEN_URL = "https://oauth2.googleapis.com/token"

sent: list[dict] = []      # oxirgi yuborilganlar (test va diagnostika uchun, 200 tagacha)
transport = None           # testda httpx.MockTransport
_cred: dict | None = None
_access: tuple[str, float] | None = None
_lock = asyncio.Lock()


def _credentials() -> dict | None:
    global _cred
    if _cred is not None:
        return _cred or None
    raw = settings.fcm_service_account.strip()
    if not raw:
        _cred = {}
        return None
    try:
        if not raw.startswith("{") and os.path.exists(raw):
            with open(raw, encoding="utf-8") as f:
                raw = f.read()
        _cred = json.loads(raw)
    except Exception as e:
        log.warning(f"[push] FCM kaliti o'qilmadi: {e}")
        _cred = {}
    return _cred or None


def enabled() -> bool:
    return _credentials() is not None or transport is not None


async def _token(client: httpx.AsyncClient, cred: dict) -> str:
    global _access
    async with _lock:
        if _access and _access[1] > time.time() + 60:
            return _access[0]
        from jose import jwt
        now = int(time.time())
        assertion = jwt.encode(
            {"iss": cred["client_email"], "scope": SCOPE, "aud": TOKEN_URL, "iat": now, "exp": now + 3600},
            cred["private_key"], algorithm="RS256",
        )
        r = await client.post(TOKEN_URL, data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
        r.raise_for_status()
        body = r.json()
        _access = (body["access_token"], time.time() + int(body.get("expires_in", 3600)))
        return _access[0]


def _message(token: str, data: dict, title: str | None, body: str | None, urgent: bool, ttl: int) -> dict:
    msg: dict = {
        "token": token,
        # FCM data qiymatlari faqat satr bo'lishi kerak
        "data": {k: v if isinstance(v, str) else json.dumps(v, default=str) for k, v in data.items()},
        "android": {"priority": "HIGH" if urgent else "NORMAL", "ttl": f"{ttl}s"},
    }
    if title and not urgent:  # shoshilinch xabarni ilova o'zi (Notifee) ko'rsatadi
        msg["notification"] = {"title": title, "body": body or ""}
        msg["android"]["notification"] = {"channel_id": "general"}
    return msg


async def send_to_user(user_id: int, data: dict, *, title: str | None = None, body: str | None = None,
                       urgent: bool = False, ttl: int = 3600) -> int:
    """Foydalanuvchining barcha qurilmalariga. Nechta qurilmaga ketganini qaytaradi. Hech qachon xato otmaydi."""
    if not enabled():
        return 0
    from app.database import pool
    try:
        async with pool.acquire() as conn:
            tokens = [r["fcm_token"] for r in await conn.fetch(
                "SELECT fcm_token FROM devices WHERE user_id=$1 AND fcm_token IS NOT NULL", user_id)]
    except Exception as e:
        log.warning(f"[push] db: {e}")
        return 0
    if not tokens:
        return 0
    ok = 0
    try:
        async with httpx.AsyncClient(timeout=10, transport=transport) as client:
            cred = _credentials()
            if cred:
                access, project = await _token(client, cred), cred["project_id"]
            else:  # test transporti
                access, project = "test", "test"
            for t in tokens:
                msg = _message(t, data, title, body, urgent, ttl)
                r = await client.post(f"https://fcm.googleapis.com/v1/projects/{project}/messages:send",
                                      headers={"Authorization": f"Bearer {access}"}, json={"message": msg})
                if r.status_code == 200:
                    ok += 1
                    sent.append({"user_id": user_id, **msg})
                    del sent[:-200]
                elif r.status_code in (400, 404) and ("UNREGISTERED" in r.text or "INVALID_ARGUMENT" in r.text):
                    async with pool.acquire() as conn:
                        await conn.execute("UPDATE devices SET fcm_token=NULL WHERE fcm_token=$1", t)
                else:
                    log.warning(f"[push] FCM {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.warning(f"[push] yuborilmadi: {e}")
    return ok


def fire(user_id: int, data: dict, **kw) -> None:
    """Fon vazifasi sifatida yuborish (asosiy oqimni kutdirmaydi)."""
    from app.tasks import spawn
    spawn(send_to_user(user_id, data, **kw), name="push")
