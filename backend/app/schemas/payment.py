from pydantic import BaseModel


class PaymentCreateRequest(BaseModel):
    order_id: int


class TariffUpdateRequest(BaseModel):
    base_fare: float
    per_km_price: float
    per_min_price: float = 0
    min_fare: float
    night_multiplier: float = 1.5
