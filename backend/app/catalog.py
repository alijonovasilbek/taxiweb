"""Chortoq Services katalogi: rollar, transport kategoriyalari va ularning servislarga mosligi.

Sohalararo moslashtirish shu jadvalga asoslanadi: masalan, Damas egasi ham po'puti,
ham yuk tashish so'rovlarini oladi.
"""

ROLES = {
    "client": {"name": "Mijoz", "description": "Xizmat buyurtma qiladi", "icon": "🧑"},
    "driver": {"name": "Haydovchi", "description": "Taksi / po'puti qatnovlari", "icon": "🚗"},
    "cargo": {"name": "Yuk tashuvchi", "description": "Labo, Gazel, Isuzu va boshqalar", "icon": "🚚"},
    "equipment_owner": {"name": "Texnika egasi", "description": "Ekskavator, kran, buldozer...", "icon": "🚜"},
    "company": {"name": "Kompaniya vakili", "description": "Korxona nomidan buyurtma va xizmat", "icon": "🏢"},
}

PROVIDER_ROLES = {"driver", "cargo", "equipment_owner", "company"}

# kategoriya -> (nomi, ikonka, mos servislar, asosiy rol)
VEHICLE_CATEGORIES = {
    "sedan":          {"name": "Yengil avtomobil", "icon": "🚗", "services": ["taxi", "carpool"], "role": "driver"},
    "minivan":        {"name": "Miniven", "icon": "🚐", "services": ["taxi", "carpool", "cargo"], "role": "driver"},
    "bus":            {"name": "Mikroavtobus", "icon": "🚌", "services": ["carpool"], "role": "driver"},
    "damas":          {"name": "Damas", "icon": "🚐", "services": ["carpool", "cargo"], "role": "cargo"},
    "labo":           {"name": "Labo", "icon": "🛻", "services": ["cargo"], "role": "cargo"},
    "gazel":          {"name": "Gazel", "icon": "🚚", "services": ["cargo"], "role": "cargo"},
    "isuzu":          {"name": "Isuzu", "icon": "🚚", "services": ["cargo"], "role": "cargo"},
    "kamaz":          {"name": "KamAZ", "icon": "🚛", "services": ["cargo"], "role": "cargo"},
    "dump_truck":     {"name": "Samosval", "icon": "🚛", "services": ["cargo", "equipment"], "role": "cargo"},
    "excavator":      {"name": "Ekskavator", "icon": "🏗️", "services": ["equipment"], "role": "equipment_owner"},
    "bulldozer":      {"name": "Buldozer", "icon": "🚜", "services": ["equipment"], "role": "equipment_owner"},
    "crane":          {"name": "Avtokran", "icon": "🏗️", "services": ["equipment"], "role": "equipment_owner"},
    "loader":         {"name": "Yuklagich", "icon": "🚜", "services": ["equipment"], "role": "equipment_owner"},
    "tractor":        {"name": "Traktor", "icon": "🚜", "services": ["equipment", "agro"], "role": "equipment_owner"},
    "concrete_mixer": {"name": "Beton aralashtirgich", "icon": "🚛", "services": ["equipment"], "role": "equipment_owner"},
}

DOC_TYPES = {
    "license": "Haydovchilik guvohnomasi",
    "tech_passport": "Texnik pasport",
    "passport": "Pasport",
    "insurance": "Sug'urta",
    "other": "Boshqa",
}

REQUEST_SERVICES = ("cargo", "equipment")

# Qidiruv radiuslari (km) — tuman miqyosi
REQUEST_MATCH_RADIUS_KM = {"cargo": 40, "equipment": 60}
CARPOOL_MATCH_RADIUS_KM = 8


def categories_for_service(service: str) -> list[str]:
    return [code for code, c in VEHICLE_CATEGORIES.items() if service in c["services"]]


def services_for_category(category: str) -> list[str]:
    return VEHICLE_CATEGORIES.get(category, {}).get("services", [])
