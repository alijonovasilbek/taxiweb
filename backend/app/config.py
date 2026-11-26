from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings

_BACKEND_DIR = Path(__file__).resolve().parents[1]
# Yagona manba: loyiha ildizidagi .env (umumiy kalitlar), keyin backend/.env (lokal ustunlik qiladi)
ENV_FILES = tuple(str(p) for p in (_BACKEND_DIR.parent / ".env", _BACKEND_DIR / ".env") if p.exists())


class Settings(BaseSettings):
    node_env: str = "development"
    port: int = 3000

    database_url: str
    redis_url: str = "redis://localhost:6379"

    jwt_secret: str
    jwt_expires_days: int = 7
    admin_jwt_secret: str = ""
    admin_telegram_ids: str = ""

    telegram_bot_token: str
    telegram_payment_token: str = ""

    yandex_maps_api_key: str = ""
    yandex_geocoder_api_key: str = ""
    yandex_router_api_key: str = ""
    # Geosuggest (joy nomlari: bozor, vokzal...) — alohida kalit, developer.tech.yandex.ru
    yandex_suggest_api_key: str = ""
    # Qidiruv markazi (Chortoq) — foydalanuvchi joylashuvi bo'lmasa
    default_lat: float = 41.0690
    default_lng: float = 71.8230

    payme_merchant_id: str = ""
    payme_secret_key: str = ""
    payme_test_secret_key: str = ""
    payme_is_test: bool = True

    click_merchant_id: str = ""
    click_service_id: str = ""
    click_secret_key: str = ""

    osrm_url: str = "http://localhost:5000"

    passenger_app_url: str = "http://localhost:5173"
    driver_app_url: str = "http://localhost:5174"
    admin_url: str = "http://localhost:5175"
    socket_cors_origin: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

    upload_dir: str = "./uploads"
    max_file_size: int = 5 * 1024 * 1024
    driver_location_ttl: int = 30
    dev_mode: bool = False

    # ── Chortoq Ijrochi (Android ilova) ──
    bot_username: str = "chortoqgotaxibot"
    app_access_ttl_min: int = 60          # access token: 1 soat
    app_refresh_ttl_days: int = 60        # refresh token: 60 kun (har ishlatilganda aylanadi)
    app_login_code_ttl_sec: int = 120
    app_min_version: str = "1.0.0"        # bundan eski ilova majburan yangilanadi
    app_latest_version: str = "1.0.0"
    app_apk_url: str = ""                 # GitHub Release'dagi oxirgi APK
    app_changelog: str = ""
    # Firebase Cloud Messaging (HTTP v1): service account JSON fayli yo'li yoki JSON matnining o'zi
    fcm_service_account: str = ""
    # Taksi: buyurtmani haydovchilarga ketma-ket taklif qilish
    offer_timeout_sec: int = 15
    max_offer_drivers: int = 6

    @property
    def admin_ids(self) -> list[int]:
        return [int(x) for x in self.admin_telegram_ids.split(",") if x.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return [x.strip() for x in self.socket_cors_origin.split(",")]

    class Config:
        env_file = ENV_FILES or ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
