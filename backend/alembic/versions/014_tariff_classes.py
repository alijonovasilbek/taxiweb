"""Taksi tarif sinflari (Ekonom, Komfort, Biznes, Miniven): haydovchiga va buyurtmaga biriktiriladi

Avval bitta faol tarif bo'lardi (admin saqlaganda yangi qator qo'shilib, eskisi o'chirilardi).
Endi bir nechta faol tarif: har birining narxi, o'rinlari va darajasi (level) bor.
Haydovchi buyurtmani oladi, agar uning tarifi darajasi >= buyurtma darajasi va o'rinlari >= buyurtma o'rinlari bo'lsa
(Biznes mashina Ekonom buyurtmasini ham oladi; Miniven buyurtmasini faqat 6 o'rinli mashina oladi).

Revision ID: 014
Revises: 013
Create Date: 2026-11-28
"""

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS code VARCHAR(30)")
    op.execute("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 4")
    op.execute("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1")
    op.execute("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE tariffs ADD COLUMN IF NOT EXISTS description TEXT")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS tariffs_code_key ON tariffs(code) WHERE code IS NOT NULL")

    # Hozirgi faol tarif → Ekonom (narxlari o'zgarmaydi)
    op.execute("""
        UPDATE tariffs SET code='ekonom', name='Ekonom', seats=4, level=1, sort_order=1,
               description='Arzon va tez'
        WHERE id = (SELECT id FROM tariffs WHERE is_active ORDER BY created_at DESC LIMIT 1)
    """)
    op.execute("""
        INSERT INTO tariffs(code, name, base_fare, per_km_price, per_min_price, min_fare, night_multiplier,
                            is_active, seats, level, sort_order, description)
        SELECT v.code, v.name, v.base, v.km, v.min, v.minfare, 1.5, true, v.seats, v.level, v.sort, v.descr
        FROM (VALUES
            ('ekonom',  'Ekonom',  5000,  1500, 200, 10000, 4, 1, 1, 'Arzon va tez'),
            ('komfort', 'Komfort', 7000,  1900, 250, 13000, 4, 2, 2, 'Yangiroq va keng mashina'),
            ('biznes',  'Biznes',  12000, 3000, 400, 22000, 4, 3, 3, 'Premium mashina'),
            ('miniven', 'Miniven', 9000,  2300, 300, 16000, 6, 2, 4, 'Katta oila va yuk uchun')
        ) AS v(code, name, base, km, min, minfare, seats, level, sort, descr)
        WHERE NOT EXISTS (SELECT 1 FROM tariffs t WHERE t.code = v.code)
    """)
    op.execute("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS tariff_id INTEGER REFERENCES tariffs(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tariff_id INTEGER REFERENCES tariffs(id) ON DELETE SET NULL")


def downgrade() -> None:
    from alembic import op
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS tariff_id")
    op.execute("ALTER TABLE drivers DROP COLUMN IF EXISTS tariff_id")
    op.execute("DELETE FROM tariffs WHERE code IN ('komfort','biznes','miniven')")
    op.execute("DROP INDEX IF EXISTS tariffs_code_key")
    for col in ("description", "sort_order", "level", "seats", "code"):
        op.execute(f"ALTER TABLE tariffs DROP COLUMN IF EXISTS {col}")
