from pydantic import BaseModel
from typing import Optional


class DriverRegisterRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str
    car_model: str
    car_color: str
    car_number: str
    car_year: Optional[int] = None


class DriverStatusRequest(BaseModel):
    is_online: bool


class RatingRequest(BaseModel):
    order_id: int
    rating: int
    comment: Optional[str] = None
    target_role: str  # driver | passenger
