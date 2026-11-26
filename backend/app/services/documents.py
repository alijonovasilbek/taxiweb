"""Transport tasdiqlanishi uchun yetishmayotgan hujjatlar."""
import asyncpg

from app.catalog import DOC_TYPES, PERSONAL_DOCS, required_docs


async def missing_docs(conn: asyncpg.Connection, vehicle: dict) -> list[dict]:
    rows = await conn.fetch(
        "SELECT doc_type, vehicle_id FROM user_documents WHERE user_id=$1 AND status <> 'rejected'", vehicle["owner_id"],
    )
    personal = {r["doc_type"] for r in rows}
    own = {r["doc_type"] for r in rows if r["vehicle_id"] == vehicle["id"]}
    missing = [t for t in required_docs(vehicle["category"]) if t not in (personal if t in PERSONAL_DOCS else own)]
    return [{"code": t, "name": DOC_TYPES[t]} for t in missing]
