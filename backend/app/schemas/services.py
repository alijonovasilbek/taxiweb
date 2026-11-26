from datetime import datetime, time

from pydantic import BaseModel, Field, field_validator

from app.catalog import ROLES, VEHICLE_CATEGORIES, DOC_TYPES


class Point(BaseModel):
    address: str = Field(min_length=1, max_length=500)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


# ── Profil ──────────────────────────────────────────────────────────────────
class ProfileUpdate(BaseModel):
    # Telefon bu yerda o'zgarmaydi — faqat Telegram orqali tasdiqlanadi (/users/me/phone)
    language: str | None = Field(None, max_length=5)
    company_name: str | None = Field(None, max_length=200)
    bio: str | None = Field(None, max_length=1000)
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)


class PhoneShare(BaseModel):
    """WebApp.requestContact() qaytargan imzolangan satr."""
    response: str = Field(min_length=10, max_length=4096)


class PhoneManual(BaseModel):
    """Faqat DEV_MODE: Telegram'siz lokal sinov uchun."""
    phone: str = Field(min_length=7, max_length=20)


HOME_WIDGETS = ("taxi", "carpool", "cargo", "equipment")


class PreferencesIn(BaseModel):
    # Asosiy sahifada yashirilgan vidjetlar (servis kodlari)
    home_hidden: list[str] | None = None

    @field_validator("home_hidden")
    @classmethod
    def check_widgets(cls, v):
        if v is None:
            return v
        bad = [x for x in v if x not in HOME_WIDGETS]
        if bad:
            raise ValueError(f"Noma'lum vidjet: {', '.join(bad)}")
        return list(dict.fromkeys(v))


class SavedPlace(BaseModel):
    address: str = Field(min_length=1, max_length=300)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OnboardIn(BaseModel):
    intent: str = Field(pattern="^(client|provider)$")


class RolesUpdate(BaseModel):
    roles: list[str]

    @field_validator("roles")
    @classmethod
    def check_roles(cls, v):
        bad = [r for r in v if r not in ROLES]
        if bad:
            raise ValueError(f"Noma'lum rol: {', '.join(bad)}")
        out = list(dict.fromkeys(v))
        if "client" not in out:
            out.insert(0, "client")
        return out


# ── Transport ───────────────────────────────────────────────────────────────
class VehicleIn(BaseModel):
    category: str
    model: str = Field(min_length=1, max_length=100)
    plate_number: str | None = Field(None, max_length=20)
    color: str | None = Field(None, max_length=50)
    year: int | None = Field(None, ge=1950, le=2100)
    seats: int | None = Field(None, ge=1, le=60)
    capacity_kg: int | None = Field(None, ge=0, le=100000)
    volume_m3: float | None = Field(None, ge=0, le=1000)
    description: str | None = Field(None, max_length=1000)
    price_per_km: float | None = Field(None, ge=0)
    price_per_hour: float | None = Field(None, ge=0)
    price_per_shift: float | None = Field(None, ge=0)
    price_per_day: float | None = Field(None, ge=0)

    @field_validator("category")
    @classmethod
    def check_category(cls, v):
        if v not in VEHICLE_CATEGORIES:
            raise ValueError("Noma'lum transport kategoriyasi")
        return v


class VehicleAvailability(BaseModel):
    is_available: bool
    lat: float | None = None
    lng: float | None = None
    address: str | None = None


class DocType(BaseModel):
    doc_type: str

    @field_validator("doc_type")
    @classmethod
    def check(cls, v):
        if v not in DOC_TYPES:
            raise ValueError("Noma'lum hujjat turi")
        return v


# ── Jadval ──────────────────────────────────────────────────────────────────
class Slot(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    vehicle_id: int | None = None

    @field_validator("end_time")
    @classmethod
    def check_order(cls, v, info):
        st = info.data.get("start_time")
        if st and v <= st:
            raise ValueError("Tugash vaqti boshlanishdan keyin bo'lishi kerak")
        return v


class ScheduleUpdate(BaseModel):
    slots: list[Slot] = Field(default_factory=list, max_length=100)


# ── Po'puti ─────────────────────────────────────────────────────────────────
class TripIn(BaseModel):
    vehicle_id: int | None = None
    from_point: Point = Field(alias="from")
    to_point: Point = Field(alias="to")
    departure_at: datetime
    seats_total: int = Field(ge=1, le=50)
    price_per_seat: float = Field(gt=0)
    recurring_days: list[int] | None = None
    allow_parcels: bool = False
    note: str | None = Field(None, max_length=500)

    model_config = {"populate_by_name": True}

    @field_validator("recurring_days")
    @classmethod
    def check_days(cls, v):
        if v is None:
            return v
        if any(d < 0 or d > 6 for d in v):
            raise ValueError("Hafta kunlari 0..6 oralig'ida bo'lishi kerak")
        return sorted(set(v)) or None


class TripStatus(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def check(cls, v):
        if v not in ("active", "departed", "completed", "cancelled"):
            raise ValueError("Noto'g'ri holat")
        return v


class BookingIn(BaseModel):
    seats: int = Field(1, ge=1, le=50)
    pickup_note: str | None = Field(None, max_length=300)
    phone: str | None = Field(None, max_length=20)
    is_subscription: bool = False


# ── Yuk tashish / spets texnika ─────────────────────────────────────────────
class RequestIn(BaseModel):
    service_type: str
    vehicle_category: str | None = None
    title: str | None = Field(None, max_length=200)
    description: str | None = Field(None, max_length=2000)
    cargo_type: str | None = Field(None, max_length=100)
    weight_kg: int | None = Field(None, ge=0, le=100000)
    volume_m3: float | None = Field(None, ge=0, le=1000)
    work_volume: str | None = Field(None, max_length=500)
    duration_value: float | None = Field(None, gt=0, le=1000)
    duration_unit: str | None = None
    from_point: Point = Field(alias="from")
    to_point: Point | None = Field(None, alias="to")
    scheduled_at: datetime | None = None
    budget: float | None = Field(None, ge=0)
    phone: str | None = Field(None, max_length=20)

    model_config = {"populate_by_name": True}

    @field_validator("service_type")
    @classmethod
    def check_service(cls, v):
        if v not in ("cargo", "equipment"):
            raise ValueError("service_type: cargo yoki equipment")
        return v

    @field_validator("vehicle_category")
    @classmethod
    def check_category(cls, v):
        if v is not None and v not in VEHICLE_CATEGORIES:
            raise ValueError("Noma'lum transport kategoriyasi")
        return v

    @field_validator("duration_unit")
    @classmethod
    def check_unit(cls, v):
        if v is not None and v not in ("hour", "shift", "day"):
            raise ValueError("duration_unit: hour, shift yoki day")
        return v


class OfferIn(BaseModel):
    vehicle_id: int
    price: float = Field(gt=0)
    available_at: datetime | None = None
    message: str | None = Field(None, max_length=500)


class CancelIn(BaseModel):
    reason: str | None = Field(None, max_length=300)


# ── Reyting ─────────────────────────────────────────────────────────────────
class ReviewIn(BaseModel):
    service_type: str
    ref_id: int
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(None, max_length=1000)

    @field_validator("service_type")
    @classmethod
    def check(cls, v):
        if v not in ("carpool", "cargo", "equipment"):
            raise ValueError("service_type: carpool, cargo yoki equipment")
        return v


# ── Admin ───────────────────────────────────────────────────────────────────
class ServiceTariffIn(BaseModel):
    service_type: str
    vehicle_category: str | None = None
    base_price: float = Field(0, ge=0)
    per_km: float = Field(0, ge=0)
    per_hour: float = Field(0, ge=0)
    per_shift: float = Field(0, ge=0)
    per_day: float = Field(0, ge=0)
    per_seat_km: float = Field(0, ge=0)
    min_price: float = Field(0, ge=0)
    is_active: bool = True
