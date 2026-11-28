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


def test_nearby_cars_hide_driver_identity(client):
    tokens, _ = _login(client, "client")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    drv_tokens, _ = _login(client, "driver")
    d_me = run(client.get("/api/users/me", headers=_bearer(drv_tokens))).json()
    near = {"lat": CLI["lat"] + 0.2, "lng": CLI["lng"]}
    run(_taxi_driver(d_me["id"], d_me["telegram_id"], near))
    r = run(client.get("/api/drivers/nearby", params={"lat": near["lat"] + 0.001, "lng": near["lng"]}, headers=_bearer(tokens)))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["cars"] and data["eta_min"] >= 1
    assert set(data["cars"][0]) == {"lat", "lng", "distance_km"}
    assert "+99890" not in r.text and str(d_me["telegram_id"]) not in r.text
    assert me["id"]


def test_payment_link_only_for_order_owner(client):
    owner, _ = _login(client, "client")
    other, _ = _login(client, "client")
    o_me = run(client.get("/api/users/me", headers=_bearer(owner))).json()
    run(_verify_phone(o_me["id"]))
    far = {"lat": CLI["lat"] - 0.25, "lng": CLI["lng"] + 0.1}
    r = run(client.post("/api/orders", headers=_bearer(owner), json={
        "pickup": {"address": "A", **far}, "dropoff": {"address": "B", "lat": far["lat"] + 0.02, "lng": far["lng"]},
        "payment_method": "click"}))
    assert r.status_code == 201, r.text
    oid = r.json()["id"]
    for kind in ("payme", "click"):
        assert run(client.post(f"/api/payments/{kind}/create", headers=_bearer(other), json={"order_id": oid})).status_code == 404
        assert run(client.post(f"/api/payments/{kind}/create", headers=_bearer(owner), json={"order_id": oid})).status_code == 200
        # Web App camelCase yuboradi
        assert run(client.post(f"/api/payments/{kind}/create", headers=_bearer(owner), json={"orderId": oid})).status_code == 200
    run(client.put(f"/api/orders/{oid}/cancel", headers=_bearer(owner), json={"reason": "test"}))


def test_notifications_data_is_object(client):
    tokens, _ = _login(client, "client")
    uid = run(client.get("/api/users/me", headers=_bearer(tokens))).json()["id"]
    from app.services.notify import notify
    run(notify(uid, "request_status", "Sinov", "Matn", {"request_id": 77}, telegram=False))
    items = run(client.get("/api/notifications", headers=_bearer(tokens))).json()["items"]
    assert items and items[0]["data"]["request_id"] == 77


def test_driver_document_upload_cannot_escape_folder(client):
    import os
    from tests.test_services_flow import PNG
    tokens, _ = _login(client, "driver")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_taxi_driver(me["id"], me["telegram_id"], {"lat": CLI["lat"] + 0.25, "lng": CLI["lng"] - 0.2}))
    evil = "../../evil_upload_test.png"
    r = run(client.post("/api/drivers/me/documents", headers=_bearer(tokens),
                        files={"license": (evil, PNG, "image/png")}))
    assert r.status_code == 200, r.text
    assert (r.json().get("license_photo_url") or "").startswith("private:")
    assert not os.path.exists(os.path.join(os.getcwd(), "evil_upload_test.png"))
    # Rasm emas (sarlavhasi image/png bo'lsa ham) — rad etiladi
    bad = run(client.post("/api/drivers/me/documents", headers=_bearer(tokens),
                          files={"license": ("x.png", b"print('hack')", "image/png")}))
    assert bad.status_code == 400


def test_route_marks_straight_line_as_approx(client):
    """Marshrut serverlari ishlamasa — taxminiy natija `approx` bilan (ilovalar uni yo'l sifatida chizmaydi)."""
    from app.config import settings
    from app.services import yandex_service as y
    old_url, old_fb, old_key = settings.osrm_url, y.OSRM_FALLBACKS, settings.yandex_router_api_key
    settings.osrm_url, y.OSRM_FALLBACKS, settings.yandex_router_api_key = "http://127.0.0.1:9", (), ""
    try:
        r = run(y.get_route(CLI["lat"], CLI["lng"], CLI["lat"] + 0.0123, CLI["lng"] + 0.0117))
        assert r["approx"] is True and len(r["polyline"]) == 2 and r["distance_km"] > 0
    finally:
        settings.osrm_url, y.OSRM_FALLBACKS, settings.yandex_router_api_key = old_url, old_fb, old_key


def test_own_order_not_offered_to_self(client):
    """Bitta akkaunt ham yo'lovchi, ham haydovchi: o'z buyurtmasi o'ziga taklif qilinmaydi (aks holda
    qabul qilish 409 beradi va 15 soniyadan keyin "Haydovchi topilmadi" chiqadi)."""
    from app.services.matching_service import find_drivers_expanding

    where = {"lat": CLI["lat"] + 0.05, "lng": CLI["lng"] + 0.05}
    tokens, _ = _login(client, "client")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    driver_id = run(_taxi_driver(me["id"], me["telegram_id"], where))

    async def nearest(exclude):
        async with database.pool.acquire() as conn:
            return [d["id"] for d in await find_drivers_expanding(conn, where["lat"], where["lng"], exclude)]

    assert driver_id in run(nearest(None))
    assert driver_id not in run(nearest(me["id"]))
