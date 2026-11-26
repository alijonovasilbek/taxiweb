"""Taksi: yagona akkaunt (Mini App ijrochi rejimi) orqali buyurtmani qabul qilish — boshidan oxirigacha."""
from app import database
from tests.test_services_flow import ADMIN_TG, CHORTOQ, client, h, login, loop, run, upload_docs  # noqa: F401


def test_taxi_flow_with_unified_account(client):
    admin = login(client, "Admin", "admin", ADMIN_TG)
    drv = login(client, "Taksichi")
    pas = login(client, "Yo'lovchi")

    # Hali haydovchi emas
    assert run(client.get("/api/orders/driver/active", headers=h(drv))).json()["driver"] is None

    v = run(client.post("/api/vehicles", headers=h(drv), json={
        "category": "sedan", "model": "Cobalt", "color": "Oq", "plate_number": f"50T{CHORTOQ['lat']:.0f}{id(drv) % 1000:03d}AA", "seats": 4,
    })).json()
    upload_docs(client, drv, v)
    assert run(client.put(f"/api/admin/vehicles/{v['id']}/approve", headers=h(admin))).status_code == 200

    # Tasdiqlangach `drivers` yozuvi avtomatik (taksi dispetcherligi uchun)
    st = run(client.get("/api/orders/driver/active", headers=h(drv))).json()
    assert st["driver"] and st["driver"]["status"] == "approved" and st["driver"]["car_model"] == "Cobalt"
    driver_id = st["driver"]["id"]

    # Onlayn + joylashuv (Mini App buni socket orqali qiladi)
    async def go_online():
        async with database.pool.acquire() as conn:
            await conn.execute(
                "UPDATE drivers SET is_online=true, is_on_ride=false, current_location=ST_MakePoint($2,$1)::geography, "
                "last_location_update=NOW() WHERE id=$3", CHORTOQ["lat"], CHORTOQ["lng"], driver_id)
    run(go_online())

    r = run(client.post("/api/orders", headers=h(pas), json={
        "pickup": {"address": "Chortoq markazi", **CHORTOQ},
        "dropoff": {"address": "Bozor", "lat": CHORTOQ["lat"] + 0.01, "lng": CHORTOQ["lng"] + 0.01},
        "payment_method": "click",
    }))
    assert r.status_code == 201, r.text
    order = r.json()
    assert order["payment_method"] == "click"  # avval har doim "cash" bo'lib qolardi

    # Dispetcher eng yaqin haydovchiga taklif qiladi (B7); boshqa test haydovchilari yaqin bo'lsa ham shu haydovchiga
    from tests.test_authz import offer
    run(offer(order["id"], driver_id))

    # Haydovchi Mini App tokeni bilan qabul qiladi va bosqichma-bosqich yakunlaydi
    assert run(client.put(f"/api/orders/{order['id']}/accept", headers=h(drv))).status_code == 200
    active = run(client.get("/api/orders/driver/active", headers=h(drv))).json()["order"]
    assert active["id"] == order["id"] and active["passenger_name"] == "Yo'lovchi"
    for step in ("arrived", "start", "complete"):
        assert run(client.put(f"/api/orders/{order['id']}/{step}", headers=h(drv))).status_code == 200
    done = run(client.get(f"/api/orders/{order['id']}", headers=h(pas))).json()
    assert done["status"] == "completed" and done["driver_id"] == driver_id
    assert run(client.get("/api/orders/driver/active", headers=h(drv))).json()["order"] is None

    # Transport o'chirilsa — dispetcherlikdan chiqadi
    run(client.delete(f"/api/vehicles/{v['id']}", headers=h(drv)))
    assert run(client.get("/api/orders/driver/active", headers=h(drv))).json()["driver"]["status"] == "pending"
