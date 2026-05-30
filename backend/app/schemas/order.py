from pydantic import BaseModel
from typing import Optional


class LocationPoint(BaseModel):
    lat: float
    lng: float
    address: str = ""


class CreateOrderRequest(BaseModel):
    pickup: LocationPoint
    dropoff: LocationPoint
    payment_method: str = "cash"  # cash | payme | click | telegram


class CancelOrderRequest(BaseModel):
    reason: Optional[str] = "Bekor qilindi"
