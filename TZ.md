# TaxiGo — Texnik Topshiriq (TZ)

**Versiya:** 1.0  
**Sana:** 2026-05-30  
**Loyiha:** TaxiGo — Telegram Mini App orqali taksi xizmati  

---

## 1. LOYIHAGA UMUMIY KO'RINISH

TaxiGo — Telegram messenjeri ichida ishlaydigan taksi xizmati. Foydalanuvchilar alohida ilova yuklamasdan, to'g'ridan-to'g'ri Telegram Web App (Mini App) orqali taksi buyurtma qiladilar. Tizim uchta rol uchun mo'ljallangan: **yo'lovchi**, **haydovchi** va **administrator**.

### Asosiy afzalliklar
- Telegram ichida ishlaydi — ilova yuklab olish shart emas
- Real vaqtda haydovchi~~ ~~kuzatuvi
- Ko'p tizimli to'lov: Payme, Click, Telegram Payments, naqd
- Haydovchi va yo'lovchi o'rtasida reyting tizimi
- Administrator boshqaruv paneli

---

## 2. TEXNOLOGIYALAR STAKKI

| Qatlam | Texnologiya |
|--------|-------------|
| Frontend | React 18 + Vite (ikki alohida build) |
| Backend | Node.js 20 + Express 4 |
| Ma'lumotlar bazasi | PostgreSQL 15 + PostGIS 3.3 |
| Real-time | Socket.io 4 |
| Kesh | Redis 7 |
| Xaritalar | Yandex Maps JS API 2.1 |
| Bot | Telegraf.js 4 |
| Auth | Telegram initData HMAC-SHA256 + JWT |
| Konteyner | Docker + Docker Compose |

---

## 3. FOYDALANUVCHI ROLLARI

### 3.1 Yo'lovchi (Passenger)
- Telegram orqali avtomatik ro'yxatdan o'tish (initData)
- Manzil kiritish va narx hisoblash
- Buyurtma yaratish
- Haydovchini real vaqtda xaritada kuzatish
- To'lov amalga oshirish
- Haydovchini baholash (1–5 yulduz)
- Buyurtmalar tarixini ko'rish

### 3.2 Haydovchi (Driver)
- Telegram orqali ro'yxatdan o'tish + ma'lumot kiritish
- Mashina va hujjat ma'lumotlarini yuklash
- Administrator tomonidan tasdiqlanishni kutish
- Onlayn/oflayn holatni boshqarish
- GPS koordinatalarni real vaqtda yuborish
- Yangi buyurtmalarni qabul qilish yoki rad etish (30 sek)
- Yo'lovchi manziliga navigatsiya
- Daromadlarini ko'rish
- Yo'lovchini baholash

### 3.3 Administrator (Admin)
- Haydovchilarni ko'rish, tasdiqlash, bloklash
- Barcha buyurtmalarni monitoring qilish
- To'lovlarni kuzatish
- Tarif boshqaruvi
- Live xaritada barcha faol haydovchilar
- Kunlik/haftalik statistika va hisobotlar

---

## 4. YO'LOVCHI OQIMI

```
Telegram Bot /start
    → WebApp tugmasi
    → initData tekshirish (backend HMAC verify)
    → Yo'lovchi Dashboard (uy sahifasi)
    → "Taksi buyurtma" tugmasi
    → GPS joylashuvni aniqlash
    → Yandex Geocoder — manzilga aylantirish
    → Manzil tasdiqlash / qo'lda kiritish
    → Boradigan joy kiritish (autocomplete)
    → Yandex Router — marshrut + vaqt hisoblash
    → Narx hisoblash (tarif bo'yicha)
    → To'lov turini tanlash (naqd/Payme/Click/Telegram)
    → POST /api/orders — buyurtma yaratish
    → Haydovchi qidirilmoqda (Socket hodisasi)
    → Haydovchi topildi / topilmadi
    → Haydovchi qabul qildi — xaritada ko'rish
    → Real vaqt kuzatuv (Socket: driver_location)
    → Haydovchi keldi (driver_arrived)
    → Sayohat boshlandi (ride_started)
    → Sayohat tugadi (ride_completed)
    → To'lov ekrani
    → Baholash ekrani (1–5 yulduz + izoh)
    → Dashboard
```

---

## 5. HAYDOVCHI OQIMI

```
Telegram Bot /start
    → "Haydovchi sifatida ro'yxat" tugmasi
    → Driver WebApp ochiladi
    → Shaxsiy ma'lumotlar (ism, telefon)
    → Mashina ma'lumotlari (model, rang, raqam)
    → Hujjat rasmlari yuklash
    → "Tasdiq kutilmoqda" holati
    → [Administrator tasdiqlaydi]
    → Bot xabari: "Siz tasdiqlandi!"
    → Driver Dashboard
    → "Onlayn" tugmasi — GPS yoqiladi
    → GPS Socket.io orqali har 4 sek yuboriladi
    → Yangi buyurtma keldi — bildirishnoma + ovoz
    → Buyurtma tafsilotlari: manzil, narx, yo'lovchi reytingi
    → Qabul qilish (30 sek ichida) / Rad etish
    → [QABUL]
    → Yo'lovchi manziliga Yandex Navigator ochiladi
    → "Keldim" tugmasi bosiladi
    → Sayohat boshlandi
    → Boradigan manzilga navigatsiya
    → "Tugadi" tugmasi
    → To'lov tasdiqlanadi
    → Yo'lovchini baholash
    → Onlayn holat — yangi buyurtma kutish
```

---

## 6. REST API ENDPOINTLAR

### Autentifikatsiya
```
POST /api/auth/verify-telegram    — Telegram initData tekshirish, JWT qaytarish
POST /api/auth/refresh            — JWT tokenni yangilash
```

### Yo'lovchilar
```
GET  /api/users/me                — Profil ma'lumotlari
PUT  /api/users/me                — Profilni yangilash
GET  /api/users/me/rides          — Buyurtmalar tarixi
GET  /api/users/me/ratings        — Reytinglar
```

### Haydovchilar
```
POST /api/drivers/register        — Haydovchi ro'yxatdan o'tishi
GET  /api/drivers/me              — Haydovchi profili
PUT  /api/drivers/me              — Profilni yangilash
PUT  /api/drivers/me/status       — Onlayn/Oflayn holat
GET  /api/drivers/me/earnings     — Daromadlar
GET  /api/drivers/me/rides        — Sayohatlar tarixi
POST /api/drivers/me/documents    — Hujjat yuklash
GET  /api/drivers/nearby          — Yaqin haydovchilar (yo'lovchi uchun)
```

### Buyurtmalar
```
POST /api/orders                  — Yangi buyurtma yaratish
GET  /api/orders/:id              — Buyurtma tafsilotlari
PUT  /api/orders/:id/accept       — Haydovchi qabul qildi
PUT  /api/orders/:id/reject       — Haydovchi rad etdi
PUT  /api/orders/:id/arrived      — Haydovchi keldi
PUT  /api/orders/:id/start        — Sayohat boshlandi
PUT  /api/orders/:id/complete     — Sayohat tugadi
PUT  /api/orders/:id/cancel       — Bekor qilish
GET  /api/orders/active           — Faol buyurtma
```

### To'lovlar
```
POST /api/payments/payme/create   — Payme to'lov yaratish
POST /api/payments/payme/verify   — Payme webhook
POST /api/payments/click/create   — Click to'lov yaratish
POST /api/payments/click/verify   — Click webhook
POST /api/payments/telegram/create — Telegram Invoice
POST /api/payments/telegram/verify — pre_checkout_query
GET  /api/payments/:orderId       — To'lov holati
```

### Reytinglar
```
POST /api/ratings                 — Reyting qoldirish
GET  /api/ratings/driver/:id      — Haydovchi reytingi
GET  /api/ratings/user/:id        — Yo'lovchi reytingi
```

### Xaritalar
```
GET  /api/maps/geocode            — Manzil → koordinat
GET  /api/maps/reverse-geocode    — Koordinat → manzil
GET  /api/maps/route              — Marshrut hisoblash
POST /api/maps/suggest            — Manzil autocomplete
```

### Admin
```
GET  /api/admin/dashboard         — Statistika
GET  /api/admin/drivers           — Barcha haydovchilar
PUT  /api/admin/drivers/:id/approve — Tasdiqlash
PUT  /api/admin/drivers/:id/block — Bloklash
GET  /api/admin/orders            — Barcha buyurtmalar
GET  /api/admin/payments          — To'lovlar
PUT  /api/admin/tariffs           — Tarif yangilash
GET  /api/admin/tariffs           — Joriy tarif
GET  /api/admin/active-drivers    — Live xarita uchun haydovchilar
GET  /api/admin/reports/daily     — Kunlik hisobot
GET  /api/admin/reports/weekly    — Haftalik hisobot
```

---

## 7. SOCKET.IO HODISALARI

### Mijoz → Server

| Hodisa | Ma'lumot | Izoh |
|--------|----------|------|
| `driver:go_online` | `{ driverId, lat, lng }` | Haydovchi onlayn |
| `driver:go_offline` | `{ driverId }` | Haydovchi oflayn |
| `driver:location_update` | `{ driverId, lat, lng, heading, speed }` | Har 4 sek |
| `driver:accept_order` | `{ driverId, orderId }` | Buyurtma qabul |
| `driver:reject_order` | `{ driverId, orderId }` | Buyurtma rad |
| `driver:arrived` | `{ driverId, orderId }` | Haydovchi keldi |
| `driver:start_ride` | `{ driverId, orderId }` | Sayohat boshlandi |
| `driver:complete_ride` | `{ driverId, orderId }` | Sayohat tugadi |
| `passenger:cancel_order` | `{ passengerId, orderId, reason }` | Yo'lovchi bekor |
| `passenger:track_order` | `{ orderId }` | Kuzatishni boshlash |

### Server → Mijoz

| Hodisa | Ma'lumot | Kimga |
|--------|----------|-------|
| `new_order` | `{ orderId, pickup, dropoff, price, passengerRating, timeout:30 }` | Haydovchiga |
| `order_accepted` | `{ orderId, driver: { name, phone, car, rating, location } }` | Yo'lovchiga |
| `order_rejected` | `{ orderId }` | Yo'lovchiga |
| `driver_location` | `{ orderId, lat, lng, heading, eta }` | Yo'lovchiga |
| `driver_arrived` | `{ orderId }` | Yo'lovchiga |
| `ride_started` | `{ orderId }` | Ikkalasiga |
| `ride_completed` | `{ orderId, finalPrice, duration }` | Ikkalasiga |
| `order_cancelled` | `{ orderId, reason, cancelledBy }` | Ikkalasiga |
| `no_drivers_found` | `{ orderId }` | Yo'lovchiga |
| `payment_confirmed` | `{ orderId, amount, method }` | Ikkalasiga |
| `new_order_timeout` | `{ orderId }` | Haydovchiga |

---

## 8. MA'LUMOTLAR BAZASI SXEMASI

### 8.1 users
```sql
id, telegram_id (UNIQUE), telegram_username, first_name, last_name,
phone, avatar_url, rating (DEFAULT 5.00), total_rides,
is_blocked (DEFAULT false), language (DEFAULT 'uz'),
created_at, updated_at
```

### 8.2 drivers
```sql
id, user_id (FK users), telegram_id (UNIQUE),
first_name, last_name, phone,
car_model, car_color, car_number (UNIQUE), car_year,
license_photo_url, car_doc_photo_url,
status ('pending'|'approved'|'blocked'|'rejected'),
is_online (DEFAULT false), is_on_ride (DEFAULT false),
current_location (GEOGRAPHY POINT), last_location_update,
rating (DEFAULT 5.00), total_rides, total_earnings, balance,
created_at, updated_at

INDEX: GIST(current_location), is_online, status
```

### 8.3 orders
```sql
id, passenger_id (FK users), driver_id (FK drivers),
pickup_address, pickup_lat, pickup_lng, pickup_location (GEOGRAPHY),
dropoff_address, dropoff_lat, dropoff_lng, dropoff_location (GEOGRAPHY),
distance_km, duration_min, route_polyline,
estimated_price, final_price,
status ('searching'|'accepted'|'driver_arrived'|'in_progress'|'completed'|'cancelled'|'no_drivers'),
payment_method ('cash'|'payme'|'click'|'telegram'),
payment_status ('pending'|'paid'|'refunded'|'failed'),
payment_id,
requested_at, accepted_at, arrived_at, started_at, completed_at, cancelled_at,
cancel_reason, passenger_rated, driver_rated,
created_at, updated_at
```

### 8.4 ratings
```sql
id, order_id (FK), rater_id (FK users),
rated_driver_id (FK drivers), rated_user_id (FK users),
rating (1-5), comment, created_at

UNIQUE: (order_id, rater_id)
```

### 8.5 payments
```sql
id, order_id (FK), user_id (FK),
amount, currency (DEFAULT 'UZS'),
method ('cash'|'payme'|'click'|'telegram'),
status ('pending'|'processing'|'completed'|'failed'|'refunded'),
external_id, external_status, webhook_data (JSONB),
initiated_at, completed_at, created_at, updated_at
```

### 8.6 tariffs
```sql
id, name, base_fare, per_km_price, per_min_price,
min_fare, night_multiplier (DEFAULT 1.5), is_active,
created_at
```

### 8.7 notifications
```sql
id, user_id (FK), driver_id (FK),
type, title, message, data (JSONB),
is_read (DEFAULT false), created_at
```

### 8.8 driver_location_history
```sql
id (BIGSERIAL), driver_id (FK), order_id (FK),
location (GEOGRAPHY POINT), recorded_at

INDEX: GIST(location)
```

---

## 9. YANDEX MAPS API INTEGRATSIYA

| API | Maqsad | Endpoint |
|-----|--------|---------|
| Geocoder | Manzil → koordinat | `geocode-maps.yandex.ru/1.x/` |
| Reverse Geocoder | Koordinat → manzil | `geocode-maps.yandex.ru/1.x/` |
| Router | Marshrut + masofa + vaqt | `router.yandex.net/v2/route` |
| Suggest | Manzil autocomplete | `suggest-maps.yandex.ru/v1/suggest` |
| JS API 2.1 | Frontend interaktiv xarita | CDN `api-maps.yandex.ru/2.1/` |

**Narx hisoblash formulasi:**
```
narx = base_fare + (km × per_km_price) + (min × per_min_price)
kechasi (22:00–06:00): narx × night_multiplier
minimal: max(narx, min_fare)
```

---

## 10. TO'LOV TIZIMLARI

### Payme
1. Backend `POST /api/payments/payme/create` → transaction yaratiladi
2. Foydalanuvchi Payme webviewga yo'naltiriladi
3. Payme → `POST /api/payments/payme/verify` (webhook, HMAC tekshirish)
4. Order holati `paid` ga o'zgaradi, Socket event yuboriladi

### Click
1. Backend `POST /api/payments/click/create` → Click URL
2. Foydalanuvchi Click sahifasiga o'tadi
3. Click → `POST /api/payments/click/verify` (webhook, sign tekshirish)

### Telegram Payments
1. Bot `sendInvoice` yuboradi
2. Foydalanuvchi Telegram ichida to'laydi
3. Bot `pre_checkout_query` → `answerPreCheckoutQuery(true)`
4. `successful_payment` eventi → backend holat yangilaydi

### Naqd pul
- Haydovchi naqd oladi, `complete_ride` da avtomatik `paid` bo'ladi

---

## 11. TELEGRAM BOT

**Buyruqlar:**
```
/start   — Botni boshlash, WebApp tugmalarini ko'rsatish
/help    — Yordam
/profile — Profil
/rides   — Oxirgi buyurtmalar
/support — Qo'llab-quvvatlash
```

**WebApp tugmalari:**
- 🚕 Taksi buyurtma → `https://taxigo.uz/passenger`
- 🚗 Haydovchi → `https://taxigo.uz/driver`

---

## 12. PAPKA TUZILMASI

```
taxiweb/
├── TZ.md                          ← Bu fayl
├── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── knexfile.js
│   ├── src/
│   │   ├── server.js
│   │   ├── app.js
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── socket.js
│   │   │   ├── telegram.js
│   │   │   └── redis.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── adminAuth.js
│   │   │   ├── errorHandler.js
│   │   │   ├── rateLimiter.js
│   │   │   └── validate.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── socket/
│   │   ├── bot/
│   │   └── utils/
│   ├── migrations/
│   └── seeds/
│
├── passenger-app/                 ← Yo'lovchi Telegram Mini App
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── pages/ (Home, BookRide, Tracking, Payment, Rating, History, Profile)
│       ├── components/ (Map, UI, Layout)
│       ├── hooks/ (useTelegram, useSocket, useLocation, useOrder, useYandexMaps)
│       ├── store/ (Zustand)
│       └── services/ (api, socket, yandexMaps)
│
├── driver-app/                    ← Haydovchi Telegram Mini App
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── pages/ (Register, Dashboard, NewOrder, ActiveRide, Earnings, Profile)
│       ├── components/
│       ├── hooks/ (useTelegram, useSocket, useDriverLocation, useOrder)
│       ├── store/ (Zustand)
│       └── services/
│
├── admin-panel/                   ← Administrator paneli
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── pages/ (Dashboard, Drivers, Orders, Payments, Reports, Tariffs, LiveMap)
│       ├── components/
│       └── services/
│
└── shared/
    ├── constants.js               ← Status kodlari, socket event nomlari
    ├── validators.js
    └── types.js
```

---

## 13. XAVFSIZLIK

- Telegram initData har so'rovda HMAC-SHA256 tekshiriladi, vaqt muddati 5 daqiqa
- JWT — 7 kunlik, refresh token mexanizmi
- Payme/Click webhooks — IP whitelist + signature verification
- SQL — faqat parametrized queries (pg/knex)
- Rate limiting — express-rate-limit, auth endpointlari uchun qattiqroq
- Fayl yuklash — faqat JPEG/PNG, maks 5 MB, MIME tekshirish
- Admin panel — alohida JWT secret, Telegram ID whitelist
- Production — faqat HTTPS (SSL/TLS)
- Socket.io — har ulanishda JWT tekshirish

---

## 14. MUHIT O'ZGARUVCHILARI (.env.example)

```bash
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://taxigo:password@localhost:5432/taxigo_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=minimum_64_chars_random_string_here
JWT_EXPIRES_IN=7d

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:AABBCCDDEEFFaabbccddeeff
TELEGRAM_PAYMENT_TOKEN=your_payment_provider_token
ADMIN_TELEGRAM_IDS=123456789,987654321

# Yandex Maps
YANDEX_MAPS_API_KEY=your_yandex_maps_api_key
YANDEX_GEOCODER_API_KEY=your_geocoder_key
YANDEX_ROUTER_API_KEY=your_router_key

# Payme
PAYME_MERCHANT_ID=your_merchant_id
PAYME_SECRET_KEY=your_secret_key
PAYME_IS_TEST=true

# Click
CLICK_MERCHANT_ID=your_merchant_id
CLICK_SERVICE_ID=your_service_id
CLICK_SECRET_KEY=your_secret_key

# Frontend URLs
PASSENGER_APP_URL=http://localhost:5173
DRIVER_APP_URL=http://localhost:5174
ADMIN_URL=http://localhost:5175
```

---

## 15. AMALGA OSHIRISH BOSQICHLARI

| Bosqich | Hafta | Maqsad |
|---------|-------|--------|
| 1 — MVP | 1–3 | Infratuzilma, buyurtma oqimi, naqd to'lov, Socket.io |
| 2 — To'lov | 4–5 | Payme, Click, Telegram Payments |
| 3 — Admin | 6–7 | Admin panel, statistika, hisobotlar |
| 4 — Prod | 8 | Docker, Nginx, SSL, deploy |
