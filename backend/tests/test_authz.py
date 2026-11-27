"""Ruxsat (avtorizatsiya) testlari — KAMCHILIKLAR-2.md: A1, A2, A4, A5, A6, B1, B2, B3.
"Begona foydalanuvchi boshqaning ma'lumotini ola oladimi / o'zgartira oladimi" degan savollar."""
from app import database
from app.services import maintenance
from tests.test_services_flow import CHORTOQ, PNG, client, h, login, loop, run  # noqa: F401

DROP = {"address": "Bozor", "lat": CHORTOQ["lat"] + 0.01, "lng": CHORTOQ["lng"] + 0.01}


def _order(client, who):
    r = run(client.post("/api/orders", headers=h(who), json={
        "pickup": {"address": "Markaz", **CHORTOQ}, "dropoff": DROP, "payment_method": "cash"}))
    assert r.status_code == 201, r.text
    # Fon dispetcheri (asyncio.create_task) tugashini kutamiz — keyin holatni test o'zi boshqaradi
    import asyncio
    run(asyncio.sleep(0.5))
    return r.json()


async def _make_driver(user_auth_token_user_id: int, telegram_id: int, online=True) -> int:
    async with database.pool.acquire() as conn:
        return await conn.fetchval(
            """INSERT INTO drivers(user_id, telegram_id, first_name, last_name, phone, car_model, car_color, car_number,
                                   status, is_online, current_location, last_location_update)
               VALUES($1,$2,'Test','Haydovchi','+998900000000','Cobalt','Oq',$3,'approved',$4,
                      ST_MakePoint($6,$5)::geography, NOW()) RETURNING id""",
            user_auth_token_user_id, telegram_id, f"T{telegram_id % 10**7}", online, CHORTOQ["lat"], CHORTOQ["lng"],
        )


async def offer(order_id: int, *driver_ids: int):
    """Ketma-ket taklif (B7): buyurtmani faqat taklif qilingan haydovchi qabul qila oladi — testda taklifni qo'lda beramiz."""
    async with database.pool.acquire() as conn:
        for d in driver_ids:
            await conn.execute(
                """INSERT INTO order_offers(order_id, driver_id) VALUES($1,$2)
                   ON CONFLICT (order_id, driver_id) DO UPDATE SET status='offered'""", order_id, d)


def _me(client, auth):
    return run(client.get("/api/users/me", headers=h(auth))).json()


def test_order_privacy_and_single_active(client):
    owner, stranger = login(client, "Egasi"), login(client, "Begona")
    o = _order(client, owner)
    assert run(client.get(f"/api/orders/{o['id']}", headers=h(owner))).status_code == 200
    # A4: begona odam boshqaning buyurtmasini ko'ra olmaydi
    assert run(client.get(f"/api/orders/{o['id']}", headers=h(stranger))).status_code == 404
    # A6: haydovchi bo'lmagan "rad etish" yubora olmaydi
    assert run(client.put(f"/api/orders/{o['id']}/reject", headers=h(stranger), json={"reason": "x"})).status_code == 403
    assert run(client.put(f"/api/orders/{o['id']}/arrived", headers=h(stranger))).status_code == 404
    # B2: faol buyurtma turganda ikkinchisi yo'q (dispetcher "no_drivers" qilib ulgurmasligi uchun holatni qotiramiz)
    async def searching():
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE orders SET status='searching' WHERE id=$1", o["id"])
    run(searching())
    second = run(client.post("/api/orders", headers=h(owner), json={
        "pickup": {"address": "Markaz", **CHORTOQ}, "dropoff": DROP}))
    assert second.status_code == 409


def test_accept_race_only_one_driver_wins(client):
    pas, d1, d2 = login(client, "Yo'lovchi"), login(client, "Haydovchi1"), login(client, "Haydovchi2")
    ids = []
    for d in (d1, d2):
        me = _me(client, d)
        ids.append(run(_make_driver(me["id"], me["telegram_id"])))
    o = _order(client, pas)
    run(offer(o["id"], *ids))
    # Dispetcher "haydovchi topilmadi" qilib ulgurmasin — qidiruv holatiga qaytaramiz
    async def searching():
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE orders SET status='searching' WHERE id=$1", o["id"])
    run(searching())
    r1 = run(client.put(f"/api/orders/{o['id']}/accept", headers=h(d1)))
    r2 = run(client.put(f"/api/orders/{o['id']}/accept", headers=h(d2)))
    assert sorted([r1.status_code, r2.status_code]) == [200, 409]
    # Yutqazgan haydovchi "safarda" bo'lib qotib qolmagan
    loser = d2 if r2.status_code == 409 else d1
    loser_tg = _me(client, loser)["telegram_id"]
    async def on_ride():
        async with database.pool.acquire() as conn:
            return await conn.fetchval("SELECT is_on_ride FROM drivers WHERE telegram_id=$1", loser_tg)
    assert run(on_ride()) is False


def test_rating_only_by_participants(client):
    pas, drv, stranger = login(client, "Yo'lovchi"), login(client, "Haydovchi"), login(client, "Begona")
    me = _me(client, drv)
    drv_id = run(_make_driver(me["id"], me["telegram_id"]))
    o = _order(client, pas)
    run(offer(o["id"], drv_id))
    async def force(status):
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE orders SET status=$2 WHERE id=$1", o["id"], status)
    run(force("searching"))
    assert run(client.put(f"/api/orders/{o['id']}/accept", headers=h(drv))).status_code == 200
    for step in ("arrived", "start", "complete"):
        assert run(client.put(f"/api/orders/{o['id']}/{step}", headers=h(drv))).status_code == 200
    # A5: begona odam baho qo'ya olmaydi
    bad = run(client.post("/api/ratings", headers=h(stranger), json={"order_id": o["id"], "rating": 1, "target_role": "driver"}))
    assert bad.status_code == 403
    ok = run(client.post("/api/ratings", headers=h(pas), json={"orderId": o["id"], "rating": 5, "targetRole": "driver"}))
    assert ok.status_code == 201, ok.text


def test_uploads_reject_html_and_documents_are_private(client):
    u = login(client, "Hujjatchi")
    v = run(client.post("/api/vehicles", headers=h(u), json={"category": "labo", "model": "Labo"})).json()
    # A1: "rasm" deb yuborilgan HTML rad etiladi (tur mazmundan aniqlanadi)
    evil = run(client.post(f"/api/vehicles/{v['id']}/documents", headers=h(u), data={"doc_type": "passport"},
                           files={"file": ("x.html", b"<script>alert(1)</script>", "image/png")}))
    assert evil.status_code == 400
    svg = run(client.post(f"/api/vehicles/{v['id']}/photo", headers=h(u),
                          files={"file": ("x.svg", b"<svg onload=alert(1)>", "image/svg+xml")}))
    assert svg.status_code == 400
    # A2: haqiqiy hujjat — ochiq /uploads da emas, imzoli vaqtinchalik havola orqali
    r = run(client.post(f"/api/vehicles/{v['id']}/documents", headers=h(u), data={"doc_type": "passport"},
                        files={"file": ("p.png", PNG, "image/png")}))
    assert r.status_code == 201
    url = r.json()["file_url"]
    assert url.startswith("/api/files/doc/") and "sig=" in url
    got = run(client.get(url))
    assert got.status_code == 200 and got.headers["content-type"] == "image/png"
    assert run(client.get(url.replace("sig=", "sig=0"))).status_code == 403
    async def stored():
        async with database.pool.acquire() as conn:
            return await conn.fetchval("SELECT file_url FROM user_documents WHERE id=$1", r.json()["id"])
    assert run(stored()).startswith("private:")


def test_maintenance_expires_stale_orders_and_silent_drivers(client):
    pas, drv = login(client, "Yo'lovchi"), login(client, "Jim haydovchi")
    me = _me(client, drv)
    driver_id = run(_make_driver(me["id"], me["telegram_id"]))
    o = _order(client, pas)
    async def age():
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE orders SET status='searching', created_at=NOW()-INTERVAL '5 minutes' WHERE id=$1", o["id"])
            await conn.execute("UPDATE drivers SET last_location_update=NOW()-INTERVAL '5 minutes' WHERE id=$1", driver_id)
    run(age())
    run(maintenance.run_once())
    assert run(client.get(f"/api/orders/{o['id']}", headers=h(pas))).json()["status"] == "no_drivers"
    async def online():
        async with database.pool.acquire() as conn:
            return await conn.fetchval("SELECT is_online FROM drivers WHERE id=$1", driver_id)
    assert run(online()) is False
