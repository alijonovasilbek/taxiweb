"""Chortoq Services — end-to-end ssenariy testlari (haqiqiy PostgreSQL + PostGIS bazada).

Ishga tushirish:  cd backend && .venv/Scripts/python -m pytest -q
Talab: DEV_MODE=true, ADMIN_TELEGRAM_IDS ichida 123456789, migratsiyalar qo'llangan.
"""
import asyncio
import random
from datetime import datetime, timedelta

import httpx
import pytest

from app import database, redis_client
from app.config import settings
from main import app

ADMIN_TG = settings.admin_ids[0] if settings.admin_ids else 123456789
CHORTOQ = {"lat": 41.0694, "lng": 71.8237}
# Test foydalanuvchilari shu telegram_id oralig'ida yaratiladi va oxirida o'chiriladi
TEST_TG_MIN, TEST_TG_MAX = 8_000_000_000, 8_999_999_999
NAMANGAN = {"lat": 40.9983, "lng": 71.6726}


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


async def _cleanup():
    async with database.pool.acquire() as conn:
        rng = (TEST_TG_MIN, TEST_TG_MAX)
        orders = """SELECT id FROM orders WHERE passenger_id IN (SELECT id FROM users WHERE telegram_id BETWEEN $1 AND $2)
                    OR driver_id IN (SELECT id FROM drivers WHERE telegram_id BETWEEN $1 AND $2)"""
        for table in ("payments", "ratings"):
            await conn.execute(f"DELETE FROM {table} WHERE order_id IN ({orders})", *rng)
        await conn.execute(f"DELETE FROM orders WHERE id IN ({orders})", *rng)
        await conn.execute("DELETE FROM drivers WHERE telegram_id BETWEEN $1 AND $2", *rng)
        await conn.execute("DELETE FROM users WHERE telegram_id BETWEEN $1 AND $2", *rng)


@pytest.fixture(scope="module")
def loop():
    lp = asyncio.new_event_loop()
    asyncio.set_event_loop(lp)
    lp.run_until_complete(database.init_pool())
    lp.run_until_complete(redis_client.init_redis())
    lp.run_until_complete(_cleanup())
    yield lp
    lp.run_until_complete(_cleanup())
    lp.run_until_complete(database.close_pool())
    lp.close()


@pytest.fixture(scope="module")
def client(loop):
    transport = httpx.ASGITransport(app=app)
    c = httpx.AsyncClient(transport=transport, base_url="http://test")
    yield c
    loop.run_until_complete(c.aclose())


def login(client, name: str, role: str = "passenger", tg: int | None = None) -> dict:
    tg = tg or random.randint(TEST_TG_MIN, TEST_TG_MAX)
    r = run(client.post("/api/auth/dev-login", json={"telegram_id": tg, "role": role, "first_name": name}))
    assert r.status_code == 200, r.text
    data = r.json()
    return {"Authorization": f"Bearer {data['token']}", "_user": data.get("user")}


def h(auth):
    return {"Authorization": auth["Authorization"]}


def test_catalog_and_profile(client):
    r = run(client.get("/api/catalog"))
    assert r.status_code == 200
    body = r.json()
    codes = {s["code"] for s in body["services"]}
    assert {"taxi", "carpool", "cargo", "equipment"} <= codes
    assert any(c["code"] == "labo" for c in body["vehicle_categories"])

    u = login(client, "Ali")
    me = run(client.get("/api/users/me", headers=h(u))).json()
    assert me["roles"] == ["client"]
    assert "stats" in me
    r = run(client.put("/api/users/me/roles", headers=h(u), json={"roles": ["cargo", "company"]}))
    # Rollarni erkin yoqib bo'lmaydi — tasdiqlangan transport kerak
    assert r.status_code == 403
    assert me["eligible_roles"] == ["client"]
    r = run(client.put("/api/users/me/roles", headers=h(u), json={"roles": ["hacker"]}))
    assert r.status_code == 422
    # Telefon profil orqali o'zgarmaydi — faqat Telegram (dev rejimda /phone/dev) orqali tasdiqlanadi
    r = run(client.put("/api/users/me", headers=h(u), json={"phone": "+998900000000", "company_name": "Chortoq Qurilish"}))
    assert r.json()["company_name"] == "Chortoq Qurilish" and r.json()["phone"] is None
    r = run(client.post("/api/users/me/phone/dev", headers=h(u), json={"phone": "90 123 45 67"}))
    assert r.json()["phone"] == "+998901234567" and r.json()["phone_verified"] is True


PNG = bytes([0x89]) + b"PNG" + bytes([13, 10, 26, 10]) + b"0" * 64


def upload_docs(client, auth, v):
    for code in ("passport", "license", "tech_passport"):
        r = run(client.post(f"/api/vehicles/{v['id']}/documents", headers=h(auth),
                            data={"doc_type": code}, files={"file": (f"{code}.png", PNG, "image/png")}))
        assert r.status_code == 201, r.text


def _vehicle(client, auth, admin, **kw):
    r = run(client.post("/api/vehicles", headers=h(auth), json=kw))
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["status"] == "pending"
    # Hujjatlarsiz tasdiqlanmaydi
    r = run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin)))
    assert r.status_code == 400 and "Hujjatlar yetishmaydi" in r.text
    upload_docs(client, auth, v)
    r = run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin)))
    assert r.status_code == 200, r.text
    run(client.put(f"/api/vehicles/{v['id']}/availability", headers=h(auth),
                   json={"is_available": True, **CHORTOQ, "address": "Chortoq markazi"}))
    return v


def test_cargo_flow_with_cross_service_matching(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    client_u = login(client, "Mijoz")
    labo_owner = login(client, "Labochi")
    damas_owner = login(client, "Damaschi")  # Damas: po'puti + yuk (sohalararo)

    labo = _vehicle(client, labo_owner, admin, category="labo", model="Labo", plate_number="50 A 123 BC",
                    capacity_kg=800, price_per_km=3000)
    damas = _vehicle(client, damas_owner, admin, category="damas", model="Damas", plate_number="50B456CD", seats=6)

    me = run(client.get("/api/users/me", headers=h(labo_owner))).json()
    assert "cargo" in me["roles"]  # transport qo'shilganda rol avtomatik

    # Tasdiqlanmagan transport bilan taklif berib bo'lmaydi
    pending = run(client.post("/api/vehicles", headers=h(labo_owner),
                              json={"category": "gazel", "model": "Gazel Next"})).json()

    r = run(client.post("/api/requests", headers=h(client_u), json={
        "service_type": "cargo", "title": "Sement tashish", "weight_kg": 500,
        "from": {"address": "Chortoq bozori", **CHORTOQ},
        "to": {"address": "Namangan", **NAMANGAN},
        "budget": 300000, "phone": "+998900000001",
    }))
    assert r.status_code == 201, r.text
    req = r.json()
    assert req["status"] == "open"
    assert req["estimated_price"] and req["distance_km"] > 0
    assert req["matched_providers"] >= 2

    # Ijrochilar lentasi: Labo va Damas (sohalararo) ikkalasi ham ko'radi
    for owner in (labo_owner, damas_owner):
        feed = run(client.get("/api/requests/feed", headers=h(owner))).json()
        assert any(x["id"] == req["id"] for x in feed["requests"]), feed
        assert all("phone" not in x for x in feed["requests"])

    # Mijozning o'zi lentada o'z so'rovini ko'rmaydi
    r = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(labo_owner),
                        json={"vehicle_id": pending["id"], "price": 250000}))
    assert r.status_code == 403

    o1 = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(labo_owner),
                         json={"vehicle_id": labo["id"], "price": 280000, "message": "1 soatda boraman"}))
    assert o1.status_code == 201, o1.text
    o2 = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(damas_owner),
                         json={"vehicle_id": damas["id"], "price": 260000}))
    assert o2.status_code == 201, o2.text
    # Taklifni yangilash (upsert)
    o2b = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(damas_owner),
                          json={"vehicle_id": damas["id"], "price": 250000}))
    assert o2b.json()["id"] == o2.json()["id"] and float(o2b.json()["price"]) == 250000

    detail = run(client.get(f"/api/requests/{req['id']}", headers=h(client_u))).json()
    assert len(detail["offers"]) == 2
    assert detail["offers"][0]["price"] <= detail["offers"][1]["price"]
    assert detail["offers"][0].get("provider_phone") is None

    # Begona foydalanuvchi telefonni ko'rmaydi
    other = run(client.get(f"/api/requests/{req['id']}", headers=h(labo_owner))).json()
    assert "phone" not in other and other["my_offer"]["status"] == "pending"

    r = run(client.post(f"/api/requests/{req['id']}/offers/{o1.json()['id']}/accept", headers=h(client_u)))
    assert r.status_code == 200, r.text
    acc = r.json()
    assert acc["status"] == "assigned" and acc["provider_id"] == o1.json()["provider_id"]
    statuses = {o["id"]: o["status"] for o in acc["offers"]}
    assert statuses[o1.json()["id"]] == "accepted" and statuses[o2.json()["id"]] == "rejected"

    # Ikkinchi marta qabul qilib bo'lmaydi
    r = run(client.post(f"/api/requests/{req['id']}/offers/{o2.json()['id']}/accept", headers=h(client_u)))
    assert r.status_code in (404, 409)

    job = run(client.get(f"/api/requests/{req['id']}", headers=h(labo_owner))).json()
    assert job["is_provider"] and job["client_phone"] == "+998900000001"

    assert run(client.post(f"/api/requests/{req['id']}/start", headers=h(labo_owner))).status_code == 200
    assert run(client.post(f"/api/requests/{req['id']}/complete", headers=h(labo_owner))).status_code == 200

    r = run(client.post("/api/reviews", headers=h(client_u),
                        json={"service_type": "cargo", "ref_id": req["id"], "rating": 4, "comment": "Yaxshi"}))
    assert r.status_code == 201, r.text
    r = run(client.post("/api/reviews", headers=h(client_u),
                        json={"service_type": "cargo", "ref_id": req["id"], "rating": 5}))
    assert r.status_code == 409
    r = run(client.post("/api/reviews", headers=h(labo_owner),
                        json={"service_type": "cargo", "ref_id": req["id"], "rating": 5}))
    assert r.status_code == 201
    prov = run(client.get(f"/api/users/{acc['provider_id']}/public", headers=h(client_u))).json()
    assert float(prov["provider_rating"]) == 4.0 and prov["provider_reviews"] == 1

    # Bildirishnomalar fon vazifasida (asyncio.create_task) yuboriladi — biroz kutamiz
    for _ in range(30):
        notes = run(client.get("/api/notifications", headers=h(labo_owner))).json()
        types = {n["type"] for n in notes["items"]}
        if {"request_new", "offer_accepted", "vehicle_status"} <= types:
            break
        run(asyncio.sleep(0.1))
    assert {"request_new", "offer_accepted", "vehicle_status"} <= types
    run(client.put("/api/notifications/read-all", headers=h(labo_owner)))
    assert run(client.get("/api/notifications/unread-count", headers=h(labo_owner))).json()["unread"] == 0


def test_equipment_flow_and_provider_withdraw(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    client_u = login(client, "Quruvchi")
    owner = login(client, "Ekskavatorchi")
    exc = _vehicle(client, owner, admin, category="excavator", model="JCB 3CX", price_per_hour=250000)
    run(client.put("/api/schedules/me", headers=h(owner), json={"slots": [
        {"weekday": d, "start_time": "08:00", "end_time": "18:00"} for d in range(6)
    ]}))
    sched = run(client.get("/api/schedules/me", headers=h(owner))).json()
    assert len(sched) == 6 and sched[0]["start_time"] == "08:00"

    when = (datetime.now() + timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    r = run(client.post("/api/requests", headers=h(client_u), json={
        "service_type": "equipment", "vehicle_category": "excavator", "work_volume": "Poydevor qazish 40 m3",
        "duration_value": 4, "duration_unit": "hour", "from": {"address": "Chortoq, Yangi mahalla", **CHORTOQ},
        "scheduled_at": when.isoformat(), "budget": 1200000,
    }))
    assert r.status_code == 201, r.text
    req = r.json()
    assert float(req["estimated_price"]) == 1000000  # 4 soat * 250 000

    matches = run(client.get(f"/api/requests/{req['id']}/matches", headers=h(client_u))).json()
    top = next(m for m in matches if m["id"] == exc["id"])
    assert top["availability"] == "jadval bo'yicha bo'sh" and top["expected_price"] == 1000000

    # Noto'g'ri kategoriya bilan taklif
    labo = _vehicle(client, owner, admin, category="labo", model="Labo")
    r = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(owner),
                        json={"vehicle_id": labo["id"], "price": 900000}))
    assert r.status_code == 400

    o = run(client.post(f"/api/requests/{req['id']}/offers", headers=h(owner),
                        json={"vehicle_id": exc["id"], "price": 950000})).json()
    run(client.post(f"/api/requests/{req['id']}/offers/{o['id']}/accept", headers=h(client_u)))
    # Ijrochi voz kechadi — so'rov yana ochiladi
    r = run(client.post(f"/api/requests/{req['id']}/cancel", headers=h(owner), json={"reason": "Texnika buzildi"}))
    assert r.status_code == 200 and r.json()["reopened"]
    d = run(client.get(f"/api/requests/{req['id']}", headers=h(client_u))).json()
    assert d["status"] == "open" and d["provider_id"] is None
    # Mijoz bekor qiladi
    assert run(client.post(f"/api/requests/{req['id']}/cancel", headers=h(client_u), json={})).status_code == 200
    my = run(client.get("/api/requests/my", headers=h(client_u))).json()
    assert my[0]["status"] == "cancelled"


def test_carpool_flow(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    driver = login(client, "Haydovchi")
    p1 = login(client, "Yo'lovchi1")
    p2 = login(client, "Yo'lovchi2")
    car = _vehicle(client, driver, admin, category="sedan", model="Cobalt", plate_number="50C777AA", seats=4)

    dep = (datetime.now() + timedelta(days=1)).replace(hour=7, minute=30, second=0, microsecond=0)
    price = run(client.get("/api/carpool/suggest-price", headers=h(driver), params={
        "from_lat": CHORTOQ["lat"], "from_lng": CHORTOQ["lng"], "to_lat": NAMANGAN["lat"], "to_lng": NAMANGAN["lng"]
    })).json()
    assert price["suggested_price_per_seat"] >= 5000

    r = run(client.post("/api/carpool/trips", headers=h(driver), json={
        "vehicle_id": car["id"], "from": {"address": "Chortoq", **CHORTOQ}, "to": {"address": "Namangan", **NAMANGAN},
        "departure_at": dep.isoformat(), "seats_total": 3, "price_per_seat": 15000,
        "recurring_days": [0, 1, 2, 3, 4], "note": "Har kuni ertalab",
    }))
    assert r.status_code == 201, r.text
    trip = r.json()
    assert trip["seats_available"] == 3

    r = run(client.post("/api/carpool/trips", headers=h(driver), json={
        "vehicle_id": car["id"], "from": {"address": "A", **CHORTOQ}, "to": {"address": "B", **NAMANGAN},
        "departure_at": dep.isoformat(), "seats_total": 9, "price_per_seat": 15000,
    }))
    assert r.status_code == 400  # o'rinlar transport sig'imidan ko'p

    found = run(client.get("/api/carpool/trips/search", headers=h(p1), params={
        "from_lat": 41.07, "from_lng": 71.82, "to_lat": 41.0, "to_lng": 71.67, "date": dep.date().isoformat(), "seats": 2,
    })).json()
    assert any(t["id"] == trip["id"] for t in found), found
    far = run(client.get("/api/carpool/trips/search", headers=h(p1), params={
        "from_lat": 41.3, "from_lng": 69.24, "seats": 1,
    })).json()
    assert all(t["id"] != trip["id"] for t in far)

    b1 = run(client.post(f"/api/carpool/trips/{trip['id']}/book", headers=h(p1), json={"seats": 2, "phone": "+998901111111"}))
    assert b1.status_code == 201, b1.text
    assert run(client.post(f"/api/carpool/trips/{trip['id']}/book", headers=h(p1), json={"seats": 1})).status_code == 409
    b2 = run(client.post(f"/api/carpool/trips/{trip['id']}/book", headers=h(p2), json={"seats": 2}))
    assert b2.status_code == 201

    assert run(client.post(f"/api/carpool/bookings/{b1.json()['id']}/confirm", headers=h(p2))).status_code == 403
    r = run(client.post(f"/api/carpool/bookings/{b1.json()['id']}/confirm", headers=h(driver)))
    assert r.status_code == 200 and r.json()["seats_available"] == 1
    r = run(client.post(f"/api/carpool/bookings/{b2.json()['id']}/confirm", headers=h(driver)))
    assert r.status_code == 409  # 1 ta o'rin qoldi, 2 ta so'ralgan

    detail = run(client.get(f"/api/carpool/trips/{trip['id']}", headers=h(driver))).json()
    assert detail["is_owner"] and len(detail["bookings"]) == 2
    pview = run(client.get(f"/api/carpool/trips/{trip['id']}", headers=h(p1))).json()
    assert pview["my_booking"]["status"] == "confirmed"

    # Bekor qilish o'rinni qaytaradi
    assert run(client.post(f"/api/carpool/bookings/{b1.json()['id']}/cancel", headers=h(p1))).status_code == 200
    assert run(client.get(f"/api/carpool/trips/{trip['id']}", headers=h(p1))).json()["seats_available"] == 3
    b3 = run(client.post(f"/api/carpool/trips/{trip['id']}/book", headers=h(p1), json={"seats": 1})).json()
    run(client.post(f"/api/carpool/bookings/{b3['id']}/confirm", headers=h(driver)))

    assert run(client.put(f"/api/carpool/trips/{trip['id']}/status", headers=h(driver), json={"status": "departed"})).status_code == 200
    assert run(client.put(f"/api/carpool/trips/{trip['id']}/status", headers=h(driver), json={"status": "active"})).status_code == 409
    assert run(client.put(f"/api/carpool/trips/{trip['id']}/status", headers=h(driver), json={"status": "completed"})).status_code == 200

    mine = run(client.get("/api/carpool/bookings/my", headers=h(p1))).json()
    done = next(b for b in mine if b["id"] == b3["id"])
    assert done["status"] == "completed" and done["reviewed"] is False
    r = run(client.post("/api/reviews", headers=h(p1), json={"service_type": "carpool", "ref_id": b3["id"], "rating": 5}))
    assert r.status_code == 201, r.text
    # b2 (pending) yakunlanganda rad etilgan bo'lishi kerak
    p2b = run(client.get("/api/carpool/bookings/my", headers=h(p2))).json()
    assert p2b[0]["status"] == "rejected"


def test_smart_search_and_admin(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    u = login(client, "Qidiruvchi")
    res = run(client.get("/api/search", headers=h(u), params={**CHORTOQ}))
    assert res.status_code == 200, res.text
    data = res.json()
    assert {"trips", "providers", "open_requests", "cross_service_tips"} <= set(data)
    assert data["providers"], "Chortoq atrofida ijrochilar topilishi kerak"
    scores = [p["score"] for p in data["providers"]]
    assert scores == sorted(scores, reverse=True)

    only_exc = run(client.get("/api/search", headers=h(u), params={"service": "equipment", "category": "excavator", **CHORTOQ})).json()
    assert all(p["category"] == "excavator" for p in only_exc["providers"])

    def set_crane(per_shift):
        r = run(client.post("/api/admin/service-tariffs", headers=h(admin), json={
            "service_type": "equipment", "vehicle_category": "crane", "per_hour": 350000,
            "per_shift": per_shift, "per_day": 3000000, "min_price": 350000}))
        assert r.status_code == 200 and float(r.json()["per_shift"]) == per_shift

    def crane_price():
        return run(client.get("/api/tariffs/estimate", headers=h(u), params={
            "service": "equipment", "category": "crane", "duration_value": 1, "duration_unit": "shift"})).json()["estimated_price"]

    set_crane(2700000)
    assert crane_price() == 2700000
    set_crane(2600000)
    assert crane_price() == 2600000

    ov = run(client.get("/api/admin/overview", headers=h(admin)))
    assert ov.status_code == 200 and len(ov.json()["by_day"]) == 7
    for path in ("/api/admin/users", "/api/admin/vehicles", "/api/admin/carpool/trips", "/api/admin/requests",
                 "/api/admin/service-types", "/api/admin/service-tariffs"):
        r = run(client.get(path, headers=h(admin)))
        assert r.status_code == 200, (path, r.text)
    assert run(client.get("/api/admin/users", headers=h(u))).status_code in (401, 403)

    # Bloklangan foydalanuvchi API'dan foydalana olmaydi
    target = login(client, "Buzg'unchi")
    me = run(client.get("/api/users/me", headers=h(target))).json()
    run(client.put(f"/api/admin/users/{me['id']}/block", headers=h(admin), json={"reason": "spam"}))
    assert run(client.get("/api/users/me", headers=h(target))).status_code == 403
