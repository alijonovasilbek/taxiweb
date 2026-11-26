"""Taksi haydovchisi — yagona akkaunt (users + vehicles) ↔ eski taksi dispetcherligi (drivers jadvali) ko'prigi.

Admin taksiga mos transportni (services: taxi) tasdiqlasa, foydalanuvchi uchun `drivers` yozuvi avtomatik
yaratiladi/yangilanadi. Shunda mavjud taksi oqimi (yaqin haydovchini topish, new_order, accept → complete)
Mini App'ning ijrochi rejimida ishlaydi — alohida driver-app va ro'yxatdan o'tish shart emas.
"""
import asyncpg

from app.catalog import VEHICLE_CATEGORIES

TAXI_CATEGORIES = [c for c, v in VEHICLE_CATEGORIES.items() if "taxi" in v["services"]]


async def sync_taxi_driver(conn: asyncpg.Connection, user_id: int) -> int | None:
    user = await conn.fetchrow("SELECT * FROM users WHERE id=$1", user_id)
    if not user:
        return None
    vehicle = await conn.fetchrow(
        """SELECT * FROM vehicles WHERE owner_id=$1 AND status='approved' AND category = ANY($2::text[])
             AND plate_number IS NOT NULL ORDER BY updated_at DESC LIMIT 1""",
        user_id, TAXI_CATEGORIES,
    )
    existing = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", user["telegram_id"])
    if not vehicle:
        # Taksi transporti qolmadi — dispetcherlikdan chiqariladi (bloklangan holat o'zgarmaydi)
        if existing and existing["status"] == "approved":
            await conn.execute("UPDATE drivers SET is_online=false, status='pending' WHERE id=$1", existing["id"])
        return None

    args = (
        user_id, user["telegram_id"], user["first_name"], user["last_name"] or "", user["phone"] or "",
        vehicle["model"], vehicle["color"] or "—", vehicle["plate_number"], vehicle["year"],
    )
    if existing:
        await conn.execute(
            """UPDATE drivers SET user_id=$1, first_name=$3, last_name=$4, phone=$5, car_model=$6, car_color=$7,
                   car_number=$8, car_year=$9,
                   status=CASE WHEN status='blocked' THEN status ELSE 'approved' END
               WHERE telegram_id=$2""",
            *args,
        )
        return existing["id"]
    # Davlat raqami boshqa (eski) yozuvda band bo'lsa — o'sha yozuvni bo'shatamiz
    await conn.execute("UPDATE drivers SET car_number=car_number || '-old-' || id WHERE car_number=$1", vehicle["plate_number"])
    return await conn.fetchval(
        """INSERT INTO drivers(user_id, telegram_id, first_name, last_name, phone, car_model, car_color,
                               car_number, car_year, status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved') RETURNING id""",
        *args,
    )


async def driver_for_user(conn: asyncpg.Connection, telegram_id: int) -> asyncpg.Record | None:
    return await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1 AND status='approved'", telegram_id)
