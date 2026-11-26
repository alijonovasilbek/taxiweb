# Chortoq Services — 2-chuqur tahlil (hujum va ishonchlilik nuqtai nazaridan)

> Sana: 2026-11-25. Birinchi tahlil va uning tuzatishlari: [KAMCHILIKLAR.md](KAMCHILIKLAR.md).
> Bu safar kod "kim nimani ko'ra oladi va o'zgartira oladi" savoli bilan ko'rib chiqildi.
> **Tasdiqlangan** belgisi bor bandlar amalda tekshirilgan, qolganlari kodni o'qishdan kelib chiqqan.
> Belgilar: 🔴 kritik · 🟠 muhim · 🟡 o'rtacha · ⚪ kichik.

---

## A. 🔴 Kritik xavfsizlik

### A1. Fayl yuklash orqali XSS: Mini App tokenini o'g'irlash — **tasdiqlangan**
`backend/app/routers/vehicles.py: save_upload`
- Server faqat brauzer yuborgan `content_type` ni tekshiradi (u soxtalashtiriladi). Fayl kengaytmasi esa fayl nomidan olinadi.
- Sinov: `x.html` fayl `image/png` deb yuklandi → `/uploads/…html` manzilidan **`text/html`** bo'lib qaytdi (sinov fayli o'chirildi).
- Fayl Mini App bilan bir domenda turadi. Unga havola ochgan foydalanuvchining `localStorage` dagi tokeni o'g'irlanadi. `.svg` ham shunday xavfli.
- **Tuzatish:**
  1. Kengaytma ro'yxati: faqat `.jpg`, `.png`, `.webp`, `.pdf`.
  2. Fayl turini birinchi baytlari (magic bytes) bo'yicha tekshirish.
  3. Kengaytmani server o'zi qo'yishi.
  4. Javobga `Content-Disposition: attachment` va `X-Content-Type-Options: nosniff` sarlavhalari.

### A2. Pasport va guvohnoma skanlari hammaga ochiq — **tasdiqlangan**
`main.py:128` `app.mount("/uploads", StaticFiles(...))`
- Hujjatlar tokensiz, oddiy havola bilan ochiladi. Havola admin panelda, bildirishnomalarda va loglarda tarqaladi.
- Bu shaxsga doir ma'lumot.
- **Tuzatish:** hujjatlar alohida yopiq papkada saqlansin. Ularni faqat admin va egasi ko'ra olsin: imzolangan, 5 daqiqalik havola yoki tokenli endpoint orqali. Transport rasmlari ochiq qolishi mumkin.

### A3. Istalgan foydalanuvchi admin xonasiga kirib, haydovchilar joylashuvini kuzatadi
`app/socket_manager.py: admin:join`
- Socket hodisasi rolni tekshirmaydi. Oddiy Mini App tokeni bilan ham `admin:join` yuborish mumkin.
- Natijada barcha haydovchilarning ismi va jonli koordinatalari, admin xonasiga boradigan barcha hodisalar keladi.
- **Tuzatish:** sessiyada `role == "admin"` bo'lmasa, rad etish.

### A4. Istalgan taksi buyurtmasini o'qish (IDOR)
`app/routers/orders.py: GET /orders/{id}`
- Egasi tekshirilmaydi. ID'larni ketma-ket terib, barcha yo'lovchilarning manzillari, narxlari va vaqtlarini olish mumkin.
- **Tuzatish:** faqat yo'lovchi o'zi, shu buyurtmaning haydovchisi yoki admin ko'ra olsin.

### A5. Begona buyurtmaga baho qo'yish → reytingni buzish
`app/routers/ratings.py`
- Baho qo'yuvchi buyurtma ishtirokchisi ekani tekshirilmaydi.
- Natijada istalgan foydalanuvchi har qanday tugagan buyurtmaga 1 yulduz qo'yib, haydovchi reytingini tushira oladi (har buyurtmaga bir marta).
- **Tuzatish:** haydovchiga baho faqat shu buyurtmaning yo'lovchisi beradi, yo'lovchiga esa faqat haydovchisi.

### A6. `PUT /orders/{id}/reject` va boshqa haydovchi amallari
- `reject` istalgan foydalanuvchiga yo'lovchiga "rad etildi" hodisasini yuborishga imkon beradi.
- `arrived` va `start` da `drivers` yozuvi yo'q bo'lsa, server 500 xato beradi (`driver["id"]` None bo'ladi).
- **Tuzatish:** har bir amalda "bu shu buyurtmaning haydovchisimi" degan tekshiruv bo'lsin.

---

## B. 🟠 Ma'lumotlar yaxlitligi va poyga holatlari

### B1. Bitta buyurtmani ikki haydovchi qabul qilishi
`order_service.accept_order`: avval `SELECT … status='searching'`, keyin shartsiz `UPDATE` bajariladi.
- Ikki haydovchi bir vaqtda bossa, ikkalasi ham "qabul qildim" deb oladi.
- Ikkinchisi birinchini ustidan yozadi. Birinchi haydovchi `is_on_ride=true` holatida qotib qoladi.
- **Tuzatish:** bitta atomar so'rov: `UPDATE … WHERE id=$1 AND status='searching' RETURNING *`. Haydovchi onlayn, tasdiqlangan va bo'sh ekanini ham tekshirish kerak.

### B2. Bir vaqtda bir nechta faol taksi buyurtmasi
`POST /orders` da faol buyurtma tekshiruvi yo'q. Yo'lovchi ketma-ket bosib, haydovchilarga bir nechta buyurtma yuborib yuboradi.

### B3. Backend qayta yonsa, taymerlar yo'qoladi
- "30 soniyada haydovchi topilmadi" va dispetcherlik taymerlari `asyncio.create_task` da, ya'ni xotirada ishlaydi.
- Qo'riqchi backend'ni qayta yoqsa (hozir shunday sozlangan), o'sha paytdagi `searching` buyurtmalar abadiy osilib qoladi. Yo'lovchida "faol buyurtma" ko'rinib turadi.
- **Tuzatish:** ishga tushishda eskirgan buyurtmalarni yopish. Yaxshiroq yo'l: har daqiqada ishlaydigan fon vazifasi.

### B4. Yo'l narxi va to'lov miqdori
- Payme `estimated_price` ni tekshiradi, safardan keyingi `final_price` boshqacha bo'lishi mumkin.
- Click va Payme bo'yicha qaytarish (refund) oqimi yo'q.

---

## C. 🟠 Ishonchlilik va kengayish

- **Frontend'da ErrorBoundary yo'q** (ikkala ilovada ham). Bitta sahifadagi render xatosi butun Mini App'ni oq ekranga aylantiradi.
- **Socket.IO bitta jarayonga bog'langan:** Redis adapteri yo'q. Ikkinchi backend nusxasi qo'shilsa, hodisalar boshqa nusxadagi foydalanuvchilarga yetmaydi.
- **Bitta server, bitta Redis, bitta ma'lumotlar bazasi.** Zaxira nusxa shu diskda turadi, boshqa joyga nusxalanmaydi. Disk buzilsa, ma'lumot ham, zaxira ham yo'qoladi.
- **Tashqi xizmatlarga bog'liqlik:** OSRM namoyish serveri, Yandex Geosuggest (kuniga 1000 so'rov), Telegram. Ularning ishlashi kuzatilmaydi, ogohlantirish (alert) yo'q.
- **`driver_location_history` cheksiz o'sadi:** saqlash muddati yo'q, har bir joylashuv yangilanishi yangi qator qo'shadi.
- **Bildirishnomalar navbatsiz:** har bir yuk so'rovi 25 tagacha ijrochiga darhol Telegram xabari yuboradi. Ko'p so'rovda Telegram'ning sekundiga 30 xabar cheklovi oshib ketadi va xabarlar yo'qoladi.

---

## D. 🟡 Xavfsizlik (qo'shimcha)

- **Tokenlar `localStorage` da** (Mini App va admin). XSS bo'lsa (A1), tokenlar o'g'irlanadi. Admin uchun `HttpOnly` cookie yaxshiroq.
- **Admin tokeni 7 kun yashaydi.** Server tomonida bekor qilish (logout yoki kalitni almashtirish) yo'q.
- **nginx xavfsizlik sarlavhalari yo'q:** `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `frame-ancestors` (Telegram WebApp uchun ruxsat berib).
- **Fayllar xotiraga to'liq o'qiladi** (`await file.read()`), nginx esa 20 MB gacha ruxsat beradi, backend chegarasi 5 MB. Bir nechta parallel katta yuklash xotirani band qiladi.
- **Bir foydalanuvchi kuniga cheksiz yuk/texnika so'rovi yarata oladi.** Hozirgi cheklov faqat Yandex xarita endpoint'larida. Spam ijrochilarga bildirishnoma oqimini keltirib chiqaradi.

---

## E. 🟡 Huquqiy va biznes

- **Shaxsga doir ma'lumotlar qonuni (O'zbekiston):** fuqarolarning shaxsiy ma'lumotlari (pasport skanlari, telefon, joylashuv) O'zbekiston hududidagi serverlarda saqlanishi talab qilinadi. Ishga chiqishda VPS aynan O'zbekistonda bo'lishi kerak, ngrok yoki xorijiy hosting emas.
- **Hujjatlar yo'q:** foydalanuvchi shartnomasi (oferta), maxfiylik siyosati, shaxsiy ma'lumotlarni qayta ishlashga rozilik. Rozilik birinchi kirishda (onboarding) olinishi kerak.
- **Daromad modeli yo'q:** yuk, texnika va po'putida platforma komissiyasi, obuna yoki "tepaga ko'tarish" xizmati hisoblanmaydi. Taksida komissiya va haydovchiga to'lov (payout) yo'q.
- **Xavfsizlik funksiyalari yo'q:** SOS tugmasi, "safarni yaqinlarga ulashish", foydalanuvchi ustidan shikoyat qilish va moderatsiya, nizolarni hal qilish.
- **Bekor qilish qoidalari yo'q:** kech bekor qilish uchun jarima, haydovchi kutgan vaqt uchun haq.

---

## F. ⚪ Mahsulot va UX

- Mijoz va ijrochi o'rtasida **ilova ichida chat yo'q**, faqat telefon. Telegram orqali vositachi chat foydali bo'lardi.
- **Taksi:** tarif tanlash (ekonom/komfort), yaqin haydovchilarni xaritada ko'rsatish va kelish vaqti, oldindan buyurtma yo'q.
- **Analitika yo'q:** qaysi qadamda foydalanuvchi chiqib ketadi (onboarding, buyurtma), konversiya, qidiruv natijasizligi.
- **Bildirishnoma sozlamalari yo'q:** qaysi xabarlar kelishini tanlab bo'lmaydi.
- Birinchi tahlildan qolganlar: rus tili, skeleton yuklash, eski taksi sahifalarini to'liq qayta yozish.

---

## G. Testlar

- Socket hodisalari (`driver:*`, `passenger:*`, `admin:join`) uchun test yo'q. A3 va B1 shuning uchun sezilmagan.
- **Ruxsat (avtorizatsiya) testlari yo'q:** "begona foydalanuvchi boshqaning ma'lumotini ola oladimi". A4 va A5 shu turdagi xatolar.
- Frontend va e2e (Playwright) testlari yo'q.

---

## Tavsiya etilgan navbat

1. **Darhol (1 kun):** A1–A6, B1, B2. Hammasi kichik o'zgarish, har biriga ruxsat testi bilan.
2. **Ishonchlilik:** B3 (osilgan buyurtmalar), ErrorBoundary, so'rov yaratishga limit, nginx xavfsizlik sarlavhalari, `driver_location_history` uchun saqlash muddati.
3. **Ishga chiqishdan oldin:**
   - O'zbekistondagi VPS va domen;
   - zaxira nusxani boshqa joyga nusxalash;
   - oferta, maxfiylik siyosati va rozilik;
   - Sentry va tashqi xizmatlar holatini kuzatish.
4. **O'sish:** komissiya va to'lovlar, chat, SOS va shikoyatlar, tarif tanlash, analitika, rus tili.
