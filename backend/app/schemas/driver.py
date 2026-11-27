from pydantic import AliasChoices, BaseModel, Field
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
    # Web App camelCase (orderId, targetRole), ilovalar snake_case yuboradi — ikkalasi ham qabul qilinadi
    order_id: int = Field(validation_alias=AliasChoices("order_id", "orderId"))
    rating: int
    comment: Optional[str] = None
    target_role: str = Field(validation_alias=AliasChoices("target_role", "targetRole"))  # driver | passenger
