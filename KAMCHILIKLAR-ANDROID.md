# Chortoq Ijrochi (Android) — kamchiliklar tahlili

> **Sana:** 2026-11-26 · **Branch:** `android-app` (`0128466`) · **Qamrov:** `driver-mobile/`, ilova uchun backend (B1–B10), CI
>
> **Qanday tekshirildi:** kod qayta o'qildi; `tsc`, `expo lint`, `expo-doctor` (20/20) va Android JS bundle — toza;
> backend testlari 29/29. Shubhali joylar jonli tizimda sinab ko'rildi (masalan, Redis'dagi rate-limit kalitlari).
> **Tekshirilmagan:** ilova hali **birorta ham haqiqiy telefonda ishga tushirilmagan** — birinchi APK GitHub Actions'da
> yig'ilmoqda. Shuning uchun native qismlar (ruxsat oynalari, splash, shrift, ikonka) haqidagi xulosalar — taxmin.

**Belgilar:** 🔴 haydovchilarga berishdan oldin tuzatish shart · 🟠 muhim · 🟡 kichik / keyinroq

---

## Qisqa xulosa

Ilova hozir **ko'rish rejimida**: kirish, ruxsatlar, bosh sahifa, transportlar va profil ishlaydi, lekin ijrochi
**asosiy ishini qila olmaydi** — onlayn bo'lish, buyurtma qabul qilish, taklif berish, transport qo'shish yo'q
(rejadagi 3–5-bosqichlar). Bundan tashqari, rejada bo'lmagan, lekin tuzatilishi shart bo'lgan **6 ta kritik muammo** topildi.
Ulardan eng shoshilinchi — hozir yig'ilayotgan **debug APK telefonda alohida ishlamaydi** (1-band).

| | Soni |
|---|---|
| 🔴 Kritik | 6 |
| 🟠 Muhim | 14 |
| 🟡 Kichik | 13 |

---

## 🔴 Kritik

### 1. Debug APK ichida ilova kodi yo'q — telefonda qizil xato ekrani chiqadi
- **Qayerda:** `.github/workflows/android.yml` → `./gradlew assembleDebug`
- **Muammo:** React Native'da debug varianti JS kodini APK'ga joylamaydi — uni kompyuterdagi Metro serveridan
  (`localhost:8081`) yuklaydi. Haydovchining telefonida Metro yo'q → "Unable to load script" xatosi.
  Hozir yig'ilayotgan APK ham shunday bo'ladi.
- **Yechim:** PR/push uchun ham `assembleRelease` (prebuild shabloni release'ni debug kalit bilan imzolaydi — sinov
  uchun o'rnatsa bo'ladi), tegda esa haqiqiy kalit bilan qayta imzolash. Bitta qatorlik o'zgarish.

### 2. Rate limit barcha foydalanuvchilarni bitta IP deb sanaydi — butun platforma bloklanadi
- **Qayerda:** `gateway/nginx.local.conf:39` (`X-Real-IP $remote_addr`), `backend/app/security.py` → `client_ip()`
- **Isbot:** ngrok orqali kelgan so'rovdan keyin Redis'da kalit: `rl:app-start:172.17.0.1:anon:…` — bu Docker shlyuzi,
  foydalanuvchi IP'si emas. ngrok kompyuterning o'zida ishlagani uchun nginx hammani `172.17.0.1` deb ko'radi.
- **Oqibat:** limitlar **hamma uchun bitta**: ilovaga kirish — butun platformaga 10 marta / 10 daqiqa, Mini App
  kirishi (`verify-telegram`) — 30 / daqiqa. 30 ta haydovchi bir vaqtda kirsa, qolganlari 429 oladi.
  Bu Mini App'ga ham tegishli (avvalgi xavfsizlik ishlaridan qolgan xato).
- **Yechim:** nginx'da `real_ip_header X-Forwarded-For` + `set_real_ip_from` (faqat ngrok/ishonchli proksi uchun),
  `client_ip()` faqat ishonchli proksidan kelgan sarlavhaga ishonsin. Mobil operatorlarning CGNAT'i (ko'p abonent —
  bitta IP) uchun kirish limitlarini qurilma ID'si bo'yicha ham hisoblash.

### 3. Internet uzilsa haydovchi tizimdan "chiqarib yuboriladi"
- **Qayerda:** `backend/app/services/app_auth.py` → `rotate()`
- **Muammo:** refresh token har ishlatilganda almashadi; eski token qayta kelsa — "o'g'irlangan" deb sessiya yopiladi.
  Lekin telefon so'rovni yuborib, javobni ololmasa (tunnel, lift, zaif signal — taksida tez-tez) server tokenni
  almashtirib bo'lgan, ilova esa eskisini saqlab qolgan. Keyingi urinish → o'g'irlik deb topiladi → **chiqib ketadi**.
  Ilova o'chirilib qolganda ham (javob kelgan, lekin xotiraga yozilmagan) shunday.
- **Yechim:** almashtirishdan keyin 1–2 daqiqa davomida eski tokenni "o'g'irlik" emas, takror so'rov deb qabul qilish
  (o'sha yangi juftlikni qayta berish yoki yangisini chiqarish). Shundan keyingina o'g'irlik deb hisoblash.

### 4. Ijrochi asosiy ishini ilovada qila olmaydi
- **Taksi:** onlayn bo'lish, fondagi GPS, kiruvchi buyurtma ekrani, safar bosqichlari yo'q. "Faol buyurtma" kartasi
  Taksi bo'limiga olib boradi — u yerda buyurtma ko'rinmaydi (boshi berk ko'cha).
- **Po'puti / yuk / texnika:** qatnov ochish, bronlarni tasdiqlash, taklif berish yo'q.
- **Transport:** qo'shish va hujjat yuklash yo'q — Mini App'ga yuboriladi.
- **Push:** Firebase ulanmagan, push tokeni olinmaydi, ilova yopiq bo'lsa hech narsa kelmaydi.
- **Bu rejadagi 3–5-bosqichlar.** Lekin hozirgi APK'ni haydovchilarga "ishchi ilova" deb berib bo'lmaydi.

### 5. Server — dasturchining kompyuteri (ngrok), manzil APK ichiga "qotirilgan"
- `API_URL` yig'ish vaqtida APK'ga yoziladi. Kompyuter o'chsa yoki uxlasa — ilova ishlamaydi; ngrok manzili
  o'zgarsa — **har bir haydovchiga yangi APK** o'rnatish kerak.
- Kompyuterda 7,6 GB RAM, avval ham xotira tugab servislar o'chib qolgan.
- **Yechim:** haydovchilarga berishdan oldin doimiy server (VPS) va domen (`api.chortoq.uz` kabi). Zaxira sifatida —
  ilovada server manzilini masofadan o'zgartirish imkoniyati.

### 6. Ilova orqali kirgan ijrochida telefon raqami yo'q
- **Qayerda:** `backend/app/services/app_login_bot.py` (foydalanuvchini telefonsiz yaratadi), ilovada raqam
  tasdiqlash yo'q.
- **Oqibat:** Mini App'ni hech ochmagan haydovchining `users.phone` bo'sh → taksi `drivers.phone` ham bo'sh →
  yo'lovchi haydovchiga qo'ng'iroq qila olmaydi. Onboarding (`onboarded_at`, `phone_verified`) ham o'tmaydi.
- **Yechim:** botdagi tasdiqlash qadamiga "📱 Raqamni ulashish" (`request_contact`) qo'shish — telefon Telegram
  tomonidan tasdiqlangan holda keladi; ilova raqamsiz akkauntga ijrochi bo'limlarini ochmasin.

---

## 🟠 Muhim

### 7. Chiqishda boshqa foydalanuvchining ma'lumoti qoladi
`logout()` tokenlarni o'chiradi, lekin react-query keshi (`src/app/_layout.tsx` → `queryClient`) tozalanmaydi.
Bitta telefonda boshqa odam kirsa, bir lahza oldingi egasining daromadi, transportlari, qurilmalari ko'rinadi.
**Yechim:** chiqishda `queryClient.clear()`.

### 8. `PUT /devices/me` push tokenni o'chirib yuboradi
`backend/app/routers/mobile.py`: `ON CONFLICT … fcm_token=EXCLUDED.fcm_token`. Ilova tokensiz chaqirsa (hozir har
kirishda shunday), saqlangan FCM token `NULL` bo'ladi. 3-bosqichda push "sababsiz" kelmay qoladi.
**Yechim:** `fcm_token=COALESCE(EXCLUDED.fcm_token, devices.fcm_token)`; tokenni o'chirish — alohida aniq so'rov bilan.

### 9. Qurilma faqat kirishda ro'yxatga olinadi
`registerDevice()` faqat `completeLogin`da. Ilova yangilansa, `app_version` eski qoladi; FCM token yangilansa
(Google uni vaqti-vaqti bilan almashtiradi) server bilmaydi. **Yechim:** har ochilishda va token o'zgarganda.

### 10. "Barcha qurilmalardan chiqish" ochiq socket'larni uzmaydi
Sessiya bekor qilinsa, REST darhol 401 beradi, lekin ulanib turgan Socket.IO davom etadi va hodisalarni
(jumladan yangi buyurtmalarni) olishda davom etadi — uzilguncha. **Yechim:** sessiya yopilganda backend shu `sid`
socket'larini majburan uzsin (`sio.disconnect`).

### 11. Muddati o'tgan token bilan socket cheksiz qayta ulanadi
Ilova ochilganda saqlangan access token eskirgan bo'lishi mumkin. Server ulanishni rad etadi, `socket.io-client`
o'sha token bilan qayta-qayta urinadi; `connect_error` ushlanmaydi. Hozir tasodifan ishlaydi (bosh sahifa so'rovi
refresh qiladi), lekin bunga tayanib bo'lmaydi. **Yechim:** `connect_error` → refresh → qayta ulanish.

### 12. Majburiy yangilanish ekrani ishlamaydigan buyruqqa yuboradi
`VersionGate` `APK_URL` bo'sh bo'lsa "botdan oling: /app" deydi — botda **`/app` buyrug'i yo'q**. APK'ni yuklab olish ham
brauzer orqali, "noma'lum manbalardan o'rnatish" ruxsati bo'yicha hech qanday ko'rsatma yo'q.
**Yechim:** botga `/app` (oxirgi GitHub Release havolasi), `APP_APK_URL` ni avtomatik to'ldirish, ilovada yuklab olib
o'rnatish oynasi yoki aniq qo'llanma.

### 13. Internet bo'lmasa menyu bo'limlari yo'qoladi
Pastki menyu `/provider/home` → `sections` ga bog'liq. Yuklanayotganda yoki oflayn bo'lsa hammasi yashiriladi va
keyin "sakrab" paydo bo'ladi. Kesh diskda saqlanmaydi. **Yechim:** oxirgi javobni saqlash
(react-query persist yoki SecureStore/MMKV), "Internet yo'q" ko'rsatkichi.

### 14. Ruxsatlar ustasi hamma rol uchun bir xil
- Yuk va texnika egasiga ham **"har doim" joylashuv** so'raladi — unga kerak emas, Google Play siyosatiga zid
  (`ACCESS_BACKGROUND_LOCATION` asossiz).
- "Keyinroq" ruxsat berilmagan bo'lsa ham "bajarildi" deb belgilaydi — keyin hech qachon eslatilmaydi.
- Batareya bandi faqat "ochildi" deb belgilanadi, haqiqiy holat tekshirilmaydi; to'g'ridan-to'g'ri
  `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` oynasi ishlatilmaydi (ruxsat e'lon qilingan, lekin foydalanilmaydi).
- Xiaomi/Realme "Avtozapusk" sahifasini to'g'ridan-to'g'ri ochish yo'q — faqat matn.
**Yechim:** bo'limlarga qarab qadamlar; onlayn bo'lishdan oldin ruxsatlarni qayta tekshirish; batareya holatini
o'qiydigan kichik native modul (config plugin).

### 15. Android 14 uchun kerakli e'lonlar yo'q
`USE_FULL_SCREEN_INTENT` ruxsati, bildirishnoma ishlovchisi (`setNotificationHandler`) va Notifee yo'q — 3-bosqichdagi
"qo'ng'iroq" ekrani shusiz qulflangan telefonda chiqmaydi.

### 16. Release imzo kaliti yaratilmagan
`v*` teg qo'yilsa, workflow `ANDROID_KEYSTORE_BASE64` yo'qligi sababli yiqiladi. Kalit bir marta yaratilib, ikki joyda
saqlanishi kerak (`driver-mobile/README.md`).

### 17. `versionCode` = GitHub run raqami
Muvaffaqiyatsiz yig'ishni qayta ishga tushirsa raqam o'zgarmaydi; boshqa workflow'lar ham raqamni "yeydi".
Ishlaydi, lekin oldindan aytib bo'lmaydi. **Yechim:** tegdan hisoblash (`1.2.3` → `10203`).

### 18. Faqat Telegram orqali kirish
Telegram'i yo'q yoki boshqa raqamdagi Telegram'dan foydalanadigan haydovchi kira olmaydi. Rejada SMS (Eskiz/Playmobile)
zaxira sifatida bor, lekin qilinmagan.

### 19. Kirish kodi 2 daqiqa
Telegram'ni birinchi marta ochish, "Start" va "✅ Ha, kirish" bosish — sekin internetda 2 daqiqaga sig'masligi mumkin.
**Yechim:** 5 daqiqa (kod baribir bir martalik va qurilmaga bog'langan).

### 20. Botdan ilovaga qaytish tugmasi yo'q
Telegram inline tugmalari faqat `http(s)`/`tg` havolalarini qabul qiladi, `chortoqijrochi://` emas. Foydalanuvchi
ilovaga o'zi qaytishi kerak. **Yechim:** backend'da `https://…/app/open` sahifasi → Android intent orqali ilovani ochadi.

---

## 🟡 Kichik

21. **Fon vazifalari "yo'qolishi" mumkin** — `push.fire()` va `_dispatch` `asyncio.create_task()` natijasini saqlamaydi;
    Python bunday vazifani xotiradan tozalab yuborishi mumkin. Vazifalarni to'plamda saqlash kerak.
22. **Taklif signallari jarayon xotirasida** (`_offer_events`) — backend bir nechta worker bilan ishga tushirilsa,
    "rad etdi → keyingisiga" signali boshqa worker'ga yetmaydi. Hozir bitta jarayon — ishlaydi; masshtabda Redis pub/sub.
23. **`/provider/home` og'ir** — har chaqiruvda butun so'rovlar lentasini hisoblaydi; har 60 soniyada va har socket
    hodisasida chaqiriladi. Ko'p haydovchida bazaga yuk. `new_requests`ni keshlash yoki sanash so'rovi.
24. **Redis o'chsa** bekor qilingan sessiyaning access tokeni 1 soatgacha ishlayveradi (tekshiruv Redis'ga tayanadi).
25. **Tozalanmaydigan jadvallar** — `app_sessions` (yopilganlari), `app_login_codes` (faqat `start`da qisman).
26. **Qo'llab-quvvatlash manzili** `@taxigo_support` — eski brend nomi, mavjudligi tekshirilmagan (ilova va bot).
27. **Faqat o'zbek (lotin)** — rus tili va kirill yo'q; ko'p haydovchilar ruscha interfeysga o'rgangan.
28. **Xatolar kuzatilmaydi** — Sentry yo'q; haqiqiy telefondagi qulashlarni ko'rib bo'lmaydi.
29. **Ilova testlari yo'q** — jest/komponent testlari va E2E yo'q; CI faqat `tsc` + lint.
30. **Tungi rejimda oq "chaqnash" bo'lishi mumkin** — `expo-system-ui` fon rangi o'rnatilmagan (telefonda tekshirish kerak).
31. **Android ID imzo kalitiga bog'liq** — debug va release APK'lar turli qurilma deb ko'rinadi (sinovda ikki sessiya).
32. **"Mini App'ni ochish" tugmasi botni ochadi**, Mini App'ning o'zini emas (`t.me/<bot>/<app>` havolasi kerak).
33. **Eski `driver-app/` (veb) papkasi** hali repoda — rejaga ko'ra o'chirilishi kerak.

---

## Tavsiya etilgan tartib

| Navbat | Nima | Taxminiy vaqt |
|---|---|---|
| 1 | **#1** release-variantda yig'ish (hozirgi APK ishlashi uchun) | 10 daqiqa |
| 2 | **#2** haqiqiy IP (nginx + `client_ip`), **#3** refresh uchun muhlat, **#7** keshni tozalash, **#8** FCM tokenni saqlash | 2–3 soat |
| 3 | **#6** botda raqam ulashish, **#10–#11** socket sessiyasi | yarim kun |
| 4 | **#12** `/app` buyrug'i va yangilanish oqimi, **#16** imzo kaliti, **#19** kod muddati | yarim kun |
| 5 | **3-bosqich (taksi)** — #4, #13, #14, #15 shu bosqich ichida | ~1,5 hafta |
| 6 | **#5** doimiy server — haydovchilarga keng tarqatishdan oldin | alohida |
| 7 | 🟡 bandlar — 6-bosqich (sifat) bilan birga | — |

---

## Tuzatish holati (2026-11-26, kechki sessiya)

| # | Holat | Izoh |
|---|---|---|
| 1 | ✅ | CI har doim `assembleRelease` (JS ichida); sinov APK `android-dev` pre-release'da; faqat ARM ABI |
| 2 | ✅ | nginx `realip` (ngrok `X-Forwarded-For`); jonli tekshirildi: Redis kalitida haqiqiy IP |
| 3 | ✅ | 2 daqiqalik takroriy so'rov muhlati; test bilan |
| 4 | 🟡 qisman | Taksi (onlayn, fon GPS, buyurtma oynasi, safar, baho), qatnovlar, so'rovlar va takliflar, transport + hujjatlar — **ilovada bor**. Push (ilova yopiq bo'lsa) — Firebase kaliti kerak |
| 5 | ⏳ | Doimiy server (VPS, domen) — sizning qaroringiz |
| 6 | ✅ | Botda raqam ulashish, raqam taksi yozuviga ham; onlayn bo'lish tasdiqlangan raqamsiz rad etiladi; ilovada eslatma |
| 7 | ✅ | Chiqishda `queryClient.clear()` |
| 8 | ✅ | Tokensiz `/devices/me` tokenni o'chirmaydi; test bilan |
| 9 | ✅ | Har ochilishda `registerDevice()` |
| 10 | ✅ | Sessiya yopilsa socket'lar uziladi (`session:{sid}` xonasi), ilova `session_revoked` ni ushlaydi |
| 11 | ✅ | `connect_error` → refresh → qayta ulanish |
| 12 | ✅ | Botda `/app`, `APP_DOWNLOAD_URL`, yangilanish banneri va o'rnatish ko'rsatmasi |
| 13 | ✅ | Bo'limlar diskda keshlanadi; "Internet yo'q" banneri |
| 14 | ✅ | "Har doim" (fon) ruxsati butunlay olib tashlandi — foreground service bilan kerak emas (expo-location manbasi tekshirildi); batareya uchun to'g'ridan-to'g'ri tizim oynasi; ruxsat yetishmasa bosh sahifada eslatma |
| 15 | 🟡 | Bildirishnoma ishlovchisi, "orders" kanali, fondagi buyurtma uchun lokal bildirishnoma — bor. Qulflangan ekranda to'liq ekranli qo'ng'iroq (Notifee + FCM) — Firebase'dan keyin |
| 16 | ⏳ | Imzo kaliti — sizdan (README'da buyruq) |
| 17 | ✅ | `versionCode` tegdan: 1.2.3 → 10203 |
| 18 | ⏳ | SMS orqali kirish — SMS provayder (Eskiz/Playmobile) kerak |
| 19 | ✅ | Kod 5 daqiqa; CGNAT uchun limitlar oshirildi |
| 20 | ✅ | Botda «📱 Ilovaga qaytish» → `/api/app/open` (Android intent) |
| 21 | ✅ | `app/tasks.py` → `spawn()` |
| 22 | ⏳ | Bitta jarayonda ishlaydi; ko'p worker uchun Redis pub/sub keyin |
| 23 | ✅ | Yangi so'rovlar soni 60 s keshlanadi |
| 24 | ⏳ | Hujjatlashtirildi (Redis o'chsa 1 soatgacha) |
| 25 | ✅ | Soatda bir tozalash |
| 26 | 🟡 | `SUPPORT_USERNAME` sozlamasi qo'shildi; haqiqiy manzilni siz tasdiqlashingiz kerak |
| 27–29 | ⏳ | Rus tili, Sentry, ilova testlari — keyingi bosqich |
| 30 | ✅ | `SystemUI.setBackgroundColorAsync` |
| 31–33 | ⏳ | Kichik, keyinroq |

Tekshiruvlar: backend 31/31 test, ilova `tsc` + `expo lint` + `expo-doctor` 20/20 + Android bundle.
**Telefonda sinalmagan** — sinov APK'lari bot orqali yuborildi.
