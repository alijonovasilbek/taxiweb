"""Fayl yuklash xavfsizligi.

- Tur fayl mazmunidan (magic bytes) aniqlanadi — brauzer yuborgan content_type va fayl nomiga ishonilmaydi.
  Kengaytmani server o'zi qo'yadi → HTML/SVG yuklab XSS qilib bo'lmaydi.
- Shaxsiy hujjatlar (pasport, guvohnoma, texpasport) ochiq /uploads da emas, yopiq papkada saqlanadi va
  faqat qisqa muddatli imzoli havola orqali beriladi (egasi va admin ko'radi).
"""
import hashlib
import hmac
import json
import os
import time
import uuid

import aiofiles
from fastapi import HTTPException, UploadFile

from app.config import settings

PRIVATE_PREFIX = "private:"
SIGNED_URL_TTL = 30 * 60  # 30 daqiqa

_SIGNATURES = (
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    (b"%PDF-", ".pdf", "application/pdf"),
)


def detect_type(data: bytes) -> tuple[str, str] | None:
    for magic, ext, mime in _SIGNATURES:
        if data.startswith(magic):
            return ext, mime
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


def private_dir() -> str:
    return os.path.join(settings.upload_dir, "private")


async def _read_checked(file: UploadFile, images_only: bool) -> tuple[bytes, str, str]:
    data = await file.read(settings.max_file_size + 1)
    if len(data) > settings.max_file_size:
        raise HTTPException(413, f"Fayl hajmi {settings.max_file_size // (1024 * 1024)} MB dan oshmasin")
    kind = detect_type(data)
    if not kind or (images_only and kind[1] == "application/pdf"):
        raise HTTPException(400, "Faqat JPG, PNG, WEBP rasm" + ("" if images_only else " yoki PDF") + " yuklash mumkin")
    return data, kind[0], kind[1]


async def save_public_image(file: UploadFile, prefix: str) -> str:
    """Ochiq rasm (transport rasmi) → /uploads/<nom>."""
    data, ext, _ = await _read_checked(file, images_only=True)
    fname = f"{prefix}_{uuid.uuid4().hex}{ext}"
    os.makedirs(settings.upload_dir, exist_ok=True)
    async with aiofiles.open(os.path.join(settings.upload_dir, fname), "wb") as f:
        await f.write(data)
    return f"/uploads/{fname}"


async def save_private_document(file: UploadFile, prefix: str) -> str:
    """Shaxsiy hujjat → yopiq papka; bazaga 'private:<nom>' yoziladi."""
    data, ext, _ = await _read_checked(file, images_only=False)
    fname = f"{prefix}_{uuid.uuid4().hex}{ext}"
    os.makedirs(private_dir(), exist_ok=True)
    async with aiofiles.open(os.path.join(private_dir(), fname), "wb") as f:
        await f.write(data)
    return PRIVATE_PREFIX + fname


def _sig(doc_id: int, exp: int) -> str:
    key = (settings.jwt_secret + ":files").encode()
    return hmac.new(key, f"{doc_id}:{exp}".encode(), hashlib.sha256).hexdigest()[:32]


def signed_doc_url(doc_id: int) -> str:
    exp = int(time.time()) + SIGNED_URL_TTL
    return f"/api/files/doc/{doc_id}?exp={exp}&sig={_sig(doc_id, exp)}"


def verify_doc_sig(doc_id: int, exp: int, sig: str) -> bool:
    return exp >= time.time() and hmac.compare_digest(sig or "", _sig(doc_id, exp))


def doc_out(d) -> dict:
    """Hujjat yozuvi → javob: file_url imzoli vaqtinchalik havolaga almashtiriladi."""
    if isinstance(d, str):
        d = json.loads(d)
    d = dict(d)
    if d.get("id") is not None:
        d["file_url"] = signed_doc_url(d["id"])
    return d


def docs_out(raw) -> list[dict]:
    if not raw:
        return []
    if isinstance(raw, str):
        raw = json.loads(raw)
    return [doc_out(d) for d in raw]
