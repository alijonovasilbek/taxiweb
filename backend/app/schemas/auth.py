from pydantic import BaseModel


class TelegramAuthRequest(BaseModel):
    init_data: str
    role: str = "passenger"  # passenger | driver


class TokenResponse(BaseModel):
    token: str
    role: str


class RefreshRequest(BaseModel):
    token: str
