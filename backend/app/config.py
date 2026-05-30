from pydantic_settings import BaseSettings
from functools import lru_cache


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

    payme_merchant_id: str = ""
    payme_secret_key: str = ""
    payme_test_secret_key: str = ""
    payme_is_test: bool = True

    click_merchant_id: str = ""
    click_service_id: str = ""
    click_secret_key: str = ""

    passenger_app_url: str = "http://localhost:5173"
    driver_app_url: str = "http://localhost:5174"
    admin_url: str = "http://localhost:5175"
    socket_cors_origin: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175"

    upload_dir: str = "./uploads"
    max_file_size: int = 5 * 1024 * 1024
    driver_location_ttl: int = 30

    @property
    def admin_ids(self) -> list[int]:
        return [int(x) for x in self.admin_telegram_ids.split(",") if x.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return [x.strip() for x in self.socket_cors_origin.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
