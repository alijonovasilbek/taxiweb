import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.services.roles import sync_roles
from app.services.documents import missing_docs
from app.security import rate_limit
from app.services.files import doc_out, save_private_document, save_public_image
from app.catalog import VEHICLE_CATEGORIES, DOC_TYPES
from app.config import settings
from app.database import get_db
from app.deps import current_user
from app.schemas.services import VehicleIn, VehicleAvailability
from app.utils import row_to_dict, rows_to_list

router = APIRouter(prefix="/vehicles", tags=["vehicles"])

VEHICLE_SELECT = """SELECT v.*, ST_Y(v.location::geometry) AS lat, ST_X(v.location::geometry) AS lng
                    FROM vehicles v"""


async def own_vehicle(conn: asyncpg.Connection, vehicle_id: int, user_id: int) -> asyncpg.Record:
    row = await conn.fetchrow(f"{VEHICLE_SELECT} WHERE v.id=$1 AND v.owner_id=$2", vehicle_id, user_id)
    if not row:
        raise HTTPException(404, "Transport topilmadi")
    return row


@router.get("/my")
async def my_vehicles(user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(f"{VEHICLE_SELECT} WHERE v.owner_id=$1 ORDER BY v.created_at DESC", user["id"])
    docs = await conn.fetch("SELECT * FROM user_documents WHERE user_id=$1 ORDER BY created_at DESC", user["id"])
    by_vehicle: dict = {}
    for d in docs:
        by_vehicle.setdefault(d["vehicle_id"], []).append(doc_out(d))
    return [{**row_to_dict(r), "documents": by_vehicle.get(r["id"], []), "missing_docs": await missing_docs(conn, dict(r))}
            for r in rows]


@router.post("", status_code=201)
async def create_vehicle(body: VehicleIn, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    count = await conn.fetchval("SELECT COUNT(*) FROM vehicles WHERE owner_id=$1", user["id"])
    if count >= 20:
        raise HTTPException(400, "Transportlar soni chegaradan oshdi")
    data = body.model_dump()
    if data.get("plate_number"):
        data["plate_number"] = data["plate_number"].upper().replace(" ", "")
    cols = ", ".join(data.keys())
    params = ", ".join(f"${i + 2}" for i in range(len(data)))
    row = await conn.fetchrow(
        f"INSERT INTO vehicles(owner_id, {cols}) VALUES($1, {params}) RETURNING id", user["id"], *data.values()
    )
    await sync_roles(conn, user["id"])
    return row_to_dict(await own_vehicle(conn, row["id"], user["id"]))


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    row = await conn.fetchrow(
        f"""{VEHICLE_SELECT} WHERE v.id=$1 AND (v.status='approved' OR v.owner_id=$2)""", vehicle_id, user["id"]
    )
    if not row:
        raise HTTPException(404, "Transport topilmadi")
    owner = await conn.fetchrow(
        "SELECT id, first_name, last_name, provider_rating, provider_reviews FROM users WHERE id=$1", row["owner_id"]
    )
    return {**row_to_dict(row), "owner": dict(owner)}


@router.put("/{vehicle_id}")
async def update_vehicle(vehicle_id: int, body: VehicleIn, user=Depends(current_user),
                         conn: asyncpg.Connection = Depends(get_db)):
    old = await own_vehicle(conn, vehicle_id, user["id"])
    data = body.model_dump()
    if data.get("plate_number"):
        data["plate_number"] = data["plate_number"].upper().replace(" ", "")
    # Asosiy ma'lumot o'zgarsa — qayta tasdiqlash
    critical = any(str(old[k] or "") != str(data[k] or "") for k in ("category", "plate_number", "model"))
    cols = ", ".join(f"{k}=${i + 2}" for i, k in enumerate(data))
    status_sql = ", status='pending'" if critical and old["status"] == "approved" else ""
    await conn.execute(
        f"UPDATE vehicles SET {cols}{status_sql}, updated_at=NOW() WHERE id=$1", vehicle_id, *data.values()
    )
    await sync_roles(conn, user["id"])
    return row_to_dict(await own_vehicle(conn, vehicle_id, user["id"]))


@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    await own_vehicle(conn, vehicle_id, user["id"])
    busy = await conn.fetchval(
        "SELECT COUNT(*) FROM service_requests WHERE vehicle_id=$1 AND status IN ('assigned','in_progress')",
        vehicle_id,
    )
    if busy:
        raise HTTPException(409, "Transport faol ishda ishlatilmoqda")
    await conn.execute("DELETE FROM vehicles WHERE id=$1", vehicle_id)
    await sync_roles(conn, user["id"])
    return {"success": True}


@router.put("/{vehicle_id}/availability")
async def set_availability(vehicle_id: int, body: VehicleAvailability, user=Depends(current_user),
                           conn: asyncpg.Connection = Depends(get_db)):
    await own_vehicle(conn, vehicle_id, user["id"])
    if body.lat is not None and body.lng is not None:
        await conn.execute(
            """UPDATE vehicles SET is_available=$2, location=ST_MakePoint($4,$3)::geography,
                   location_address=COALESCE($5, location_address), location_updated_at=NOW(), updated_at=NOW()
               WHERE id=$1""",
            vehicle_id, body.is_available, body.lat, body.lng, body.address,
        )
    else:
        await conn.execute(
            "UPDATE vehicles SET is_available=$2, updated_at=NOW() WHERE id=$1", vehicle_id, body.is_available
        )
    return row_to_dict(await own_vehicle(conn, vehicle_id, user["id"]))


@router.post("/{vehicle_id}/photo", dependencies=[Depends(rate_limit("upload", 30, 300))])
async def upload_photo(vehicle_id: int, file: UploadFile = File(...), user=Depends(current_user),
                       conn: asyncpg.Connection = Depends(get_db)):
    await own_vehicle(conn, vehicle_id, user["id"])
    url = await save_public_image(file, f"vehicle{vehicle_id}")
    await conn.execute("UPDATE vehicles SET photo_url=$2, updated_at=NOW() WHERE id=$1", vehicle_id, url)
    return row_to_dict(await own_vehicle(conn, vehicle_id, user["id"]))


@router.post("/{vehicle_id}/documents", status_code=201, dependencies=[Depends(rate_limit("upload", 30, 300))])
async def upload_document(vehicle_id: int, doc_type: str = Form(...), file: UploadFile = File(...),
                          user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    await own_vehicle(conn, vehicle_id, user["id"])
    if doc_type not in DOC_TYPES:
        raise HTTPException(400, "Noma'lum hujjat turi")
    url = await save_private_document(file, f"doc{user['id']}_{doc_type}")
    row = await conn.fetchrow(
        "INSERT INTO user_documents(user_id,vehicle_id,doc_type,file_url) VALUES($1,$2,$3,$4) RETURNING *",
        user["id"], vehicle_id, doc_type, url,
    )
    return doc_out(row)


@router.get("/by-owner/{owner_id}")
async def vehicles_by_owner(owner_id: int, user=Depends(current_user), conn: asyncpg.Connection = Depends(get_db)):
    rows = await conn.fetch(
        f"{VEHICLE_SELECT} WHERE v.owner_id=$1 AND v.status='approved' ORDER BY v.id", owner_id
    )
    return rows_to_list(rows)
