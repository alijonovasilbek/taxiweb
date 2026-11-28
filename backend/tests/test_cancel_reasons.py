"""Bekor qilish sabablari: kod bilan saqlanadi (analitika), noma'lum kod rad etiladi."""
from app import database
from tests.test_client_app import CLI, _login, _verify_phone  # noqa: F401
from tests.test_mobile import _bearer
from tests.test_services_flow import client, loop, run  # noqa: F401

HERE = {"lat": CLI["lat"] + 0.7, "lng": CLI["lng"] - 0.7}


def test_cancel_with_reason_code(client):
    tokens, _ = _login(client, "client")
    me = run(client.get("/api/users/me", headers=_bearer(tokens))).json()
    run(_verify_phone(me["id"]))

    reasons = run(client.get("/api/orders/cancel-reasons", params={"role": "passenger"})).json()
    assert {"code": "wait_long", "label": "Haydovchi juda uzoq"} in reasons
    driver_reasons = run(client.get("/api/orders/cancel-reasons", params={"role": "driver"})).json()
    assert any(r["code"] == "passenger_no_show" for r in driver_reasons)

    trip = {"pickup": {**HERE, "address": "A"}, "dropoff": {"lat": HERE["lat"] + 0.02, "lng": HERE["lng"], "address": "B"},
            "road_distance_km": 3, "road_duration_min": 8}
    order = run(client.post("/api/orders", headers=_bearer(tokens), json=trip)).json()

    # Haydovchi sababi yo'lovchi uchun yaroqsiz
    r = run(client.put(f"/api/orders/{order['id']}/cancel", headers=_bearer(tokens), json={"reason_code": "passenger_no_show"}))
    assert r.status_code == 400
    r = run(client.put(f"/api/orders/{order['id']}/cancel", headers=_bearer(tokens),
                       json={"reason_code": "other", "reason": "Mehmon keldi"}))
    assert r.status_code == 200, r.text

    async def row():
        async with database.pool.acquire() as conn:
            return await conn.fetchrow("SELECT cancel_reason, cancel_reason_code, cancelled_by FROM orders WHERE id=$1", order["id"])
    saved = run(row())
    assert (saved["cancel_reason_code"], saved["cancelled_by"], saved["cancel_reason"]) == ("other", "passenger", "Mehmon keldi")

    order2 = run(client.post("/api/orders", headers=_bearer(tokens), json=trip)).json()
    run(client.put(f"/api/orders/{order2['id']}/cancel", headers=_bearer(tokens), json={"reason_code": "wait_long"}))

    async def row2():
        async with database.pool.acquire() as conn:
            return await conn.fetchval("SELECT cancel_reason FROM orders WHERE id=$1", order2["id"])
    assert run(row2()) == "Haydovchi juda uzoq"
