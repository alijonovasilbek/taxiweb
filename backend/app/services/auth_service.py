import asyncpg
from app.auth import verify_telegram_init_data, create_token
from fastapi import HTTPException


async def authenticate_auto(init_data: str, conn: asyncpg.Connection, admin_ids: list[int]) -> dict:
    """initData dan rol avtomatik aniqlanadi: admin → driver → passenger."""
    tg_user = verify_telegram_init_data(init_data)
    tg_id = tg_user.get("id")
    if not tg_id:
        raise HTTPException(status_code=400, detail="No user in initData")

    if tg_id in admin_ids:
        from app.config import settings
        secret = settings.admin_jwt_secret or settings.jwt_secret
        token = create_token({"telegram_id": tg_id, "role": "admin"}, secret=secret)
        return {"token": token, "role": "admin"}

    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", tg_id)
    if driver:
        token = create_token({
            "telegram_id": tg_id,
            "role": "driver",
            "driver_id": driver["id"],
            "status": driver["status"],
        })
        return {"token": token, "role": "driver", "driver": dict(driver)}

    user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", tg_id)
    if not user:
        user = await conn.fetchrow(
            """INSERT INTO users(telegram_id, telegram_username, first_name, last_name)
               VALUES($1,$2,$3,$4) RETURNING *""",
            tg_id, tg_user.get("username"),
            tg_user.get("first_name", ""), tg_user.get("last_name"),
        )
    else:
        user = await conn.fetchrow(
            """UPDATE users SET telegram_username=$2, first_name=$3, last_name=$4, updated_at=NOW()
               WHERE telegram_id=$1 RETURNING *""",
            tg_id, tg_user.get("username"), tg_user.get("first_name", ""), tg_user.get("last_name"),
        )
        if user["is_blocked"]:
            raise HTTPException(status_code=403, detail="User is blocked")

    token = create_token({"id": user["id"], "telegram_id": tg_id, "role": "passenger"})
    return {"token": token, "role": "passenger", "user": dict(user)}


async def authenticate_passenger(init_data: str, conn: asyncpg.Connection) -> dict:
    tg_user = verify_telegram_init_data(init_data)
    tg_id = tg_user.get("id")
    if not tg_id:
        raise HTTPException(status_code=400, detail="No user in initData")

    user = await conn.fetchrow("SELECT * FROM users WHERE telegram_id=$1", tg_id)
    if not user:
        user = await conn.fetchrow(
            """INSERT INTO users(telegram_id, telegram_username, first_name, last_name)
               VALUES($1,$2,$3,$4) RETURNING *""",
            tg_id,
            tg_user.get("username"),
            tg_user.get("first_name", ""),
            tg_user.get("last_name"),
        )
    else:
        user = await conn.fetchrow(
            """UPDATE users SET telegram_username=$2, first_name=$3, last_name=$4, updated_at=NOW()
               WHERE telegram_id=$1 RETURNING *""",
            tg_id, tg_user.get("username"), tg_user.get("first_name", ""), tg_user.get("last_name"),
        )
        if user["is_blocked"]:
            raise HTTPException(status_code=403, detail="User is blocked")

    token = create_token({"id": user["id"], "telegram_id": tg_id, "role": "passenger"})
    return {"token": token, "role": "passenger", "user": dict(user)}


async def authenticate_driver(init_data: str, conn: asyncpg.Connection) -> dict:
    tg_user = verify_telegram_init_data(init_data)
    tg_id = tg_user.get("id")
    if not tg_id:
        raise HTTPException(status_code=400, detail="No user in initData")

    driver = await conn.fetchrow("SELECT * FROM drivers WHERE telegram_id=$1", tg_id)
    token = create_token({
        "telegram_id": tg_id,
        "role": "driver",
        "driver_id": driver["id"] if driver else None,
        "status": driver["status"] if driver else "unregistered",
    })
    return {"token": token, "role": "driver", "driver": dict(driver) if driver else None}
