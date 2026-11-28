"""Taksi buyurtmasini bekor qilish sabablari (yo'lovchi va haydovchi uchun alohida) — analitika uchun kod bilan saqlanadi."""

PASSENGER = {
    "wait_long": "Haydovchi juda uzoq",
    "changed_mind": "Rejam o'zgardi",
    "wrong_address": "Manzilni noto'g'ri kiritdim",
    "driver_asked": "Haydovchi bekor qilishni so'radi",
    "found_other": "Boshqa transport topdim",
    "price": "Narx qimmat",
    "other": "Boshqa sabab",
}

DRIVER = {
    "passenger_no_show": "Yo'lovchi chiqmadi",
    "passenger_asked": "Yo'lovchi bekor qilishni so'radi",
    "far_pickup": "Olib ketish joyi juda uzoq",
    "car_problem": "Mashinada nosozlik",
    "unsafe": "Xavfsiz emas",
    "wrong_pin": "Manzil noto'g'ri belgilangan",
    "other": "Boshqa sabab",
}

BY_ROLE = {"passenger": PASSENGER, "driver": DRIVER}


def label(role: str, code: str | None) -> str | None:
    return BY_ROLE.get(role, {}).get(code or "")
