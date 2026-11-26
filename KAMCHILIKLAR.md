# Chortoq Services — kamchiliklar va tuzatish holati

> Birinchi tahlil va tuzatish: 2026-11-25.
> Tekshiruv: `pytest` — **15/15 o'tdi**. Ulardan 9 tasi yangi: xavfsizlik, ro'yxatdan o'tish, rollar, hujjatlar, taksi oqimi, mashhur joylar, jurnal.
> Bundan tashqari ishlayotgan tizimda ngrok orqali qo'lda tekshirildi.
> Belgilar: ✅ tuzatildi · 🟡 qisman · ⏳ qoldi (sababi bilan).

---

## 1. Xavfsizlik

| # | Kamchilik | Holat | Nima qilindi |
|---|---|---|---|
| 2.1 | `DEV_MODE` ochiq internetda: `dev-login` bilan boshqa foydalanuvchi bo'lib kirish, raqamni tasdiqsiz "tasdiqlash" | ✅ | `dev-login` va `phone/dev` endi faqat **lokal** (proksi/tunnelsiz) so'rovga ochiq (`app/security.py: require_dev_local`). ngrok orqali → 403 (tekshirildi) |
| 2.2 | Mini App Telegram'siz "Test" foydalanuvchi bo'lib kiradi | ✅ | Mock faqat `npm run dev` da. Production build'da "bot orqali oching" ekrani chiqadi |
| 2.3 | Rollarni har kim o'zi yoqadi; transport qo'shilishi bilan (tasdiqsiz) rol beriladi; po'puti transportsiz ochiladi | ✅ | Rollar **tasdiqlangan transportdan** kelib chiqadi (`app/services/roles.py`). Foydalanuvchi faqat o'chira yoki qayta yoqa oladi. Po'puti faqat tasdiqlangan transport bilan ochiladi |
| 2.4 | Admin kirishi dev rejimga bog'liq; harakatlar jurnali yo'q | ✅ | Kirish **bot orqali bir martalik 6 xonali kod** bilan: 5 daqiqa, 5 urinish, rate limit. Telegram ichida kirish avtomatik. **Admin jurnali**: har bir o'zgartirish yoziladi, admin panelda "Jurnal" sahifasi |
| 2.5 | Namunaviy JWT kalitlari | ✅ | `backend/.env` da tasodifiy 64 baytli kalitlar |
| 2.6 | So'rovlar soni cheklanmagan (Yandex limiti tugashi mumkin) | ✅ | Redis asosidagi cheklov: qidiruv 40/daq, xarita 120/daq, kirish 30/daq, admin kodi 5/10 daq, yuklash 30/5 daq |
| 2.7 | To'lov imzolari oddiy `==` bilan solishtiriladi | ✅ | `hmac.compare_digest` (Payme, Click) |
| — | Yandex JS kalitiga Referer cheklovi | ⏳ | Yandex kabinetida **o'zingiz** qo'yasiz: JS xarita kaliti → HTTP Referer = ngrok yoki prod domen |

## 2. Funksional

| # | Kamchilik | Holat | Nima qilindi |
|---|---|---|---|
| 3.1 | initData 5 daqiqada eskiradi → qulf ekrani | ✅ | Muddat 24 soat. Login xato bersa, saqlangan token bilan davom etiladi |
| 3.2 | Taksi buyurtmasini hech kim qabul qila olmaydi (driver-app yo'q, ikki xil haydovchi tizimi) | ✅ | **Yagona akkaunt ko'prigi:** admin taksi transportini tasdiqlasa, `drivers` yozuvi avtomatik yaratiladi. Mini App ijrochi rejimida **"Taksi" bo'limi**: onlayn/oflayn, joylashuv yuborish, kiruvchi buyurtma (taymer bilan), qabul qilish → yetib keldim → safar → yakun, bekor qilish, Yandex navigatsiya, daromad. Bot tugmasi va `/driver/` shu yerga yo'naltirildi. Boshidan oxirigacha test: `test_taxi_flow.py` |
| 3.3 | Taksi xatosi doim "Xatolik yuz berdi" | ✅ | `apiError` + toast (`alert` olib tashlandi) |
| — | To'lov usuli doim "naqd" bo'lib saqlanardi | ✅ | `payment_method` to'g'ri yuboriladi (testda tekshiriladi) |
| 3.4 | Marshrut namoyish OSRM serverida | ⏳ | Kod tayyor (`OSRM_URL`). O'z OSRM serveri uchun ≥2 GB RAM kerak, shu kompyuterda xotira yetmaydi. Server (VPS) olinganda `osrm/` Dockerfile bilan ko'tariladi |
| 3.5 | Tarif bo'lmasa xato 500 | ✅ | Tushunarli 503 xabari. Bazada faol tarif bor |
| 3.6 | Ijrochi arizasi: majburiy hujjatlar yo'q | ✅ | Haydovchi va yuk tashuvchi uchun **pasport, haydovchilik guvohnomasi, texpasport**; texnika egasi uchun pasport va texpasport. Ular yuklanmaguncha admin tasdiqlay olmaydi. Mini App va admin panel yetishmayotganlarini ko'rsatadi. Pasport va guvohnoma bir marta yuklanadi va barcha transportlarga amal qiladi |
| 3.7 | Mijoz va ijrochi rejimlari almashmaydi | ✅ | "Mijoz / Ijrochi" almashtirgichi (Profil, Ijrochi paneli). Ijrochi menyusi: Ishlar · Taksi · Transport · Jadval · Profil. Rejim eslab qolinadi. Ijrochi bo'limi mijoz menyusidan olib tashlandi |
| 3.8 | Telefon maydonlari | ✅ | Tasdiqlangan raqam bilan to'ldiriladi. Raqam o'zgartirilsa, "boshqa raqam" ekani ko'rsatiladi |

## 3. UX va dizayn

| Kamchilik | Holat | Izoh |
|---|---|---|
| Tungi rejim yo'q | ✅ | Telegram mavzusiga ergashadi (`themeChanged` hodisasi), Telegram sarlavhasi ham moslashadi |
| "Uy / Ish" manzillari yo'q | ✅ | Server'da saqlanadi (barcha qurilmalarda), taksi sahifasida chip ko'rinishida |
| Yandex topmaydigan joylar | ✅ | Admin panel → **"Mashhur joylar"**: qidiruvda Yandex natijalaridan oldin chiqadi |
| Admin panel telefonda ishlamaydi | ✅ | < 900 px da yon menyu yuqori panelga aylanadi |
| Mini App bitta 400 KB fayl | ✅ | Sahifalar alohida yuklanadi (`React.lazy`): asosiy fayl 311 KB |
| Eski taksi sahifalari (Tracking, History, Payment, Rating) | 🟡 | Ranglar token'larga o'tkazildi (tungi rejim ishlaydi), lekin tuzilishi iOS komponentlariga to'liq qayta yozilmagan |
| Yuklash holatlari (skeleton) | ⏳ | Hozircha spinner yoki "Yuklanmoqda…" |
| Rus tili / kirill | ⏳ | Barcha matnlarni i18n'ga ko'chirish katta ish, alohida bosqich sifatida |

## 4. Infratuzilma

| Kamchilik | Holat | Izoh |
|---|---|---|
| Ikki xil `.env` (token va kalitlar backend'ga yetib bormagan) | ✅ | `config.py` avval loyiha ildizidagi `.env` ni, keyin `backend/.env` ni o'qiydi (ikkinchisi ustun) |
| Backend o'chsa o'zi yonmaydi | ✅ | `scripts/start-local.ps1`: Docker → migratsiya → backend **qo'riqchi bilan** (sinaldi: jarayon o'ldirilganda 5 soniyada qayta yondi) → ngrok. `scripts/stop-local.ps1` |
| Zaxira nusxa yo'q | ✅ | `scripts/backup-db.ps1`: `pg_dump`, oxirgi 14 tasi saqlanadi, `backups/` gitignore'da. Sinaldi. Kunlik ishga tushirish uchun Windows Task Scheduler'ga qo'yish kerak |
| Monitoring / loglar `print()` | ✅ | Yagona `logging` (vaqt, daraja). `SENTRY_DSN` berilsa, xatolar Sentry'ga ham boradi (`pip install sentry-sdk`) |
| CI yo'q | 🟡 | `.github/workflows/ci.yml`: PostGIS + Redis bilan `pytest`, ikkala frontend build. GitHub'ga **push qilinmagani uchun hali ishga tushmagan** |
| VPS, domen, o'z OSRM | ⏳ | Server sotib olinishi kerak. Kod tayyor: `docker-compose.yml`, `osrm/`, `.env` |
| Kompyuter xotirasi (7,6 GB) | ⏳ | Dasturiy yechim yo'q. Sinov paytida Chrome va PyCharm'ni yopish kerak |

## 5. Kod sifati

| Kamchilik | Holat | Izoh |
|---|---|---|
| Eski Node.js backend qoldiqlari | ✅ | `backend/src`, `migrations/*.js`, `knexfile.js`, `package.json`, `seeds/*.js`, `shared/` o'chirildi (`git rm`, tarixda qoladi) |
| `driver-app` | 🟡 | Endi ishlatilmaydi: bot va `/driver/` Mini App'ga yo'naltirilgan. Papka hali o'chirilmagan, xohlasangiz o'chiraman |
| Testlar kam | ✅ | 5 → 15 ta. Yangilari: `tests/test_security.py`, `tests/test_taxi_flow.py`. Eski flaky test tuzatildi |
| Commit qilinmagan ish | ⏳ | Hali hech narsa commit yoki push qilinmagan. Buyruq bersangiz bajaraman |
| Ildizdagi `img.png` | ⏳ | Sizning faylingiz, tegmadim |

---

## Sinab ko'rish uchun

1. **Ishga tushirish:** `powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1` (`-Build` bilan frontend ham qayta build qilinadi).
2. **Mini App:** botga `/start` yozing.
   - Ijrochi bo'lish: transport qo'shing → pasport, guvohnoma va texpasport yuklang → admin tasdiqlaydi.
   - Shundan keyin Profil'da "Ijrochi" rejimi va "Taksi" bo'limi chiqadi.
3. **Admin panel:** `/admin/` → Telegram ID'ni kiriting → botdan kelgan 6 xonali kodni kiriting.

## Hali sinalmagan qismlar
- **Admin kodining Telegram'ga yetib borishi.** Testlar faqat noto'g'ri kod rad etilishini tekshiradi. Sizga xabar bormasin deb haqiqiy kod yubormadim.
- **Haydovchi rejimi haqiqiy Telegram'da** (socket orqali `new_order`, joylashuv yuborish). Backend oqimi testda o'tadi, telefonda esa ikki akkaunt bilan sinash kerak.
- **Payme va Click** — merchant kalitlari kerak.
