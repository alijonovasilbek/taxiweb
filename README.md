# Chortoq Services

Chortoq tumani uchun yagona onlayn transport va texnika xizmatlari platformasi:
**Taksi · Po'puti (kunlik yo'nalish) · Yuk tashish · Spets texnika**.
Platforma komissiyasiz ishlaydi. Bitta akkaunt bilan bir nechta rolni bajarish mumkin.

> TZ'da backend Java/Spring Boot deb ko'rsatilgan. Bu loyihada u **Python (FastAPI)** da yozilgan.
> Ishlab chiqish rejasi va qabul qilingan qarorlar: [`PLAN.md`](PLAN.md).

## Arxitektura

| Qatlam | Texnologiya |
|--------|-------------|
| Backend | Python 3.12, FastAPI, asyncpg, python-socketio, aiogram 3 |
| Ma'lumotlar | PostgreSQL 15 + PostGIS (geolokatsiya), Redis |
| Real vaqt | Socket.io (`user:{id}` xonasi) + Telegram bot xabarnomalari |
| Mijoz/ijrochi ilovasi | `passenger-app` — **Chortoq Services Telegram Mini App** (React + Vite) |
| Taksi haydovchi paneli | `driver-app` (React, login/parol) |
| Admin panel | `admin-panel` (React) |
| Xarita/marshrut | Yandex Maps + OSRM (zaxira: masofani hisoblash) |

### Yagona foydalanuvchi modeli
`users.roles` — `client`, `driver`, `cargo`, `equipment_owner`, `company`. Foydalanuvchi transport
qo'shganda unga mos rol avtomatik beriladi. Rollarni profil sahifasida ham tanlash mumkin.

### Servislar va biznes jarayonlari

| Servis | Oqim |
|--------|------|
| 🚕 Taksi | mavjud oqim: buyurtma → yaqin haydovchi → qabul → yetib keldi → safar → yakun → baho |
| 🚐 Po'puti | haydovchi qatnov e'lon qiladi (vaqt, o'rin, narx, takrorlanish) → mijoz qidiradi va bron qiladi → haydovchi tasdiqlaydi → yo'lga chiqadi → yakun → o'zaro baho |
| 🚚 Yuk tashish / 🚜 Spets texnika | mijoz so'rov yaratadi → tizim mos ijrochilarni topib xabar beradi → ijrochilar narx/vaqt taklif qiladi → mijoz tanlaydi → ish boshlanadi → yakun → o'zaro baho |

### Smart Search va Matching (`app/services/smart_match.py`)
Ijrochi bali 0..100 oralig'ida, quyidagi ulushlar bilan hisoblanadi:

| Mezon | Ulush |
|-------|-------|
| Masofa (PostGIS) | 40% |
| Reyting | 25% |
| Bo'sh vaqt (haftalik jadval yoki "hozir bo'sh") | 20% |
| Narxning mijoz byudjetiga mosligi | 15% |

**Sohalararo moslashtirish:** transport kategoriyasi bir nechta servisga mos keladi
(`app/catalog.py`). Masalan, Damas egasi po'puti qatnovini ham, yuk tashish so'rovlarini ham oladi.

## Ishga tushirish

### Docker (to'liq tizim)
```bash
cp .env.example .env          # qiymatlarni to'ldiring
docker compose up -d --build  # backend konteyneri ishga tushganda migratsiyalar avtomatik qo'llanadi
```
Gateway: http://localhost:8080 — `/` Mini App, `/driver/` haydovchi, `/admin/` admin, `/api/docs` API hujjati.

### Lokal ishlab chiqish (Windows)
```bash
docker compose up -d postgres redis

cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest
# backend/.env:  DATABASE_URL=postgresql://taxigo:taxigo123@localhost:5433/taxigo_db
#                REDIS_URL=redis://localhost:6380  DEV_MODE=true  ADMIN_TELEGRAM_IDS=123456789 ...
.venv/Scripts/alembic upgrade head
.venv/Scripts/python -m seeds.demo_data             # ixtiyoriy: demo foydalanuvchilar, transport, qatnovlar
.venv/Scripts/uvicorn main:socket_app --port 3000 --reload

cd ../passenger-app && npm install && npm run dev  # http://localhost:5173
cd ../admin-panel   && npm install && npm run dev  # http://localhost:5175/admin/
```
`DEV_MODE=true` bo'lsa, Mini App Telegram'dan tashqarida `/api/auth/dev-login` orqali test foydalanuvchi
(telegram_id `999999999`) nomidan kiradi. `localStorage.dev_tg_id` qiymatini o'zgartirib, boshqa
foydalanuvchiga o'tish mumkin. Admin panelga dev rejimda `123456789` ID bilan kiriladi.

### Testlar
```bash
cd backend && .venv/Scripts/python -m pytest -q
```
End-to-end testlar haqiqiy PostGIS bazada ishlaydi. Ular rollar, yuk tashish oqimi (sohalararo
moslik bilan), spets texnika oqimi (jadval, ijrochining voz kechishi), po'puti (bron, o'rinlar hisobi,
holatlar), smart search, tariflar va admin funksiyalarini tekshiradi. Testlar o'zi yaratgan
ma'lumotlarni o'chirib ketadi.

## Ma'lumotlar modeli (asosiy jadvallar)

| Jadval | Vazifasi |
|--------|----------|
| `users` | foydalanuvchilar, rollar (`roles[]`), mijoz va ijrochi reytingi |
| `service_types` | servislar katalogi (yoqish/o'chirish; kelajakdagi servislar `is_active=false`) |
| `vehicles` | transport va texnika: kategoriya, sig'im, narxlar, holat, joylashuv (GEOGRAPHY) |
| `user_documents` | hujjatlar (prava, tex-pasport...) |
| `availability` | haftalik ish jadvali (bo'sh vaqtlar) |
| `carpool_trips`, `carpool_bookings` | po'puti qatnovlari va bronlar |
| `service_requests`, `offers` | yuk/texnika so'rovlari va ijrochilar takliflari |
| `service_tariffs` | servis va kategoriya bo'yicha narx qoidalari |
| `reviews` | umumiy reyting va sharhlar |
| `notifications` | bildirishnomalar |
| `orders`, `drivers`, `tariffs`, ... | taksi moduli (avvalgidek) |

Migratsiyalar: `backend/alembic/versions/` (001–005).

## API (qisqacha)
To'liq ro'yxat: `/api/docs`.

- `GET /api/catalog`, `GET /api/tariffs/estimate`
- `GET|PUT /api/users/me`, `PUT /api/users/me/roles`, `GET /api/users/{id}/public`
- `/api/vehicles` (CRUD, `/{id}/availability`, `/{id}/photo`, `/{id}/documents`), `GET|PUT /api/schedules/me`
- `/api/carpool/trips` (yaratish, `search`, `my`, `{id}`, `{id}/book`, `{id}/status`), `/api/carpool/bookings/...`
- `/api/requests` (yaratish, `my`, `feed`, `jobs`, `{id}`, `{id}/offers`, `.../accept`, `start`, `complete`, `cancel`, `matches`)
- `GET /api/search` — smart search; `POST /api/reviews`; `/api/notifications`
- Admin: `/api/admin/overview`, `users`, `vehicles`, `carpool/trips`, `requests`, `service-types`, `service-tariffs`

### Socket.io hodisalari (server → mijoz, `user:{id}` xonasi)
`notification`, `request:new`, `offer:new`, `offer:accepted`, `offer:rejected`, `request:status`,
`carpool:booking_new`, `carpool:booking_updated`, `carpool:trip_status`, `vehicle:status`.

## Roadmap holati

| Bosqich | Holat |
|---------|-------|
| MVP: Taksi + asosiy buyurtma | ✅ |
| Kengaytirish-1: Po'puti | ✅ |
| Kengaytirish-2: Yuk tashish | ✅ |
| Kengaytirish-3: Spets texnika | ✅ |
| Kengaytiriladigan: qishloq xo'jaligi texnikasi, kuryer, ijara, korporativ | katalogda tayyor (admin yoqadi) |
| Masshtab: boshqa tumanlar | keyingi bosqich |
