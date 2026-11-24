import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import current_user
from app.schemas.services import ScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["schedules"])

WEEKDAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]


def _fmt(row) -> dict:
    d = dict(row)
    d["start_time"] = d["start_time"].strftime("%H:%M")
    d["end_time"] = d["end_time"].strftime("%H:%M")
    d["weekday_name"] = WEEKDAYS[d["weekday"]]
    return d


@router.get("/me")
async def my_schedule(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM availability WHERE user_id=$1 ORDER BY weekday, start_time", user["id"]
    )
    return [_fmt(r) for r in rows]


@router.put("/me")
async def replace_schedule(body: ScheduleUpdate, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    vehicle_ids = {s.vehicle_id for s in body.slots if s.vehicle_id}
    if vehicle_ids:
        owned = await conn.fetchval(
            "SELECT COUNT(*) FROM vehicles WHERE owner_id=$1 AND id = ANY($2::int[])", user["id"], list(vehicle_ids)
        )
        if owned != len(vehicle_ids):
            raise HTTPException(403, "Transport sizga tegishli emas")
    async with conn.transaction():
        await conn.execute("DELETE FROM availability WHERE user_id=$1", user["id"])
        for s in body.slots:
            await conn.execute(
                "INSERT INTO availability(user_id,vehicle_id,weekday,start_time,end_time) VALUES($1,$2,$3,$4,$5)",
                user["id"], s.vehicle_id, s.weekday, s.start_time, s.end_time,
            )
    return await my_schedule(user, conn)


@router.get("/user/{user_id}")
async def user_schedule(user_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        "SELECT * FROM availability WHERE user_id=$1 ORDER BY weekday, start_time", user_id
    )
    return [_fmt(r) for r in rows]
