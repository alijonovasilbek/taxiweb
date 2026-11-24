"""Chortoq Services demo ma'lumotlari.

Ishga tushirish (backend papkasida):  .venv/Scripts/python -m seeds.demo_data
Qayta ishga tushirish xavfsiz — demo foydalanuvchilar (telegram_id 7000000001..) qayta yaratiladi.
`--for-tg <telegram_id>` berilsa, o'sha foydalanuvchi nomidan ham demo so'rov/bron yaratiladi.
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone

import asyncpg

from app.config import settings

TZ = timezone(timedelta(hours=5))
CHORTOQ = (41.0694, 71.8237)
NAMANGAN = (40.9983, 71.6726)
TOSHKENT = (41.2995, 69.2401)
UYCHI = (41.0806, 71.9233)

DEMO = [
    # tg_id, ism, familiya, telefon, rollar, transportlar [(kategoriya, model, raqam, kwargs, (lat,lng))]
    (7000000001, "Akmal", "Yo'ldoshev", "+998901110001", ["client", "driver"],
     [("sedan", "Chevrolet Cobalt", "50A111AA", {"seats": 4, "color": "Oq", "price_per_km": 2500}, (41.071, 71.821))]),
    (7000000002, "Bekzod", "Karimov", "+998901110002", ["client", "cargo", "driver"],
     [("damas", "Chevrolet Damas", "50B222BB", {"seats": 6, "capacity_kg": 600, "price_per_km": 2800}, (41.066, 71.829))]),
    (7000000003, "Dilshod", "Rahimov", "+998901110003", ["client", "cargo"],
     [("labo", "Chevrolet Labo", "50C333CC", {"capacity_kg": 900, "volume_m3": 3.2, "price_per_km": 3000}, (41.074, 71.815))]),
    (7000000004, "Farrux", "Toshpo'latov", "+998901110004", ["client", "cargo"],
     [("isuzu", "Isuzu NPR", "50D444DD", {"capacity_kg": 5000, "price_per_km": 6000}, (41.060, 71.840))]),
    (7000000005, "G'ayrat", "Nazarov", "+998901110005", ["client", "equipment_owner"],
     [("excavator", "JCB 3CX", None, {"price_per_hour": 250000, "price_per_shift": 1800000}, (41.080, 71.830)),
      ("loader", "Bobcat S530", None, {"price_per_hour": 200000}, (41.080, 71.830))]),
    (7000000006, "Hasan", "Qodirov", "+998901110006", ["client", "equipment_owner", "company"],
     [("crane", "Ivanovets 25t", "50E555EE", {"price_per_hour": 350000, "price_per_shift": 2600000}, (41.050, 71.800))]),
    (7000000007, "Ibrohim", "Sobirov", "+998901110007", ["client", "cargo", "equipment_owner"],
     [("dump_truck", "KamAZ 6520 samosval", "50F666FF", {"capacity_kg": 20000, "price_per_km": 8000, "price_per_hour": 220000}, (41.090, 71.850))]),
    (7000000010, "Jasur", "Mijozov", "+998901110010", ["client"], []),
]


def local(dt: datetime) -> datetime:
    return dt.astimezone(TZ).replace(tzinfo=None) if dt.tzinfo else dt


async def main(for_tg: int | None) -> None:
    conn = await asyncpg.connect(settings.database_url)
    try:
        ids = [d[0] for d in DEMO]
        await conn.execute("DELETE FROM users WHERE telegram_id = ANY($1::bigint[])", ids)
        user_ids: dict[int, int] = {}
        vehicles: dict[str, int] = {}
        for tg, fn, ln, phone, roles, vlist in DEMO:
            uid = await conn.fetchval(
                """INSERT INTO users(telegram_id, first_name, last_name, phone, roles, provider_rating, provider_reviews, bio)
                   VALUES($1,$2,$3,$4,$5::text[],$6,$7,$8) RETURNING id""",
                tg, fn, ln, phone, roles, 4.5 + (tg % 5) / 10, tg % 7 + 2,
                "Chortoq tumanida 5 yildan beri xizmat ko'rsataman" if len(roles) > 1 else None,
            )
            user_ids[tg] = uid
            for cat, model, plate, kw, (lat, lng) in vlist:
                cols = ["owner_id", "category", "model", "plate_number", "status", "is_available"] + list(kw)
                vals = [uid, cat, model, plate, "approved", True] + list(kw.values())
                ph = ", ".join(f"${i + 1}" for i in range(len(vals)))
                vid = await conn.fetchval(
                    f"""INSERT INTO vehicles({', '.join(cols)}, location, location_address, location_updated_at)
                        VALUES({ph}, ST_MakePoint(${len(vals) + 2},${len(vals) + 1})::geography, 'Chortoq', NOW())
                        RETURNING id""",
                    *vals, lat, lng,
                )
                vehicles[f"{tg}:{cat}"] = vid
            if len(roles) > 1:
                for d in range(6):
                    await conn.execute(
                        "INSERT INTO availability(user_id, weekday, start_time, end_time) VALUES($1,$2,'07:00','19:00')",
                        uid, d,
                    )

        now = local(datetime.now(TZ))
        tomorrow_730 = (now + timedelta(days=1)).replace(hour=7, minute=30, second=0, microsecond=0)

        async def trip(tg, cat, frm, to, dep, seats, price, days=None, note=None):
            return await conn.fetchval(
                """INSERT INTO carpool_trips(driver_id, vehicle_id, from_address, from_lat, from_lng, from_location,
                       to_address, to_lat, to_lng, to_location, departure_at, seats_total, seats_available,
                       price_per_seat, recurring_days, note)
                   VALUES($1,$2,$3,$4::float8,$5::float8,ST_MakePoint($5::float8,$4::float8)::geography,
                          $6,$7::float8,$8::float8,ST_MakePoint($8::float8,$7::float8)::geography,
                          $9,$10,$10,$11,$12::smallint[],$13) RETURNING id""",
                user_ids[tg], vehicles.get(f"{tg}:{cat}"), frm[0], frm[1][0], frm[1][1], to[0], to[1][0], to[1][1],
                dep, seats, price, days, note,
            )

        await trip(7000000001, "sedan", ("Chortoq markazi", CHORTOQ), ("Namangan, Bobur shoh ko'chasi", NAMANGAN),
                   tomorrow_730, 3, 15000, [0, 1, 2, 3, 4], "Har ish kuni ertalab, 18:00 da qaytaman")
        await trip(7000000002, "damas", ("Chortoq bozori", (41.0721, 71.8190)), ("Namangan, Chorsu", NAMANGAN),
                   tomorrow_730 + timedelta(minutes=30), 5, 12000, [0, 1, 2, 3, 4, 5])
        await trip(7000000001, "sedan", ("Chortoq", CHORTOQ), ("Toshkent, Olmazor", TOSHKENT),
                   tomorrow_730 + timedelta(days=1, hours=-2), 3, 150000, None, "Kamchiq dovoni orqali")

        client = user_ids[7000000010]

        async def request(cid, svc, cat, title, frm, to, budget, **kw):
            dist = 18.5 if to else None
            return await conn.fetchval(
                """INSERT INTO service_requests(service_type, client_id, vehicle_category, title, from_address, from_lat,
                       from_lng, from_location, to_address, to_lat, to_lng, to_location, distance_km, budget,
                       estimated_price, phone, weight_kg, work_volume, duration_value, duration_unit, scheduled_at)
                   VALUES($1,$2,$3,$4,$5,$6::float8,$7::float8,ST_MakePoint($7::float8,$6::float8)::geography,
                          $8,$9::float8,$10::float8,
                          CASE WHEN $9::float8 IS NULL THEN NULL ELSE ST_MakePoint($10::float8,$9::float8)::geography END,
                          $11,$12,$12,$13,$14,$15,$16,$17,$18) RETURNING id""",
                svc, cid, cat, title, frm[0], frm[1][0], frm[1][1],
                to[0] if to else None, to[1][0] if to else None, to[1][1] if to else None,
                dist, budget, "+998901110010", kw.get("weight_kg"), kw.get("work_volume"),
                kw.get("duration_value"), kw.get("duration_unit"), kw.get("scheduled_at"),
            )

        r1 = await request(client, "cargo", None, "Sement 40 qop", ("Chortoq qurilish bozori", CHORTOQ),
                           ("Uychi, Yangiobod mahallasi", UYCHI), 250000, weight_kg=2000)
        await request(client, "equipment", "excavator", "Poydevor qazish", ("Chortoq, Navbahor mahallasi", (41.075, 71.83)),
                      None, 1500000, work_volume="12x10 m, 1.5 m chuqurlik", duration_value=1, duration_unit="shift",
                      scheduled_at=tomorrow_730.replace(hour=9, minute=0))
        for tg, cat, price, msg in [(7000000003, "labo", 230000, "Labo, 2 marta qatnayman"),
                                    (7000000004, "isuzu", 260000, "Bir yo'la olib boraman")]:
            await conn.execute(
                "INSERT INTO offers(request_id, provider_id, vehicle_id, price, message) VALUES($1,$2,$3,$4,$5)",
                r1, user_ids[tg], vehicles[f"{tg}:{cat}"], price, msg,
            )
        await conn.execute("UPDATE service_requests SET offers_count=2 WHERE id=$1", r1)

        if for_tg:
            me = await conn.fetchval("SELECT id FROM users WHERE telegram_id=$1", for_tg)
            if me:
                r = await request(me, "cargo", None, "Mebel ko'chirish", ("Chortoq, Gulshan ko'chasi", CHORTOQ),
                                  ("Namangan, Davlatobod", NAMANGAN), 400000, weight_kg=800)
                for tg, cat, price, msg in [(7000000003, "labo", 350000, "Ehtiyotkorlik bilan olib boraman"),
                                            (7000000002, "damas", 330000, "Yuklashga yordam beraman")]:
                    await conn.execute(
                        "INSERT INTO offers(request_id, provider_id, vehicle_id, price, message) VALUES($1,$2,$3,$4,$5)",
                        r, user_ids[tg], vehicles[f"{tg}:{cat}"], price, msg,
                    )
                await conn.execute("UPDATE service_requests SET offers_count=2 WHERE id=$1", r)
                print(f"demo so'rov #{r} foydalanuvchi {for_tg} uchun yaratildi")
        print(f"Demo: {len(user_ids)} foydalanuvchi, {len(vehicles)} transport, 3 qatnov, so'rovlar va takliflar")
    finally:
        await conn.close()


if __name__ == "__main__":
    tg = None
    if "--for-tg" in sys.argv:
        tg = int(sys.argv[sys.argv.index("--for-tg") + 1])
    asyncio.run(main(tg))
