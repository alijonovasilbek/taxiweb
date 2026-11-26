"""Yagona log sozlamasi (vaqt, daraja, modul). SENTRY_DSN berilsa — xatolar Sentry'ga ham yuboriladi."""
import logging
import os
import sys

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("chortoq")


def init_sentry() -> None:
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return
    try:
        import sentry_sdk  # ixtiyoriy: pip install sentry-sdk
        sentry_sdk.init(dsn=dsn, traces_sample_rate=float(os.getenv("SENTRY_TRACES", "0")),
                        environment=os.getenv("NODE_ENV", "development"))
        log.info("Sentry yoqildi")
    except ImportError:
        log.warning("SENTRY_DSN berilgan, lekin sentry-sdk o'rnatilmagan")
