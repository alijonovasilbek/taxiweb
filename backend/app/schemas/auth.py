from pydantic import BaseModel, ConfigDict, Field


class TelegramAuthRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    init_data: str = Field(alias="initData")
    role: str = "passenger"  # passenger | driver


class DriverLoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    token: str
    role: str


class RefreshRequest(BaseModel):
    token: str
