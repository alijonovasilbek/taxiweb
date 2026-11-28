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
    tariff_id: Optional[int] = None  # berilmasa — standart tarif (Web App)
    # Xaritada (Yandex multiRoute) qurilgan yo'l — server tekshiradi, ishonchsiz bo'lsa o'zi hisoblaydi
    road_distance_km: Optional[float] = None
    road_duration_min: Optional[float] = None


class RouteEstimateRequest(BaseModel):
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None


class CancelOrderRequest(BaseModel):
    reason: Optional[str] = "Bekor qilindi"  # erkin matn ("Boshqa sabab" izohi yoki eski ilovalar)
    reason_code: Optional[str] = None  # app/services/cancel_reasons.py dagi kod (analitika)
