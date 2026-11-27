"""Ikki Android ilova: "Chortoq Ijrochi" (driver) va mijozlar uchun "Chortoq" (client)."""

APPS = {
    "driver": {"name": "Chortoq Ijrochi", "scheme": "chortoqijrochi", "package": "uz.chortoq.ijrochi"},
    "client": {"name": "Chortoq", "scheme": "chortoq", "package": "uz.chortoq.app"},
}
APP_PATTERN = r"^(driver|client)$"


def app_info(app: str | None) -> dict:
    return APPS.get(app or "driver", APPS["driver"])
