"""Taksi tarif sinflari: narx har tarif uchun, buyurtma faqat mos sinfdagi haydovchiga boradi."""
from app import database
from app.services.matching_service import find_drivers_expanding
from tests.test_client_app import CLI, _login, _verify_phone  # noqa: F401
from tests.test_mobile import _bearer, _taxi_driver
from tests.test_services_flow import client, loop, run  # noqa: F401

# Boshqa testlarning hududlaridan uzoqda (qidiruv radiusi 30 km gacha kengayadi)
HERE = {"lat": CLI["lat"] - 0.6, "lng": CLI["lng"] + 0.6}


async def _tariff_ids() -> dict[str, int]:
    async with database.pool.acquire() as conn:
        return {r["code"]: r["id"] for r in await conn.fetch("SELECT id, code FROM tariffs WHERE code IS NOT NULL")}


def test_estimate_lists_every_active_tariff(client):
    tokens, _ = _login(client, "client")
    r = run(client.post("/api/maps/estimate", headers=_bearer(tokens), json={
        "from_lat": HERE["lat"], "from_lng": HERE["lng"], "to_lat": HERE["lat"] + 0.03, "to_lng": HERE["lng"],
        "distance_km": 4.2, "duration_min": 12}))
    assert r.status_code == 200, r.text
    body = r.json()
    names = [t["name"] for t in body["tariffs"]]
    assert names[:4] == ["Ekonom", "Komfort", "Biznes", "Miniven"]
    prices = {t["name"]: t["price"] for t in body["tariffs"]}
    assert prices["Ekonom"] < prices["Komfort"] < prices["Biznes"]
    assert body["price"] == prices["Ekonom"]  # Web App uchun standart narx
    assert "per_km_price" not in body["tariffs"][0]  # ichki koeffitsientlar ko'rinmaydi


def test_order_goes_only_to_matching_car_class(client):
    ids = run(_tariff_ids())
    tokens, _ = _login(client, "client")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    driver_id = run(_taxi_driver(me["id"], me["telegram_id"], HERE))

    async def found(level, seats):
        async with database.pool.acquire() as conn:
            return driver_id in [d["id"] for d in await find_drivers_expanding(conn, HERE["lat"], HERE["lng"], None, level, seats)]

    # Tarifsiz haydovchi = Ekonom: Ekonom buyurtmasini oladi, Biznes va Minivenni emas
    assert run(found(1, 1)) and not run(found(3, 4)) and not run(found(2, 6))

    admin_tokens, _ = _login(client, "client")  # admin emas — tarif biriktira olmaydi
    r = run(client.put(f"/api/admin/drivers/{driver_id}/tariff", headers=_bearer(admin_tokens), json={"tariff_id": ids["biznes"]}))
    assert r.status_code in (401, 403)

    async def set_tariff(code):
        async with database.pool.acquire() as conn:
            await conn.execute("UPDATE drivers SET tariff_id=$2 WHERE id=$1", driver_id, ids[code] if code else None)

    run(set_tariff("biznes"))  # Biznes mashina pastroq sinfni ham oladi, lekin 6 o'rinli buyurtmani emas
    assert run(found(1, 1)) and run(found(3, 4)) and not run(found(2, 6))
    run(set_tariff("miniven"))
    assert run(found(2, 6)) and not run(found(3, 4))
    run(set_tariff(None))


def test_order_with_tariff_uses_its_price(client):
    ids = run(_tariff_ids())
    tokens, _ = _login(client, "client")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_verify_phone(me["id"]))
    trip = {"pickup": {"lat": HERE["lat"], "lng": HERE["lng"] - 0.2, "address": "A"},
            "dropoff": {"lat": HERE["lat"] + 0.03, "lng": HERE["lng"] - 0.2, "address": "B"},
            "road_distance_km": 4.2, "road_duration_min": 12}
    est = run(client.post("/api/maps/estimate", headers=_bearer(tokens), json={
        "from_lat": trip["pickup"]["lat"], "from_lng": trip["pickup"]["lng"],
        "to_lat": trip["dropoff"]["lat"], "to_lng": trip["dropoff"]["lng"], "distance_km": 4.2, "duration_min": 12})).json()
    biznes = next(t for t in est["tariffs"] if t["id"] == ids["biznes"])

    r = run(client.post("/api/orders", headers=_bearer(tokens), json={**trip, "tariff_id": 999999}))
    assert r.status_code == 400
    r = run(client.post("/api/orders", headers=_bearer(tokens), json={**trip, "tariff_id": ids["biznes"]}))
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["tariff_id"] == ids["biznes"] and float(order["estimated_price"]) == biznes["price"]
    detail = run(client.get(f"/api/orders/{order['id']}", headers=_bearer(tokens))).json()
    assert detail["tariff_name"] == "Biznes"
    run(client.put(f"/api/orders/{order['id']}/cancel", headers=_bearer(tokens), json={}))
