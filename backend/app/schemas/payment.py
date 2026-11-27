from pydantic import AliasChoices, BaseModel, Field


class PaymentCreateRequest(BaseModel):
    # Web App `orderId` yuboradi, ilovalar — `order_id`: ikkalasi ham qabul qilinadi
    order_id: int = Field(validation_alias=AliasChoices("order_id", "orderId"))


class TariffUpdateRequest(BaseModel):
    base_fare: float
    per_km_price: float
    per_min_price: float = 0
    min_fare: float
    night_multiplier: float = 1.5
