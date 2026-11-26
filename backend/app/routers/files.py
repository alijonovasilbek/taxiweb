"""Shaxsiy hujjatlarni imzoli vaqtinchalik havola orqali berish (pasport, guvohnoma, texpasport)."""
import os

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse

from app.database import get_db
from app.services.files import PRIVATE_PREFIX, detect_type, private_dir, verify_doc_sig

router = APIRouter(prefix="/files", tags=["files"])


@router.get("/doc/{doc_id}")
async def get_document(doc_id: int, exp: int = Query(...), sig: str = Query(...),
                       conn: asyncpg.Connection = Depends(get_db)):
    if not verify_doc_sig(doc_id, exp, sig):
        raise HTTPException(403, "Havola muddati o'tgan yoki noto'g'ri")
    url = await conn.fetchval("SELECT file_url FROM user_documents WHERE id=$1", doc_id)
    if not url or not url.startswith(PRIVATE_PREFIX):
        raise HTTPException(404, "Hujjat topilmadi")
    name = os.path.basename(url[len(PRIVATE_PREFIX):])
    path = os.path.join(private_dir(), name)
    if not os.path.isfile(path):
        raise HTTPException(404, "Hujjat topilmadi")
    with open(path, "rb") as f:
        kind = detect_type(f.read(16))
    return FileResponse(path, media_type=kind[1] if kind else "application/octet-stream",
                        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})
