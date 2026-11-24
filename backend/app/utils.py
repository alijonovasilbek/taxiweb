from datetime import datetime, timezone, timedelta

import asyncpg

# Chortoq (O'zbekiston) vaqti — UTC+5, yozgi vaqt yo'q
LOCAL_TZ = timezone(timedelta(hours=5))
LOCAL_NOW_SQL = "(NOW() AT TIME ZONE 'Asia/Tashkent')"

_GEO_SUFFIXES = ("location",)


def row_to_dict(row: asyncpg.Record | None, drop: tuple[str, ...] = ()) -> dict | None:
    """asyncpg yozuvini JSON uchun lug'atga aylantiradi, GEOGRAPHY ustunlarini olib tashlaydi."""
    if row is None:
        return None
    data = dict(row)
    for key in list(data.keys()):
        if key.endswith(_GEO_SUFFIXES) or key in drop or key == "password_hash":
            data.pop(key, None)
    return data


def rows_to_list(rows, drop: tuple[str, ...] = ()) -> list[dict]:
    return [row_to_dict(r, drop) for r in rows]


def to_local_naive(dt: datetime | None) -> datetime | None:
    """Bazada vaqt mahalliy (Asia/Tashkent) naive TIMESTAMP sifatida saqlanadi."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(LOCAL_TZ).replace(tzinfo=None)
    return dt


def local_now() -> datetime:
    return datetime.now(LOCAL_TZ).replace(tzinfo=None)
