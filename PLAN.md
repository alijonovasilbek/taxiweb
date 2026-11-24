# Chortoq Services — ishlab chiqish rejasi

Chortoq tumani uchun yagona onlayn transport va texnika xizmatlari platformasi.
Asos: mavjud TaxiGo loyihasi (FastAPI + asyncpg + PostGIS + Redis + Socket.io + React/Vite + aiogram).
TZ'dagi Java/Spring Boot o'rniga **Python/FastAPI** ishlatiladi.

## Asosiy qarorlar

| # | Qaror | Sabab |
|---|-------|-------|
| 1 | Mavjud taksi oqimi (`orders`, `drivers`, driver-app) o'zgarmaydi | Ishlab turgan funksiyani buzmaslik |
| 2 | Yangi servislar `users` jadvaliga bog'lanadi (bitta akkaunt, `roles TEXT[]`) | "Bitta akkaunt — bir nechta rol" |
| 3 | `passenger-app` → **Chortoq Services** yagona Mini App (mijoz + ijrochi rejimi) | Telegram initData bilan bitta kirish |
| 4 | Taksi haydovchi paneli alohida `driver-app` sifatida qoladi | Admin tasdiqlash + login oqimi mavjud |
| 5 | Yuk tashish va Spets texnika bitta umumiy model: `service_requests` + `offers` (taklif/auksion) | Ikkalasining biznes jarayoni bir xil: so'rov → taklif → tanlash → bajarish → baho |
| 6 | Po'puti: `carpool_trips` + `carpool_bookings` | Haydovchi qatnov e'lon qiladi, mijoz joy bron qiladi |
| 7 | Komissiyasiz: yangi servislarda to'lov — to'g'ridan-to'g'ri kelishuv (naqd) | TZ: "Komissiyasiz" |
| 8 | Sohalararo moslashtirish: transport **kategoriyasi** bo'yicha (masalan, Labo → yuk tashish + po'puti) | TZ: "Labongiz bo'sh bo'lsa yuk so'rovida ham taklif qilinadi" |
| 9 | Real vaqt: Socket.io `user:{id}` xonasi + Telegram bot xabarnomasi + `notifications` jadvali | Bitta `notify()` funksiyasi |
| 10 | Kelajakdagi servislar (qishloq xo'jaligi texnikasi, kuryer, ijara, korporativ) katalogda `is_active=false` | Kengaytirishga tayyor |
| 11 | Standart xarita markazi — Chortoq (41.069, 71.823) | Mahalliy platforma |

## 1-bosqich — Ma'lumotlar bazasi (alembic `003_multi_service`)

- `users` + `roles TEXT[]`, `company_name`, `bio`, `provider_rating`, `provider_reviews`
- `service_types` — katalog (taxi, carpool, cargo, equipment, agro, courier, rental, corporate)
- `vehicles` — egasi, kategoriya, model, raqam, sig'im (kg/o'rin), soatlik/smena/kunlik narx, holat (pending/approved/rejected), `is_available`, joylashuv (GEOGRAPHY)
- `user_documents` — hujjatlar (prava, tex-pasport, rasm)
- `availability` — haftalik jadval (hafta kuni, boshlanish/tugash vaqti)
- `carpool_trips`, `carpool_bookings`
- `service_requests` (cargo/equipment), `offers`
- `service_tariffs` — servis + kategoriya bo'yicha narx qoidalari
- `reviews` — umumiy reyting (servis, obyekt id, baholovchi, baholanuvchi)
- `notifications` + `user_id` asosida ishlatiladi

## 2-bosqich — Backend

| Modul | Endpointlar |
|-------|-------------|
| `catalog` | `GET /catalog` — servislar, kategoriyalar, rollar |
| `users` | `GET/PUT /users/me`, `PUT /users/me/roles` |
| `vehicles` | CRUD `/vehicles`, rasm/hujjat yuklash, bo'sh/band, lokatsiya |
| `schedules` | `GET/PUT /schedules/me` |
| `carpool` | qatnov e'lon qilish, qidirish, bron, tasdiqlash/rad, yakunlash |
| `requests` | so'rov yaratish, ijrochilar lentasi (mos so'rovlar), takliflar, qabul, boshlash, yakunlash, bekor |
| `search` | smart search — barcha servislar bo'yicha (lokatsiya, vaqt, narx, reyting, kategoriya) |
| `reviews` | umumiy reyting va sharhlar |
| `notifications` | ro'yxat, o'qildi |
| `tariffs` | narx hisoblash (`/tariffs/estimate`) |
| `admin` | foydalanuvchilar, transport tasdiqlash, qatnovlar, so'rovlar, servis tariflari, servislarni yoqish/o'chirish, umumiy statistika |

Servislar: `smart_match` (masofa + jadval + reyting + narx bo'yicha ball), `notify` (DB + socket + bot), `service_pricing`.

## 3-bosqich — Chortoq Services Mini App (`passenger-app`)

- Bosh sahifa: 4 servis + kengaytiriladigan servislar, faol buyurtmalar, bildirishnomalar
- Taksi (mavjud oqim)
- Po'puti: qidirish → bron; "Qatnov e'lon qilish"; mening qatnovlarim/bronlarim
- Yuk tashish / Spets texnika: so'rov yaratish → takliflarni ko'rish → tanlash → baholash
- Ijrochi rejimi: mos so'rovlar lentasi, taklif berish, mening ishlarim
- Mening transportim: transport qo'shish, hujjat, bo'sh/band, haftalik jadval
- Profil: rollarni tanlash, telefon, kompaniya
- Smart qidiruv, bildirishnomalar, sharhlar

## 4-bosqich — Admin panel

Yangi sahifalar: Foydalanuvchilar, Transport (tasdiqlash), Po'puti qatnovlari, So'rovlar (yuk/texnika + takliflar), Servislar va tariflar. Dashboard — barcha servislar bo'yicha statistika.

## 5-bosqich — Bot, test, hujjat

- Bot `/start` → Chortoq Services menyusi
- `backend/tests/` — API smoke testlar (haqiqiy PostGIS bazada)
- Frontend `vite build` tekshiruvi
- `README.md` — ishga tushirish yo'riqnomasi

## Roadmap (TZ bo'yicha) bilan moslik

| TZ bosqichi | Holat |
|-------------|-------|
| MVP: Taksi + asosiy buyurtma | mavjud |
| Kengaytirish-1: Po'puti | shu ishda |
| Kengaytirish-2: Yuk tashish | shu ishda |
| Kengaytirish-3: Spets texnika | shu ishda |
| Masshtab: boshqa tumanlar | keyingi bosqich (katalogda tayyor) |
