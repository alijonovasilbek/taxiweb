"""Login/parol bilan kirish va admin panelda ijrochi/transport/hujjatlarni boshqarish."""
import random

from app import database
from app.redis_client import get_redis
from app.services import credentials
from tests.test_mobile import _app_login, _bearer, _device, _tg_user, ip
from tests.test_services_flow import (  # noqa: F401
    ADMIN_TG, PNG, client, h, login, loop, run,
)


def _pw_login(client, login_, password, device=None):
    return run(client.post("/api/auth/app/password", headers=ip(), json={
        "login": login_, "password": password, "device_id": device or _device(), "device_name": "BlueStacks"}))


async def _ensure(tg_id):
    async with database.pool.acquire() as conn:
        return await credentials.ensure_credentials(conn, tg_id)


def test_first_telegram_login_gives_password(client):
    tg = _tg_user("Parolchi")
    tokens, _ = _app_login(client, tg)
    # Bot birinchi kirishdan keyin login/parol yaratadi — ikkinchi marta yaratmaydi
    creds = run(_ensure(tg.id))
    assert creds and len(creds[1]) == 8
    assert run(_ensure(tg.id)) is None
    login_, password = creds
    assert "password_hash" not in run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    me = run(client.get("/api/auth/app/credentials", headers=_bearer(tokens))).json()
    assert me["login"] == login_ and me["has_password"] is True

    r = _pw_login(client, login_.upper(), password)
    assert r.status_code == 200, r.text
    t2 = r.json()
    assert run(client.get("/api/users/me", headers=_bearer(t2))).json()["first_name"] == "Parolchi"
    assert _pw_login(client, login_, "notogri").status_code == 401

    # Parolni ilovada almashtirish
    r = run(client.put("/api/auth/app/password", headers=_bearer(t2),
                       json={"old_password": "xato", "new_password": "yangi123"}))
    assert r.status_code == 400
    r = run(client.put("/api/auth/app/password", headers=_bearer(t2),
                       json={"old_password": password, "new_password": "yangi123"}))
    assert r.status_code == 200
    assert _pw_login(client, login_, password).status_code == 401
    assert _pw_login(client, login_, "yangi123").status_code == 200


def test_password_bruteforce_lock(client):
    tg = _tg_user()
    _app_login(client, tg)
    login_, password = run(_ensure(tg.id))
    for _ in range(8):
        assert _pw_login(client, login_, "xato-parol").status_code == 401
    # To'g'ri parol bilan ham — vaqtincha bloklangan
    assert _pw_login(client, login_, password).status_code == 429
    run(get_redis().delete(f"pwfail:{login_}"))
    assert _pw_login(client, login_, password).status_code == 200


def test_phone_login_and_normalization():
    assert credentials.norm_login("+998 90 123-45-67") == "998901234567"
    assert credentials.norm_login("90 123 45 67") == "998901234567"
    assert credentials.norm_login("  ID15 ") == "id15"


def test_admin_manages_provider(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    phone = f"+99893{random.randint(1000000, 9999999)}"
    # Telegram'siz ijrochi: admin qo'shadi, login/parol bilan kiradi
    r = run(client.post("/api/admin/users", headers=h(admin), json={
        "first_name": "Admin qo'shgan", "last_name": "Haydovchi", "phone": phone, "password": "boshlang1"}))
    assert r.status_code == 201, r.text
    u = r.json()
    assert u["telegram_id"] < 0 and u["has_password"] and u["phone_verified"]
    assert u["credentials"]["login"] == phone[1:] and u["credentials"]["sent"] is False
    assert "password_hash" not in u
    r = _pw_login(client, phone, "boshlang1")
    assert r.status_code == 200, r.text
    tokens = r.json()

    # Takroriy telefon
    r = run(client.post("/api/admin/users", headers=h(admin), json={"first_name": "X", "phone": phone}))
    assert r.status_code == 409

    # Tahrirlash
    r = run(client.put(f"/api/admin/users/{u['id']}", headers=h(admin), json={
        "first_name": "Tahrirlangan", "last_name": "Ism", "phone": phone, "company_name": "Chortoq Trans"}))
    assert r.status_code == 200 and r.json()["first_name"] == "Tahrirlangan"

    # Transport: admin qo'shadi, hujjatlarni o'zi yuklaydi va tasdiqlaydi
    r = run(client.post(f"/api/admin/users/{u['id']}/vehicles", headers=h(admin), json={
        "category": "sedan", "model": "Cobalt", "plate_number": "50 c 777 aa", "seats": 4}))
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["plate_number"] == "50C777AA"
    for code in ("passport", "license", "tech_passport"):
        r = run(client.post(f"/api/admin/vehicles/{v['id']}/documents", headers=h(admin),
                            data={"doc_type": code}, files={"file": (f"{code}.png", PNG, "image/png")}))
        assert r.status_code == 201, r.text
        assert r.json()["status"] == "approved"
    full = run(client.get(f"/api/admin/users/{u['id']}", headers=h(admin))).json()
    assert full["vehicles"][0]["missing_docs"] == [] and len(full["vehicles"][0]["documents"]) == 3
    assert run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin))).status_code == 200
    r = run(client.post(f"/api/admin/vehicles/{v['id']}/photo", headers=h(admin),
                        files={"file": ("car.png", PNG, "image/png")}))
    assert r.status_code == 200 and r.json()["photo_url"].startswith("/uploads/")

    # Ijrochi ilovada o'z transportini ko'radi
    mine = run(client.get("/api/vehicles/my", headers=_bearer(tokens))).json()
    assert mine[0]["status"] == "approved"

    r = run(client.put(f"/api/admin/vehicles/{v['id']}", headers=h(admin), json={
        "category": "sedan", "model": "Gentra", "plate_number": "50C777AA", "seats": 4}))
    assert r.status_code == 200 and r.json()["model"] == "Gentra"
    doc_id = full["vehicles"][0]["documents"][0]["id"]
    assert run(client.delete(f"/api/admin/documents/{doc_id}", headers=h(admin))).status_code == 200

    # Parolni tiklash
    r = run(client.post(f"/api/admin/users/{u['id']}/credentials", headers=h(admin), json={"send": True}))
    assert r.status_code == 200 and len(r.json()["password"]) == 8 and r.json()["sent"] is False
    assert _pw_login(client, phone, "boshlang1").status_code == 401
    assert _pw_login(client, phone, r.json()["password"]).status_code == 200
    r = run(client.post(f"/api/admin/users/{u['id']}/credentials", headers=h(admin), json={"password": "123"}))
    assert r.status_code == 422

    # O'chirish: transport, keyin foydalanuvchi (sessiyalari ham yopiladi)
    assert run(client.delete(f"/api/admin/vehicles/{v['id']}", headers=h(admin))).status_code == 200
    assert run(client.delete(f"/api/admin/users/{u['id']}", headers=h(admin))).status_code == 200
    assert run(client.get(f"/api/admin/users/{u['id']}", headers=h(admin))).status_code == 404
    assert run(client.get("/api/users/me", headers=_bearer(tokens))).status_code == 401


def test_admin_endpoints_require_admin(client):
    user = login(client, "Oddiy")
    assert run(client.post("/api/admin/users", headers=h(user), json={"first_name": "X"})).status_code in (401, 403)
    assert run(client.delete("/api/admin/users/1", headers=h(user))).status_code in (401, 403)
