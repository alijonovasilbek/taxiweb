"""Shaxsiy hujjatlarni ochiq /uploads dan yopiq papkaga ko'chirish

Avval pasport/guvohnoma skanlari /uploads orqali hammaga ochiq edi (KAMCHILIKLAR-2.md, A2).
Endi fayllar uploads/private/ da, bazada 'private:<nom>', berish — imzoli vaqtinchalik havola orqali.

Revision ID: 010
Revises: 009
Create Date: 2026-11-26
"""
import os
import shutil

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    from sqlalchemy import text
    from app.config import settings

    conn = op.get_bind()
    private = os.path.join(settings.upload_dir, "private")
    os.makedirs(private, exist_ok=True)
    rows = conn.execute(text("SELECT id, file_url FROM user_documents WHERE file_url LIKE '/uploads/%'")).fetchall()
    for doc_id, url in rows:
        name = os.path.basename(url)
        src = os.path.join(settings.upload_dir, name)
        if os.path.isfile(src):
            shutil.move(src, os.path.join(private, name))
        conn.execute(text("UPDATE user_documents SET file_url=:u WHERE id=:i"), {"u": "private:" + name, "i": doc_id})


def downgrade() -> None:
    from alembic import op
    from sqlalchemy import text
    from app.config import settings

    conn = op.get_bind()
    private = os.path.join(settings.upload_dir, "private")
    rows = conn.execute(text("SELECT id, file_url FROM user_documents WHERE file_url LIKE 'private:%'")).fetchall()
    for doc_id, url in rows:
        name = url[len("private:"):]
        src = os.path.join(private, name)
        if os.path.isfile(src):
            shutil.move(src, os.path.join(settings.upload_dir, name))
        conn.execute(text("UPDATE user_documents SET file_url=:u WHERE id=:i"), {"u": "/uploads/" + name, "i": doc_id})
