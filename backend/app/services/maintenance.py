"""Fon xizmati: backend qayta yonganda ham ishonchli holat.

- Osilib qolgan buyurtmalar: 'searching' holatida 2 daqiqadan ortiq turganlar → 'no_drivers' (taymerlar xotirada
  bo'lgani uchun backend qayta yonsa yo'qoladi — bu ularni tiklaydi).
- Heartbeat: onlayn haydovchidan 90 soniya joylashuv kelmasa (telefon o'chdi, internet yo'q) → oflayn,
  shunda unga buyurtma yuborilmaydi. Safardagi haydovchiga tegilmaydi.
"""
import asyncio

from app.log import log

INTERVAL_SEC = 30
STALE_SEARCH = "3 minutes"  # ketma-ket takliflar: 6 haydovchi × 15 soniya + zaxira
DRIVER_SILENCE = "90 seconds"


async def run_once() -> dict:
    from app.database import pool
    from app.socket_manager import sio

    async with pool.acquire() as conn:
        stale = await conn.fetch(
            f"""UPDATE orders SET status='no_drivers'
                WHERE status='searching' AND created_at < NOW() - INTERVAL '{STALE_SEARCH}'
                RETURNING id, passenger_id"""
        )
        silent = await conn.fetch(
            f"""UPDATE drivers SET is_online=false
                WHERE is_online AND NOT is_on_ride
                  AND (last_location_update IS NULL OR last_location_update < NOW() - INTERVAL '{DRIVER_SILENCE}')
                RETURNING id"""
        )
        # Backend qayta yonib dispetcher to'xtagan bo'lsa — ochiq qolgan takliflar
        await conn.execute(
            """UPDATE order_offers SET status='expired', answered_at=NOW()
               WHERE status='offered' AND offered_at < NOW() - INTERVAL '2 minutes'""")
    for o in stale:
        await sio.emit("no_drivers_found", {"order_id": o["id"]}, room=f"passenger:{o['passenger_id']}")
    for d in silent:
        await sio.emit("driver:offline_timeout", {"driver_id": d["id"]}, room=f"driver:{d['id']}")
    if stale or silent:
        log.info(f"[maintenance] eskirgan buyurtmalar: {len(stale)}, oflayn qilingan haydovchilar: {len(silent)}")
    return {"orders": len(stale), "drivers": len(silent)}


async def loop() -> None:
    while True:
        try:
            await run_once()
        except Exception as e:
            log.warning(f"[maintenance] xato: {e}")
        await asyncio.sleep(INTERVAL_SEC)
