"""Chortoq Ijrochi (Android) backend testlari — PLAN-ANDROID B1–B9.

Telegram orqali kirish, refresh aylanishi va o'g'irlangan tokenni aniqlash, bloklash, qurilma/push (FCM mock),
fon GPS paketi, ketma-ket taklif, versiya va ijrochi bosh sahifasi.
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx

from app import database
from app.config import settings
from app.services import app_auth, push
from app.services.app_login_bot import answer_login, describe_login
from tests.test_services_flow import (  # noqa: F401
    ADMIN_TG, CHORTOQ, TEST_TG_MAX, TEST_TG_MIN, client, h, login, loop, run,
)

def ip() -> dict:
    """Har murojaatda yangi IP: kirish endpointlari rate-limit bilan himoyalangan (10 ta / 10 daqiqa)."""
    return {"X-Real-IP": f"198.18.{random.randint(0, 255)}.{random.randint(1, 254)}"}
# Boshqa testlarning haydovchilaridan uzoqda (5 km qidiruv radiusidan tashqarida)
FAR = {"lat": CHORTOQ["lat"] + 0.3, "lng": CHORTOQ["lng"] + 0.3}
SEQ = {"lat": CHORTOQ["lat"] - 0.3, "lng": CHORTOQ["lng"] + 0.3}  # ketma-ket taklif testi uchun alohida hudud


def _device() -> str:
    return f"test-{uuid.uuid4().hex[:16]}"


def _tg_user(name="Ilovachi"):
    return SimpleNamespace(id=random.randint(TEST_TG_MIN, TEST_TG_MAX), username=None, first_name=name, last_name=None)


def _app_login(client, tg_user=None, device=None) -> tuple[dict, str]:
    """To'liq oqim: start → (bot) tasdiqlash → poll. Tokenlar va device_id qaytadi."""
    device = device or _device()
    start = run(client.post("/api/auth/app/start", headers=ip(), json={"device_id": device, "device_name": "Redmi Note 12"}))
    assert start.status_code == 200, start.text
    code = start.json()["code"]
    assert start.json()["bot_url"].endswith(f"?start=login_{code}")
    # Bot: tasdiqlash xabari va tugma (callback_data ≤ 64 bayt)
    text, kb = run(describe_login(code))
    assert "Redmi Note 12" in text
    data = kb.inline_keyboard[0][0].callback_data
    assert data.startswith("al:y:") and len(data.encode()) <= 64
    assert "tasdiqlandi" in run(answer_login(data, tg_user or _tg_user()))
    r = run(client.post("/api/auth/app/poll", headers=ip(), json={"code": code, "device_id": device}))
    assert r.status_code == 200, r.text
    return r.json(), device


def _bearer(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_telegram_login_flow(client):
    device = _device()
    start = run(client.post("/api/auth/app/start", headers=ip(), json={"device_id": device})).json()
    poll = {"code": start["code"], "device_id": device}
    # Hali tasdiqlanmagan
    assert run(client.post("/api/auth/app/poll", headers=ip(), json=poll)).status_code == 202
    # Boshqa qurilma shu kodni o'g'irlab ololmaydi
    assert run(client.post("/api/auth/app/poll", headers=ip(), json={**poll, "device_id": _device()})).status_code == 410
    # Rad etilsa — kod yaroqsiz
    text, kb = run(describe_login(start["code"]))
    assert "rad etildi" in run(answer_login(kb.inline_keyboard[0][1].callback_data, _tg_user()))
    assert run(client.post("/api/auth/app/poll", headers=ip(), json=poll)).status_code == 410

    tokens, _ = _app_login(client)
    me = run(client.get("/api/users/me", headers=_bearer(tokens)))
    assert me.status_code == 200 and me.json()["first_name"] == "Ilovachi"


def test_code_is_single_use(client):
    device = _device()
    code = run(client.post("/api/auth/app/start", headers=ip(), json={"device_id": device})).json()["code"]
    _, kb = run(describe_login(code))
    run(answer_login(kb.inline_keyboard[0][0].callback_data, _tg_user()))
    poll = {"code": code, "device_id": device}
    assert run(client.post("/api/auth/app/poll", headers=ip(), json=poll)).status_code == 200
    assert run(client.post("/api/auth/app/poll", headers=ip(), json=poll)).status_code == 410
    # Ikkinchi marta bosilgan tugma hech narsa qilmaydi
    assert "eskirgan" in run(answer_login(kb.inline_keyboard[0][0].callback_data, _tg_user()))


def test_refresh_rotation_and_reuse_detection(client):
    tokens, _ = _app_login(client)
    r1 = run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": tokens["refresh_token"]}))
    assert r1.status_code == 200
    new = r1.json()
    assert new["refresh_token"] != tokens["refresh_token"]
    # Javob yo'qolgan (tunnel) — ilova eski token bilan qayta urinadi: muhlat ichida bu o'g'irlik emas (#3)
    retry = run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": tokens["refresh_token"]}))
    assert retry.status_code == 200
    latest = retry.json()
    # Yo'qolgan (hech kim olmagan) token endi yaroqsiz, eng oxirgisi ishlaydi
    assert run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": new["refresh_token"]})).status_code == 401
    assert run(client.get("/api/users/me", headers=_bearer(latest))).status_code == 200

    # Muhlatdan keyin eski token keldi → o'g'irlik: sessiya yopiladi
    tokens2, _ = _app_login(client)
    fresh = run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": tokens2["refresh_token"]})).json()
    async def age():
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE app_sessions SET last_used_at=NOW() - INTERVAL '10 minutes' WHERE refresh_hash=$1",
                               app_auth.sha(fresh["refresh_token"]))
    run(age())
    assert run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": tokens2["refresh_token"]})).status_code == 401
    assert run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": fresh["refresh_token"]})).status_code == 401
    assert run(client.get("/api/users/me", headers=_bearer(fresh))).status_code == 401


def test_logout_and_block_revoke_immediately(client):
    tokens, _ = _app_login(client)
    assert run(client.post("/api/auth/app/logout", headers=_bearer(tokens))).json()["revoked"] == 1
    assert run(client.get("/api/users/me", headers=_bearer(tokens))).status_code == 401

    tokens, _ = _app_login(client)
    uid = run(client.get("/api/users/me", headers=_bearer(tokens))).json()["id"]
    admin = login(client, "Admin", "admin", ADMIN_TG)
    assert run(client.put(f"/api/admin/users/{uid}/block", headers=h(admin), json={"reason": "test"})).status_code == 200
    assert run(client.get("/api/users/me", headers=_bearer(tokens))).status_code == 401
    assert run(client.post("/api/auth/app/refresh", headers=ip(), json={"refresh_token": tokens["refresh_token"]})).status_code == 401


def test_device_registration_and_push(client):
    calls = []

    def fcm(request: httpx.Request):
        body = request.read().decode()
        calls.append(body)
        if "dead-token" in body:
            return httpx.Response(404, json={"error": {"status": "NOT_FOUND", "details": [{"errorCode": "UNREGISTERED"}]}})
        return httpx.Response(200, json={"name": "projects/test/messages/1"})

    push.transport = httpx.MockTransport(fcm)
    try:
        tokens, device = _app_login(client)
        r = run(client.put("/api/devices/me", headers=_bearer(tokens), json={
            "device_id": device, "fcm_token": "fcm-good-token", "model": "Redmi Note 12", "os_version": "13",
            "app_version": "1.0.0"}))
        assert r.status_code == 200 and r.json()["push"] is True
        uid = run(client.get("/api/users/me", headers=_bearer(tokens))).json()["id"]
        # Bildirishnoma xizmati endi push ham yuboradi
        from app.services.notify import notify
        run(notify(uid, "test", "Salom", "Push sinovi", {"x": 1}, telegram=False))
        run(asyncio.sleep(0.2))
        assert any("fcm-good-token" in c and "Push sinovi" in c for c in calls)
        # Tokensiz qayta ro'yxatdan o'tish (ilova har ochilishda) tokenni o'chirmaydi (#8)
        run(client.put("/api/devices/me", headers=_bearer(tokens), json={"device_id": device, "app_version": "1.0.1"}))
        async def tok():
            async with database.pool.acquire() as conn:
                return await conn.fetchval("SELECT fcm_token FROM devices WHERE device_id=$1", device)
        assert run(tok()) == "fcm-good-token"
        # Eskirgan token bazadan o'chiriladi
        run(client.put("/api/devices/me", headers=_bearer(tokens), json={"device_id": device, "fcm_token": "dead-token"}))
        assert run(push.send_to_user(uid, {"type": "ping"})) == 0
        async def token():
            async with database.pool.acquire() as conn:
                return await conn.fetchval("SELECT fcm_token FROM devices WHERE device_id=$1", device)
        assert run(token()) is None
    finally:
        push.transport = None


async def _taxi_driver(user_id: int, tg: int, where: dict) -> int:
    async with database.pool.acquire() as conn:
        return await conn.fetchval(
            """INSERT INTO drivers(user_id, telegram_id, first_name, last_name, phone, car_model, car_color, car_number,
                                   status, is_online, current_location, last_location_update)
               VALUES($1,$2,'Ilova','Haydovchi','+998900000000','Nexia','Oq',$3,'approved',true,
                      ST_MakePoint($5,$4)::geography, NOW() - INTERVAL '60 seconds') RETURNING id""",
            user_id, tg, f"M{tg % 10**7}", where["lat"], where["lng"])


def test_location_batch_is_idempotent(client):
    tokens, _ = _app_login(client)
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    # Taksi haydovchisi bo'lmasa — 403
    now = datetime.now(timezone.utc)
    pts = [{"lat": FAR["lat"], "lng": FAR["lng"] + i * 0.0001, "ts": (now - timedelta(seconds=30 - i * 10)).isoformat(),
            "speed": 8.5, "heading": 90} for i in range(3)]
    assert run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": pts})).status_code == 403
    run(_taxi_driver(me["id"], me["telegram_id"], FAR))
    r = run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": pts}))
    assert r.status_code == 200 and r.json()["accepted"] == 3
    # Xuddi shu paket qayta (internet uzilib, qayta yuborildi) — hech narsa qo'shilmaydi
    assert run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": pts})).json()["accepted"] == 0
    # Telefon soati 3 daqiqa orqada: ketma-ket paketlar baribir qabul qilinadi (aks holda heartbeat oflayn qiladi)
    for k in range(2):
        skew = [{"lat": FAR["lat"], "lng": FAR["lng"], "ts": (now + timedelta(seconds=20 * (k + 1))).isoformat()}]
        assert run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": skew})).json()["accepted"] == 1
    # Butunlay noto'g'ri soat va past aniqlik rad etiladi
    bad = [{"lat": FAR["lat"], "lng": FAR["lng"], "ts": (now + timedelta(days=2)).isoformat()},
           {"lat": FAR["lat"], "lng": FAR["lng"], "ts": now.isoformat(), "accuracy": 900}]
    assert run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": bad})).json()["accepted"] == 0
    assert run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": []})).status_code == 422


def test_location_with_lagging_phone_clock(client):
    """Telefon soati serverdan 3 daqiqa orqada — har bir yangi paket qabul qilinadi (haydovchi oflayn bo'lib qolmasin)."""
    tokens, _ = _app_login(client)
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_taxi_driver(me["id"], me["telegram_id"], FAR))
    base = datetime.now(timezone.utc) - timedelta(minutes=3)
    for k in range(3):
        pt = [{"lat": FAR["lat"], "lng": FAR["lng"], "ts": (base + timedelta(seconds=20 * k)).isoformat()}]
        r = run(client.post("/api/drivers/me/locations", headers=_bearer(tokens), json={"points": pt}))
        assert r.json()["accepted"] == 1, k


def test_sequential_offers(client):
    """B7: eng yaqin haydovchiga birinchi; boshqasi qabul qila olmaydi; rad etilsa — darhol keyingisiga."""
    old_timeout = settings.offer_timeout_sec
    settings.offer_timeout_sec = 5
    try:
        pas = login(client, "Ketma-ket yo'lovchi")
        near_t, _ = _app_login(client, _tg_user("Yaqin"))
        far_t, _ = _app_login(client, _tg_user("Uzoq"))
        near = run(client.get("/api/users/me", headers=_bearer(near_t))).json()
        far = run(client.get("/api/users/me", headers=_bearer(far_t))).json()
        near_id = run(_taxi_driver(near["id"], near["telegram_id"], SEQ))
        far_id = run(_taxi_driver(far["id"], far["telegram_id"], {"lat": SEQ["lat"] + 0.01, "lng": SEQ["lng"]}))
        r = run(client.post("/api/orders", headers=h(pas), json={
            "pickup": {"address": "Uzoq qishloq", **SEQ},
            "dropoff": {"address": "Markaz", "lat": SEQ["lat"] - 0.02, "lng": SEQ["lng"] - 0.02}}))
        assert r.status_code == 201, r.text
        oid = r.json()["id"]
        run(asyncio.sleep(0.3))

        async def offers():
            async with database.pool.acquire() as conn:
                return {x["driver_id"]: x["status"] for x in await conn.fetch(
                    "SELECT driver_id, status FROM order_offers WHERE order_id=$1", oid)}
        assert run(offers()) == {near_id: "offered"}
        # Taklif qilinmagan haydovchi qabul qila olmaydi
        assert run(client.put(f"/api/orders/{oid}/accept", headers=_bearer(far_t))).status_code == 409
        # Yaqini rad etdi → 15 soniya kutilmaydi, darhol keyingisiga
        assert run(client.put(f"/api/orders/{oid}/reject", headers=_bearer(near_t), json={"reason": "band"})).json()["success"]
        run(asyncio.sleep(0.3))
        assert run(offers()) == {near_id: "rejected", far_id: "offered"}
        assert run(client.put(f"/api/orders/{oid}/accept", headers=_bearer(near_t))).status_code == 409
        assert run(client.put(f"/api/orders/{oid}/accept", headers=_bearer(far_t))).status_code == 200
        assert run(offers())[far_id] == "accepted"
        run(client.put(f"/api/orders/{oid}/cancel", headers=h(pas), json={"reason": "test"}))
    finally:
        settings.offer_timeout_sec = old_timeout


def test_version_and_provider_home(client):
    v = run(client.get("/api/app/version", params={"current": "0.9.0"})).json()
    assert v["update_required"] is True and v["min_version"] == settings.app_min_version
    assert run(client.get("/api/app/version", params={"current": settings.app_latest_version})).json()["update_available"] is False

    tokens, _ = _app_login(client)
    home = run(client.get("/api/provider/home", headers=_bearer(tokens)))
    assert home.status_code == 200, home.text
    body = home.json()
    assert body["sections"] == [] and body["taxi"] is None and body["earnings_today"] == 0
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_taxi_driver(me["id"], me["telegram_id"], FAR))
    body = run(client.get("/api/provider/home", headers=_bearer(tokens))).json()
    assert body["sections"] == ["taxi"] and body["taxi"]["is_online"] is True


def test_going_online_requires_verified_phone(client):
    """#6: yo'lovchi haydovchiga qo'ng'iroq qila olishi uchun onlayn bo'lishdan oldin tasdiqlangan raqam shart."""
    tokens, _ = _app_login(client)
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_taxi_driver(me["id"], me["telegram_id"], FAR))
    home = run(client.get("/api/provider/home", headers=_bearer(tokens))).json()
    assert home["phone_required"] is True
    r = run(client.put("/api/drivers/me/status", headers=_bearer(tokens), json={"is_online": True}))
    assert r.status_code == 400 and "telefon" in r.json()["detail"].lower()
    from app.routers.users import save_verified_phone
    async def verify():
        async with database.pool.acquire() as conn:
            await save_verified_phone(conn, me["telegram_id"], "998901112233")
            return await conn.fetchval("SELECT phone FROM drivers WHERE telegram_id=$1", me["telegram_id"])
    assert run(verify()) == "+998901112233"  # taksi yozuviga ham tushdi
    assert run(client.put("/api/drivers/me/status", headers=_bearer(tokens), json={"is_online": True})).status_code == 200
    assert run(client.get("/api/provider/home", headers=_bearer(tokens))).json()["phone_required"] is False


def test_open_app_page_and_download_link(client):
    r = run(client.get("/api/app/open"))
    assert r.status_code == 200 and "intent://login#Intent;scheme=chortoqijrochi" in r.text
    assert "support" in run(client.get("/api/app/version")).json()
