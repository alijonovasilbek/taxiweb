"""Xavfsizlik va ro'yxatdan o'tish qoidalari testlari (KAMCHILIKLAR.md §2–3)."""
import json
import time
import hmac
import hashlib
import urllib.parse

from app.config import settings
from app.services.yandex_service import plausible_road
from tests.test_services_flow import ADMIN_TG, CHORTOQ, NAMANGAN, client, h, login, loop, run, upload_docs  # noqa: F401

PROXIED = {"X-Real-IP": "203.0.113.7"}  # ngrok/nginx orqali kelgan so'rov


def _signed(params: dict) -> str:
    """Telegram WebApp imzosi (initData / requestContact javobi) — test uchun."""
    p = {**params, "auth_date": str(int(time.time()))}
    dcs = "\n".join(f"{k}={v}" for k, v in sorted(p.items()))
    key = hmac.new(b"WebAppData", settings.telegram_bot_token.encode(), hashlib.sha256).digest()
    p["hash"] = hmac.new(key, dcs.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(p)


def test_dev_endpoints_are_local_only(client):
    # Lokal (to'g'ridan-to'g'ri) — ishlaydi
    u = login(client, "Lokal")
    # Proksi/tunnel orqali — dev-login ham, raqamni qo'lda tasdiqlash ham yopiq
    r = run(client.post("/api/auth/dev-login", headers=PROXIED, json={"telegram_id": 8_100_000_001, "role": "passenger"}))
    assert r.status_code == 403
    r = run(client.post("/api/users/me/phone/dev", headers={**h(u), **PROXIED}, json={"phone": "901112233"}))
    assert r.status_code == 403
    # Admin roli faqat ADMIN_TELEGRAM_IDS uchun
    r = run(client.post("/api/auth/dev-login", json={"telegram_id": 8_100_000_002, "role": "admin"}))
    assert r.status_code == 403


def test_phone_verification_and_onboarding(client):
    u = login(client, "Raqam")
    tg = run(client.get("/api/users/me", headers=h(u))).json()["telegram_id"]
    # Telefonsiz onboarding yakunlanmaydi
    assert run(client.post("/api/users/me/onboard", headers=h(u), json={"intent": "client"})).status_code == 400
    # Boshqa odamning kontakti — rad
    foreign = _signed({"contact": json.dumps({"phone_number": "998901234567", "user_id": 1})})
    assert run(client.post("/api/users/me/phone", headers=h(u), json={"response": foreign})).status_code == 403
    # O'zgartirilgan (soxta) javob — imzo mos emas
    own = _signed({"contact": json.dumps({"phone_number": "998901234567", "user_id": tg})})
    tampered = own.replace("998901234567", "998909999999")
    assert run(client.post("/api/users/me/phone", headers=h(u), json={"response": tampered})).status_code == 401
    # O'z kontakti — qabul
    r = run(client.post("/api/users/me/phone", headers=h(u), json={"response": own}))
    assert r.status_code == 200 and r.json()["phone"] == "+998901234567" and r.json()["phone_verified"] is True
    r = run(client.post("/api/users/me/onboard", headers=h(u), json={"intent": "provider"}))
    assert r.status_code == 200 and r.json()["onboarded_at"]


def test_roles_follow_approved_vehicles(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    u = login(client, "Ekskavatorchi")
    # Transport qo'shildi, lekin tasdiqlanmagan — rol yo'q, o'zi ham yoqa olmaydi
    v = run(client.post("/api/vehicles", headers=h(u), json={"category": "excavator", "model": "JCB 3CX"})).json()
    me = run(client.get("/api/users/me", headers=h(u))).json()
    assert me["roles"] == ["client"] and me["eligible_roles"] == ["client"]
    assert run(client.put("/api/users/me/roles", headers=h(u), json={"roles": ["equipment_owner"]})).status_code == 403
    # Ekskavator uchun majburiy: pasport + texpasport (guvohnoma shart emas)
    mine = run(client.get("/api/vehicles/my", headers=h(u))).json()
    assert {d["code"] for d in next(x for x in mine if x["id"] == v["id"])["missing_docs"]} == {"passport", "tech_passport"}
    assert run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin))).status_code == 400
    upload_docs(client, u, v)
    # Admin tasdiqladi — rol avtomatik
    assert run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin))).status_code == 200
    me = run(client.get("/api/users/me", headers=h(u))).json()
    assert "equipment_owner" in me["roles"] and "equipment_owner" in me["eligible_roles"]
    # Foydalanuvchi rolni vaqtincha o'chira oladi va qayta yoqa oladi
    assert run(client.put("/api/users/me/roles", headers=h(u), json={"roles": []})).json()["roles"] == ["client"]
    assert "equipment_owner" in run(client.put("/api/users/me/roles", headers=h(u), json={"roles": ["equipment_owner"]})).json()["roles"]
    # Transport o'chirilsa — rol ham ketadi
    run(client.delete(f"/api/vehicles/{v['id']}", headers=h(u)))
    assert run(client.get("/api/users/me", headers=h(u))).json()["roles"] == ["client"]


def test_carpool_requires_approved_vehicle(client):
    u = login(client, "Popputichi")
    trip = {"from": {"address": "Chortoq", **CHORTOQ}, "to": {"address": "Namangan", **NAMANGAN},
            "departure_at": "2030-01-01T08:00:00", "seats_total": 3, "price_per_seat": 15000}
    assert run(client.post("/api/carpool/trips", headers=h(u), json=trip)).status_code == 400
    v = run(client.post("/api/vehicles", headers=h(u), json={"category": "sedan", "model": "Cobalt", "seats": 4})).json()
    r = run(client.post("/api/carpool/trips", headers=h(u), json={**trip, "vehicle_id": v["id"]}))
    assert r.status_code == 403  # tasdiqlanmagan


def test_road_distance_plausibility():
    assert plausible_road(1.4, 3.25, 6)          # haqiqiy yo'l to'g'ri chiziqdan uzunroq
    assert not plausible_road(1.4, 0.5, 1)       # to'g'ri chiziqdan qisqa — soxta
    assert not plausible_road(1.4, 50, 60)       # 3 baravardan ortiq
    assert not plausible_road(10, 12, 1)         # 720 km/soat — imkonsiz


def test_saved_places(client):
    u = login(client, "Uyim")
    r = run(client.put("/api/users/me/places/home", headers=h(u), json={"address": "Xushdil koʻchasi, 18", **CHORTOQ}))
    assert r.status_code == 200 and r.json()["home"]["address"] == "Xushdil koʻchasi, 18"
    assert run(client.put("/api/users/me/places/dacha", headers=h(u), json={"address": "x", **CHORTOQ})).status_code == 400
    assert run(client.get("/api/users/me", headers=h(u))).json()["saved_places"]["home"]["lat"] == CHORTOQ["lat"]
    assert "home" not in run(client.delete("/api/users/me/places/home", headers=h(u))).json()


def test_admin_code_login_rejects_wrong_code(client):
    r = run(client.post("/api/auth/admin/request-code", json={"telegram_id": 8_100_000_003}))
    assert r.status_code == 200  # admin bo'lmasa ham bir xil javob (ID'ni bilib bo'lmaydi)
    r = run(client.post("/api/auth/admin/verify-code", json={"telegram_id": ADMIN_TG, "code": "000000"}))
    assert r.status_code == 401


def test_rate_limit(client):
    ip = f"198.51.100.{int(time.time() * 1000) % 250 + 1}"  # har ishga tushirishda yangi IP — oldingi hisoblagich ta'sir qilmasin
    codes = [run(client.post("/api/auth/verify-telegram", headers={"X-Real-IP": ip},
                             json={"initData": "hash=bad", "role": "passenger"})).status_code for _ in range(62)]  # 62: daqiqa chegarasiga tushsa ham bir oynada >30
    assert 429 in codes and codes[0] != 429


def test_popular_places_and_admin_audit(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    u = login(client, "Qidiruvchi")
    name = f"Chortoq test joyi {int(time.time()) % 100000}"
    r = run(client.post("/api/admin/places", headers=h(admin), json={"name": name, "address": "Chortoq markazi", **CHORTOQ}))
    assert r.status_code == 201
    place = r.json()
    # Oddiy foydalanuvchi qo'sha olmaydi
    assert run(client.post("/api/admin/places", headers=h(u), json={"name": "x" * 3, **CHORTOQ})).status_code in (401, 403)
    # Qidiruvda birinchi chiqadi (Yandex ishlamasa ham)
    found = run(client.post("/api/maps/suggest", headers=h(u), json={"text": name[:20], **CHORTOQ})).json()
    assert found and found[0]["title"] == name and found[0]["popular"] is True
    # Admin harakati jurnalga yozilgan
    items = run(client.get("/api/admin/audit", headers=h(admin))).json()["items"]
    assert any(i["path"] == "/api/admin/places" and i["method"] == "POST" and i["telegram_id"] == ADMIN_TG for i in items)
    run(client.delete(f"/api/admin/places/{place['id']}", headers=h(admin)))


def test_home_widget_preferences(client):
    u = login(client, "Vidjet")
    r = run(client.put("/api/users/me/preferences", headers=h(u), json={"home_hidden": ["cargo", "cargo", "equipment"]}))
    assert r.status_code == 200 and r.json()["home_hidden"] == ["cargo", "equipment"]
    assert run(client.put("/api/users/me/preferences", headers=h(u), json={"home_hidden": ["casino"]})).status_code == 422
    assert run(client.get("/api/users/me", headers=h(u))).json()["preferences"]["home_hidden"] == ["cargo", "equipment"]
