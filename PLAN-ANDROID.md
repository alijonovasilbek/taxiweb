# Chortoq Ijrochi — Android ilova (React Native): to'liq reja

> **Qarorlar (2026-11-26):**
> - Texnologiya: **React Native** (Expo, *bare/prebuild* rejimi — native kodga to'liq kirish bilan).
> - Ilova **barcha ijrochilar** uchun: taksi haydovchisi, po'puti haydovchisi, yuk tashuvchi, maxsus texnika egasi.
> - Mijozlar **Telegram Mini App**da qoladi (o'zgarmaydi).
> - APK **GitHub Actions**da yig'iladi (kompyuter xotirasi Android yig'ishga yetmaydi).
>
> **Holat (2026-11-26):** 0, 1 va 2-bosqichlar tayyor (backend testlari 29/29, ilova asosi `driver-mobile/`). Keyingisi — 3-bosqich (taksi): Firebase va Yandex MapKit kaliti kerak.

---

## 1. Maqsad va natija

Bitta "Chortoq Ijrochi" ilovasi. Unda ijrochi o'z tasdiqlangan transportiga qarab tegishli bo'limlarni ko'radi:

| Rol (tasdiqlangan transportdan) | Ilovadagi bo'lim |
|---|---|
| Taksi (yengil, miniven) | **Taksi**: onlayn bo'lish, kiruvchi buyurtma, safar |
| Po'puti (yengil, miniven, avtobus, damas) | **Qatnovlar**: qatnov ochish, bronlar, yo'lovchilar |
| Yuk (labo, gazel, isuzu, kamaz…) | **So'rovlar**: mos yuk so'rovlari, taklif berish, ishlarim |
| Texnika (ekskavator, kran, traktor…) | **So'rovlar**: texnika so'rovlari, taklif, ishlarim |

**Ilova Mini App'dan nimasi bilan ustun:**
- **Fondagi GPS:** ekran o'chganda ham joylashuv yuboriladi.
- **Buyurtma qo'ng'irog'i:** ilova yopiq bo'lsa ham buyurtma to'liq ekranli "qo'ng'iroq" bo'lib keladi.
- **Native imkoniyatlar:** navigator, kamera va doimiy kirish.

---

## 2. Texnologiya to'plami

| Qism | Tanlov | Sabab |
|---|---|---|
| Asos | **React Native 0.7x + Expo SDK (prebuild)** | Expo modullari (joylashuv, kamera, xavfsiz saqlash) tayyor, native kod ham ochiq |
| Til | **TypeScript** | Katta ilovada xatolarni kamaytiradi |
| Navigatsiya | React Navigation (stack + bottom tabs) | Standart |
| Server holati | **TanStack Query** | Kesh, qayta urinish, oflayn holat |
| Lokal holat | Zustand | Mini App'dagi bilan bir xil yondashuv |
| Real vaqt | socket.io-client | Backend bilan bir xil protokol |
| Xarita | **react-native-yamap (Yandex MapKit)**; zaxira: react-native-maps | O'zbekistonda Yandex xaritasi aniqroq; Yandex MapKit bepul kalit bilan ishlaydi |
| Fon GPS | expo-location + expo-task-manager (foreground service) | Android 10+ fon ruxsatlari bilan to'g'ri ishlaydi |
| Push | **Firebase Cloud Messaging** (@react-native-firebase/messaging) | Yopiq ilovaga ham yetadi |
| To'liq ekranli qo'ng'iroq | **Notifee** (full-screen intent, ongoing notification) | "Yangi buyurtma" ekrani qulflangan telefonda ham chiqadi |
| Xavfsiz saqlash | expo-secure-store (Android Keystore) | Tokenlar shifrlangan holda saqlanadi |
| Kamera / rasm | expo-image-picker + expo-image-manipulator (siqish) | Hujjat va transport rasmlari |
| Xatolar | Sentry (React Native) | Haqiqiy qurilmadagi xatolarni ko'rish |
| Dizayn | Mini App bilan bir xil: bordo brend, Manrope shrifti, kunduzgi/tungi rejim | Yagona uslub |

---

## 3. Arxitektura

```
Mijoz ───► Telegram Mini App (React) ──────┐
                                            ├──► FastAPI + Socket.IO ──► PostgreSQL / Redis
Ijrochi ─► "Chortoq Ijrochi" (React Native) ┘        │
              ├─ Fon GPS servisi ──REST──────────────┤
              └─ FCM push ◄──── Firebase ◄───────────┘
```

- **Akkaunt bitta:** o'sha `users.telegram_id`. Rollar, transportlar, reyting va tarix Mini App bilan umumiy.
- **Kod joylashuvi:** monorepo ichida yangi papka `driver-mobile/`. Eski `driver-app/` (veb) o'chiriladi.
- **Umumiy qism:** API turlari va konstantalar (servislar, statuslar, kategoriyalar) `shared/` paketida. Uni Mini App ham, ilova ham ishlatadi.

---

## 4. Kirish (Telegram'siz ilovada)

**Asosiy usul — "Telegram orqali kirish" (bir bosishda):**
1. Ilova `POST /auth/app/start` → bir martalik `code` (2 daqiqa) oladi.
2. Ilova `t.me/chortoqgotaxibot?start=login_<code>` havolasini ochadi.
3. Foydalanuvchi botda "Start"ni bosadi. Bot `code` ni uning `telegram_id` siga bog'laydi va "Ilovaga qayting ✅" deb yozadi.
4. Ilova `GET /auth/app/poll?code=` ni so'rab turadi → **access token (1 soat) + refresh token (60 kun)**.

**Zaxira — SMS kod:** Telegram'i yo'q haydovchilar uchun, keyingi bosqichda. Eskiz.uz yoki Playmobile orqali.

**Sessiyalar:**
- Har bir qurilmaning refresh tokeni alohida saqlanadi.
- "Chiqish" va "barcha qurilmalardan chiqish" bo'ladi.
- Admin ijrochini bloklasa, uning sessiyalari bekor qilinadi.

---

## 5. Backend ishlari

| # | Ish | Tafsilot |
|---|---|---|
| **B0** | **Xavfsizlik (2-tahlil 🔴) — shart** | Fayl yuklash XSS, yopiq hujjatlar, socket `admin:join`, begona buyurtmani o'qish, baholar, atomar qabul qilish, bitta faol buyurtma, osilib qolgan buyurtmalar. ✅ |
| B1 | `app_login_codes` jadvali; `/auth/app/start`, `/auth/app/poll`; bot `/start login_*` | Telegram orqali kirish |
| B2 | `app_sessions`: refresh token (xeshlangan), qurilma, muddat, bekor qilish; `/auth/app/refresh`, `/auth/app/logout` | Uzoq va xavfsiz sessiya |
| B3 | `devices`: `fcm_token`, model, Android versiyasi, ilova versiyasi; `PUT /devices/me` | Push manzili |
| B4 | **Push xizmati** (FCM HTTP v1, service account). `notify()` → socket + bot + **push** | `new_order` — yuqori ustuvorlik, data-only; boshqalar oddiy |
| B5 | `POST /drivers/me/locations` (paket, 1–20 nuqta, vaqt tamg'asi bilan) | Fondagi GPS; idempotent |
| B6 | Heartbeat (✅ yozilgan): 90 soniya jimlik → oflayn | Telefoni o'chgan haydovchiga buyurtma ketmaydi |
| B7 | Buyurtmani **ketma-ket** taklif qilish: yaqin haydovchiga 15 soniya, keyin keyingisiga | Hozir hammaga birdan ketadi, ilovada "qo'ng'iroq" hammani bezovta qiladi |
| B8 | `GET /app/version` → `min_version`, `latest`, `apk_url`, o'zgarishlar | Majburiy yangilanish |
| B9 | Ijrochi uchun agregatsiya: `GET /provider/home` (rollar, onlayn holat, bugungi daromad, faol ish, yangi so'rovlar soni) | Bosh ekranni bitta so'rov bilan yuklash |
| B10 | Testlar: kirish, refresh, push (FCM mock), joylashuv paketi, ketma-ket taklif | |

---

## 6. Ilova ekranlari

**Umumiy:**
1. **Splash → Kirish** (Telegram) → **ruxsatlar ustasi:**
   - joylashuv: avval "ilova ishlaganda", keyin "har doim";
   - bildirishnomalar;
   - batareya optimizatsiyasidan chiqarish;
   - brendga mos qo'llanma (§8).
2. **Bosh sahifa:** salomlashish, onlayn/oflayn tugmasi (taksi uchun), bugungi daromad, faol ish kartasi va "Yangi so'rovlar: N".
3. **Pastki menyu** (rolga qarab dinamik): Bosh · Taksi / Qatnovlar / So'rovlar · Transport · Profil.

**Taksi:**
4. **Kiruvchi buyurtma:** to'liq ekran, qo'ng'iroq ovozi va vibratsiya, 15 soniyalik aylana taymer. Ekranda qayerdan → qayerga, masofa, narx va yo'lovchi reytingi. Tugmalar: "Qabul qilish" / "Rad etish".
5. **Faol safar:** xaritada marshrut. Bosqichlar: "Yetib keldim" → "Boshlash" → "Yakunlash". Yo'lovchiga qo'ng'iroq, **navigatorni ochish** (Yandex Navigator, bo'lmasa Yandex Maps, bo'lmasa Google Maps), bekor qilish (sabab bilan).
6. **Safar yakuni:** summa, to'lov turi, yo'lovchini baholash.

**Po'puti:**
7. Qatnovlarim (yaqinda / o'tgan), **qatnov ochish** (marshrut, vaqt, o'rinlar, narx, takrorlanish).
8. Bron so'rovlari: tasdiqlash / rad etish, yo'lovchilar ro'yxati va qo'ng'iroq.

**Yuk va texnika:**
9. **So'rovlar lentasi:** moslik foizi, masofa, byudjet, filtrlar.
10. So'rov tafsiloti → **taklif berish** (narx, transport, vaqt, izoh), taklifni qaytarib olish.
11. **Ishlarim:** bosqichlar, mijozga qo'ng'iroq, navigator, yakunlash.

**Transport va profil:**
12. Transportlarim → qo'shish / tahrirlash → **hujjatlar** (kamera; pasport, guvohnoma va texpasport — yetishmayotgani ko'rsatiladi), tasdiqlash holati.
13. Ish jadvali, bildirishnomalar, reyting va sharhlar, sozlamalar (til, mavzu, ovoz), yordam, chiqish.

---

## 7. Fondagi GPS va push — texnik tafsilot

- **Foreground service** faqat **onlayn** paytida ishlaydi. Doimiy bildirishnomada "Chortoq Ijrochi: onlaynsiz" yozuvi va "Oflayn bo'lish" tugmasi bo'ladi.
- **Chastota:** harakatlanayotganda 10 soniya / 30 metr, to'xtab turganda 60 soniya. Paket qilib yuboriladi (B5).
- **Internet yo'q bo'lsa:** nuqtalar qurilmada navbatga yoziladi (oxirgi 500 tasi) va internet qaytganda yuboriladi.
- **Kiruvchi buyurtma:**
  - FCM data-push → Notifee full-screen intent → buyurtma ekrani qulflangan telefonda ham ochiladi.
  - Qabul qilish va rad etish ilova ochilmasdan, bildirishnomaning o'zidan ham mumkin.
- **Takroriy himoya:** buyurtma ID'si bo'yicha, socket va push bir vaqtda kelsa, ekran bitta ochiladi.

---

## 8. Android xavflari va yechimlar

| Xavf | Yechim |
|---|---|
| **Xiaomi/Redmi/POCO, Realme/OPPO, Huawei, Samsung** fondagi ilovani o'ldiradi | Brendni aniqlab, aynan o'sha sozlama sahifasini ochuvchi qo'llanma: "Avtozapusk", "Batareya → Cheklovsiz", "Ilovani qulflash". Ilova ichida "Sozlamalar to'g'rimi?" tekshiruvi |
| Android 13+ bildirishnoma ruxsati, Android 14 full-screen intent ruxsati | Ruxsatlar ustasida alohida qadam, rad etilsa tushuntirish |
| Batareya sarfi | GPS faqat onlayn paytida, chastota harakatga qarab, paket qilib yuboriladi |
| Arzon telefonlar (Android 8, 2–3 GB RAM) | `minSdk 26`, Hermes, rasmlar siqiladi, xarita yengil rejimda |
| Play Store fondagi joylashuv siyosati | Avval **APK** to'g'ridan-to'g'ri tarqatiladi; Play uchun video-tushuntirish va siyosat keyin |

---

## 9. GitHub'da yig'ish va tarqatish

**CI (`.github/workflows/android.yml`):**
- **Har bir PR:** `tsc` + eslint + jest → **debug APK** (artefakt sifatida yuklab olinadi).
- **`v*` teg:** imzolangan **release APK** (+ AAB, Play uchun keyin) → GitHub Release'ga avtomatik yuklanadi.
- Ubuntu runner, JDK 17, Gradle keshi, `expo prebuild`, `./gradlew assembleRelease`.

**GitHub Secrets'ga qo'yiladi:**
- `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`;
- `GOOGLE_SERVICES_JSON` (Firebase);
- `YANDEX_MAPKIT_KEY`;
- `SENTRY_DSN`.

**Imzolash kaliti** (keystore) bir marta yaratiladi va **ikki joyda zaxiralanadi**. Yo'qolsa, yangilanishni chiqarib bo'lmaydi.

**Tarqatish:**
1. Bot `/app` buyrug'iga GitHub Release'dagi oxirgi APK havolasini beradi. Admin panelda ham havola turadi.
2. Ilova ochilganda `/app/version` ni tekshiradi. Yangi versiya bo'lsa taklif qiladi, `min_version` dan eski bo'lsa majburan yangilatadi.
3. Keyinroq **Google Play** (25 $ bir martalik), shunda avtomatik yangilanish ishlaydi.

**Versiyalash:** `1.0.0` (semver). Android `versionCode` teg asosida avtomatik oshadi.

---

## 10. Bosqichlar va muddat

| # | Bosqich | Ish | Muddat |
|---|---|---|---|
| 0 | **Tayyorgarlik** | B0 xavfsizlikni yakunlash va testlar; GitHub'ga push; Firebase loyihasi; Yandex MapKit kaliti; keystore; paket nomi `uz.chortoq.ijrochi` | 2–3 kun |
| 1 | **Backend** | B1–B5, B7–B10 + testlar | 1 hafta |
| 2 | **Ilova asosi** | Loyiha (Expo prebuild + TS), dizayn tizimi (kunduzgi/tungi), navigatsiya, kirish, ruxsatlar ustasi, API/socket qatlami, CI (debug APK) | 1 hafta |
| 3 | **Taksi** | Onlayn, fon GPS, push + to'liq ekranli buyurtma, safar bosqichlari, navigator, yakun va baho | 1,5 hafta |
| 4 | **Po'puti, yuk, texnika** | Qatnovlar va bronlar, so'rovlar lentasi, takliflar, ishlarim | 1 hafta |
| 5 | **Transport va profil** | Transport/hujjat (kamera), jadval, bildirishnomalar, sozlamalar | 3–4 kun |
| 6 | **Sifat** | Brend qo'llanmasi, oflayn navbat, Sentry, 3–4 real telefonda sinov (Xiaomi, Samsung, Realme), batareya o'lchovi | 1 hafta |
| 7 | **Reliz** | Imzolangan APK, bot orqali tarqatish, 5–10 haydovchi bilan yopiq sinov, tuzatishlar, `v1.0.0` | 3–5 kun |

**Jami: taxminan 6–7 hafta.** Taksi bilan ishlaydigan birinchi APK 4-hafta oxirida chiqadi.

---

## 11. Mini App'dagi "Ijrochi rejimi"

- **Reliz bo'lgandan keyin:** Mini App'dagi ijrochi bo'limlari ishlab turadi, lekin yuqorida "📱 Chortoq Ijrochi ilovasini yuklab oling" banneri chiqadi.
- **1–2 oydan keyin:** Mini App'dagi "Taksi" bo'limi faqat ilovaga yo'naltiradi, chunki fon GPS'siz taksi ishonchsiz. Yuk, texnika va po'puti Mini App'da qolishi mumkin.

---

## 12. Hozirgi holat

**0-bosqich — B0 xavfsizlik: ✅** (fayl turi mazmundan, yopiq hujjatlar va imzoli havolalar, socket `admin:join`,
begona buyurtma, baholar, atomar qabul qilish, bitta faol buyurtma, fon xizmati, xavfsizlik sarlavhalari).

**1-bosqich — backend: ✅** (migratsiya `011`, testlar `tests/test_mobile.py`)

| # | Qayerda | Eslatma |
|---|---|---|
| B1 | `routers/app_auth.py`, `services/app_login_bot.py`, bot `/start login_*` | Poll — `POST /auth/app/poll {code, device_id}`: kod faqat o'sha qurilmaga beriladi. Botda "✅ Ha, kirish" tasdig'i va fishing ogohlantirishi |
| B2 | `services/app_auth.py` | Access 1 soat (`sid` bilan), refresh 60 kun, har ishlatilganda aylanadi; eski refresh qayta kelsa sessiya yopiladi. Chiqish va admin bloklashi access tokenni ham darhol bekor qiladi (Redis), socket ham |
| B3 | `PUT /devices/me` | FCM token boshqa akkauntda qolgan bo'lsa ko'chiriladi |
| B4 | `services/push.py` | FCM HTTP v1; `FCM_SERVICE_ACCOUNT` bo'lmasa o'chiq. `notify()` endi push ham yuboradi; `new_order` — data-only, HIGH |
| B5 | `POST /drivers/me/locations` | 1–20 nuqta; takror, kelajakdagi va aniqligi past nuqtalar tashlanadi. Socket bilan umumiy `services/driver_location.py` |
| B6 | `services/maintenance.py` | Ochiq qolgan takliflarni ham yopadi |
| B7 | `services/order_service.py` | Eng yaqin 6 haydovchiga navbat bilan, har biriga 15 soniya; rad etsa darhol keyingisiga. Faqat taklif qilingan haydovchi qabul qila oladi (`order_offers`) |
| B8 | `GET /app/version?current=` | `APP_MIN_VERSION`, `APP_LATEST_VERSION`, `APP_APK_URL` (.env) |
| B9 | `GET /provider/home` | Bo'limlar (taxi/carpool/requests), faol ish, bugungi daromad, yangi so'rovlar, o'qilmagan bildirishnomalar |
| B10 | `tests/test_mobile.py` (8 test) | Hammasi: 29/29 |

**2-bosqich — ilova asosi: ✅** (`driver-mobile/`, branch `android-app`)

- Expo SDK 58 (RN 0.88) + TypeScript + Expo Router; paket `uz.chortoq.ijrochi`; ikonka va splash (bordo, oq «C»)
- Telegram orqali kirish, tokenlarni xavfsiz saqlash (Keystore), 401 da avtomatik refresh, chiqish / barcha qurilmalardan chiqish
- Ruxsatlar ustasi: joylashuv, fonda joylashuv, bildirishnoma kanallari, batareya; Xiaomi/Realme/Huawei/Samsung maslahatlari
- Dinamik pastki menyu (`/provider/home` → bo'limlar), bosh sahifa, transportlar va hujjat holati, profil, kunduzgi/tungi mavzu
- Majburiy yangilanish ekrani (`/app/version`), Socket.IO bilan real vaqt yangilanishi
- `.github/workflows/android.yml`: typecheck + lint + debug APK; `v*` tegda imzolangan release APK → GitHub Release
- Tekshirildi: `tsc`, `expo lint`, `expo-doctor` 20/20, Android JS bundle (Hermes) yig'iladi.
  **Native APK hali yig'ilmagan** — GitHub'ga push qilingach Actions'da birinchi marta yig'iladi.
- Taksi/Qatnovlar/So'rovlar bo'limlarida hozircha holat ko'rinadi; asosiy amallar 3–4-bosqichda.


---

## 13. Sizdan kerak bo'ladi (boshlashdan oldin)

1. **GitHub:** repozitoriyaga push qilishga ruxsat (`origin` = `github.com/alijonovasilbek/taxiweb`), maxfiy kalitlarni Secrets'ga qo'yish.
2. **Firebase** loyihasi (Google akkaunt, bepul): `google-services.json` va FCM service account.
3. **Yandex MapKit** mobil kaliti (developer.tech.yandex.ru → "MapKit Mobile SDK", bepul).
4. **Ilova nomi va ikonka:** taklif "Chortoq Ijrochi", bordo fonda oq "C". Boshqa variant bo'lsa ayting.
5. **Sinov telefonlari:** 2–3 ta Android, bittasi Xiaomi/Redmi.
6. **Commit:** hozirgi ≈220 ta o'zgarishni commit qilishga ruxsat (ilova ishini toza tarix ustida boshlash uchun).
