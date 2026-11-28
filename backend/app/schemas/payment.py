from pydantic import AliasChoices, BaseModel, Field


class PaymentCreateRequest(BaseModel):
    # Web App `orderId` yuboradi, ilovalar — `order_id`: ikkalasi ham qabul qilinadi
    order_id: int = Field(validation_alias=AliasChoices("order_id", "orderId"))


class TariffUpdateRequest(BaseModel):
    base_fare: float = Field(ge=0)
    per_km_price: float = Field(ge=0)
    per_min_price: float = Field(0, ge=0)
    min_fare: float = Field(ge=0)
    night_multiplier: float = Field(1.5, ge=1, le=5)


class TariffIn(TariffUpdateRequest):
    """Taksi tarif sinfi (Ekonom, Komfort, ...). level — mashina sinfi darajasi, seats — o'rinlar."""
    name: str = Field(min_length=2, max_length=50)
    seats: int = Field(4, ge=1, le=20)
    level: int = Field(1, ge=1, le=10)
    sort_order: int = 0
    description: str | None = Field(None, max_length=120)
    is_active: bool = True
