"""Mijozlar ilovasi "Chortoq" (PLAN-MIJOZ-ANDROID M1–M5).

Bitta telefonda ikkala ilova: push to'g'ri ilovaga boradi; bot qaysi ilovaga kirilayotganini yozadi;
buyurtma javobida haydovchi ma'lumoti; har ilovaning versiyasi alohida.
"""
import asyncio

import httpx

from app import database
from app.services import push
from app.services.app_login_bot import answer_login, describe_login
from tests.test_mobile import _bearer, _device, _taxi_driver, _tg_user, ip
from tests.test_services_flow import CHORTOQ, client, loop, run  # noqa: F401

# Boshqa testlarning hududlaridan ≥40 km uzoqda (qidiruv radiusi 30 km gacha kengayadi)
CLI = {"lat": CHORTOQ["lat"] - 0.3, "lng": CHORTOQ["lng"] - 0.3}


def _login(client, app: str, tg=None, device=None):
    device = device or _device()
    r = run(client.post("/api/auth/app/start", headers=ip(),
                        json={"device_id": device, "device_name": "Samsung A15", "app": app}))
    assert r.status_code == 200, r.text
    code = r.json()["code"]
    text, kb = run(describe_login(code))
    name = "<b>Chortoq</b>" if app == "client" else "<b>Chortoq Ijrochi</b>"
    assert name in text
    answer = run(answer_login(kb.inline_keyboard[0][0].callback_data, tg or _tg_user()))
    assert name in answer
    r = run(client.post("/api/auth/app/poll", headers=ip(), json={"code": code, "device_id": device}))
    assert r.status_code == 200, r.text
    return r.json(), device


async def _verify_phone(uid: int):
    async with database.pool.acquire() as conn:
        await conn.execute("UPDATE users SET phone='+998901112233', phone_verified=true WHERE id=$1", uid)


def test_client_app_taxi_flow_and_push_routing(client):
    calls = []

    def fcm(request: httpx.Request):
        calls.append(request.read().decode())
        return httpx.Response(200, json={"name": "projects/test/messages/1"})

    push.transport = httpx.MockTransport(fcm)
    try:
        # Haydovchining telefonida ikkala ilova: bitta akkaunt, ikki qurilma yozuvi
        drv_tg = _tg_user("Ikkiilova")
        drv_tokens, drv_dev = _login(client, "driver", drv_tg)
        cli_tokens_d, cli_dev_d = _login(client, "client", drv_tg)
        d_me = run(client.get("/api/users/me", headers=_bearer(drv_tokens))).json()
        assert run(client.get("/api/users/me", headers=_bearer(cli_tokens_d))).json()["id"] == d_me["id"]
        run(client.put("/api/devices/me", headers=_bearer(drv_tokens),
                       json={"device_id": drv_dev, "fcm_token": "tok-driver-app"}))
        r = run(client.put("/api/devices/me", headers=_bearer(cli_tokens_d),
                           json={"device_id": cli_dev_d, "fcm_token": "tok-driver-clientapp", "app": "client"}))
        assert r.status_code == 200 and r.json()["app"] == "client"
        run(_taxi_driver(d_me["id"], d_me["telegram_id"], CLI))

        # Yo'lovchi — mijoz ilovasidan
        pas_tokens, pas_dev = _login(client, "client")
        p_me = run(client.get("/api/users/me", headers=_bearer(pas_tokens))).json()
        run(_verify_phone(p_me["id"]))
        run(client.put("/api/devices/me", headers=_bearer(pas_tokens),
                       json={"device_id": pas_dev, "fcm_token": "tok-passenger", "app": "client"}))
        r = run(client.post("/api/orders", headers=_bearer(pas_tokens), json={
            "pickup": {"address": "Bozor", **CLI},
            "dropoff": {"address": "Markaz", "lat": CLI["lat"] + 0.02, "lng": CLI["lng"] + 0.02}}))
        assert r.status_code == 201, r.text
        oid = r.json()["id"]
        run(asyncio.sleep(0.4))
        # Yangi buyurtma push'i faqat haydovchi ilovasiga
        new_order = [c for c in calls if '"new_order"' in c]
        assert new_order and all("tok-driver-app" in c for c in new_order)

        calls.clear()
        assert run(client.put(f"/api/orders/{oid}/accept", headers=_bearer(drv_tokens))).status_code == 200
        run(asyncio.sleep(0.3))
        accepted = [c for c in calls if '"order_accepted"' in c]
        assert accepted and all("tok-passenger" in c for c in accepted)

        # Buyurtma javobida haydovchi (ilova qayta ochilsa ham ko'rsatadi)
        o = run(client.get(f"/api/orders/{oid}", headers=_bearer(pas_tokens))).json()
        assert o["status"] == "accepted" and o["driver"]["car_model"] == "Nexia"
        assert abs(o["driver"]["lat"] - CLI["lat"]) < 1e-6
        act = run(client.get("/api/orders/active", headers=_bearer(pas_tokens))).json()
        assert act["id"] == oid and act["driver"]["phone"]

        calls.clear()
        assert run(client.put(f"/api/orders/{oid}/arrived", headers=_bearer(drv_tokens))).status_code == 200
        run(asyncio.sleep(0.3))
        assert any("tok-passenger" in c and "driver_arrived" in c for c in calls)
        assert not any("tok-driver" in c for c in calls)
        run(client.put(f"/api/orders/{oid}/cancel", headers=_bearer(pas_tokens), json={"reason": "test"}))
    finally:
        push.transport = None


def test_version_per_app(client):
    d = run(client.get("/api/app/version", params={"current": "0.1.0"})).json()
    c = run(client.get("/api/app/version", params={"current": "0.1.0", "app": "client"})).json()
    assert c["update_required"] is True and "chortoq-dev.apk" in (c["apk_url"] or "")
    assert d["apk_url"] != c["apk_url"]
    page = run(client.get("/api/app/open", params={"app": "client"})).text
    assert "scheme=chortoq;package=uz.chortoq.app" in page
