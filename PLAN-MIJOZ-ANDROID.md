# Chortoq — mijozlar uchun Android ilova: to'liq reja

> Holat: **reja**. Ish "boshla" deyilgandan keyin boshlanadi.
> Asosiy shart: **Telegram Web App ham, APK ham bir vaqtda ishlaydi.** Ikkalasi bitta backend va bitta akkauntdan
> foydalanadi. Web App'da berilgan buyurtma ilovada ko'rinadi va aksincha.

---

## 1. Maqsad

| | Hozir (Web App) | Ilova bilan |
|---|---|---|
| Kirish | Faqat Telegram ichida | Telegram'siz: login/parol yoki Telegram orqali bir marta tasdiqlash |
| Haydovchi qabul qildi / yetib keldi | Bot xabari | **Push bildirishnoma** (ilova yopiq bo'lsa ham) |
| Xarita va GPS | Telegram WebView, sekin | Tez, aniq GPS, joriy joyni avtomatik aniqlash |
| Haydovchini kuzatish | Ishlaydi | Ishlaydi va telefon ekrani o'chiq bo'lsa ham push keladi |
| Qo'ng'iroq | Raqamni nusxalash | Bitta tugma bilan haydovchiga qo'ng'iroq |

**Web App o'chirilmaydi.** Telegram'dagi mijozlar avvalgidek foydalanaveradi. Ilova qo'shimcha kanal bo'ladi.

---

## 2. Asosiy qaror: alohida ilova

| Variant | Afzallik | Kamchilik | Qaror |
|---|---|---|---|
| **A. Alohida "Chortoq" ilovasi** (React Native, Expo) | Mijozga sodda ilova, Play Market'da alohida sahifa. Kod ijrochi ilovasi bilan umumiy | Ikki APK | ✅ **Tavsiya** |
| B. "Chortoq Ijrochi" ichiga mijoz rejimini qo'shish | Bitta APK | Mijozga ortiqcha ruxsatlar (fon GPS, batareya) va murakkab menyu | ❌ |
| C. Web App'ni WebView'ga o'rash | Eng tez | Sekin, push va GPS cheklangan, Play Market rad etishi mumkin | ❌ |

- **Nomi:** "Chortoq" (taklif). Paket nomi `uz.chortoq.app`.
- **Ikonka:** ijrochi ilovasidagi bordo fon va oq «C». Farqlash uchun mijoz ilovasi oq fonda bordo «C» bo'ladi.
- **Kod:** `client-mobile/` papkasi. Ijrochi ilovasidagi tayyor qismlar ko'chiriladi va keyin umumiy `mobile-shared/`
  paketiga ajratiladi:
  - API mijozi va tokenlarni avtomatik yangilash;
  - kirish (Telegram va login/parol);
  - Socket;
  - mavzu, UI komponentlari, formatlash va manzil tanlash.

---

## 3. Arxitektura

```
 Telegram Web App (passenger-app) ─┐
 "Chortoq" ilovasi (client-mobile) ─┼──►  FastAPI backend  ──► PostgreSQL / Redis
 "Chortoq Ijrochi" (driver-mobile) ─┘      (bitta akkaunt)   ──► FCM push, Telegram bot
```

- **Bitta akkaunt.** `users` jadvali umumiy, shuning uchun bitta odam ham mijoz, ham haydovchi bo'lishi mumkin.
- **API'lar Web App bilan bir xil:** `/orders`, `/carpool`, `/requests`, `/maps` va `/notifications`.
  Yangi endpoint juda kam kerak (5-bo'lim).
- **Real vaqt:** Socket.IO'dagi `passenger:<id>` xonasi allaqachon bor. Unga quyidagi hodisalar keladi:
  - haydovchi qabul qildi;
  - haydovchi joylashuvi;
  - yetib keldi;
  - yakunlandi.

---

## 4. Ekranlar (Web App'dagi funksiyalar bilan to'liq moslik)

| # | Ekran | Web App'dagi muqobil | Izoh |
|---|---|---|---|
| 1 | Kirish | Telegram initData | "Telegram orqali kirish" va "Login va parol". Yangi mijoz uchun ism va telefon (onboarding) |
| 2 | Bosh sahifa | `Home` | Xizmatlar: taksi, po'puti, yuk tashish, maxsus texnika. Faol buyurtma kartasi |
| 3 | Taksi: manzil tanlash | `BookRide` | Xarita, joriy joy, qidiruv, mashhur joylar, narx hisobi, to'lov usuli |
| 4 | Haydovchi qidirilmoqda | `Tracking` | Animatsiya, bekor qilish. "Haydovchi topilmadi" bo'lsa qayta urinish |
| 5 | Safar kuzatuvi | `Tracking` | Haydovchi xaritada, mashina va raqami, qo'ng'iroq, holatlar |
| 6 | To'lov | `Payment` | Naqd, Payme/Click (brauzerda ochiladi, natija socket orqali) |
| 7 | Baholash | `Rating` | Yulduzlar va izoh |
| 8 | Po'puti: qidirish va bron | `Carpool`, `TripDetail`, `Search` | Yo'nalish va sana, joy bron qilish, bekor qilish |
| 9 | Yuk / texnika so'rovi | `RequestNew`, `RequestDetail` | So'rov yaratish, ijrochilar takliflarini ko'rish va qabul qilish |
| 10 | Buyurtmalarim / tarix | `Orders`, `History` | Barcha xizmatlar bitta ro'yxatda |
| 11 | Bildirishnomalar | `Notifications` | Push va ilova ichidagi ro'yxat |
| 12 | Profil | `Profile` | Ism, telefon, login/parol, mavzu, chiqish. "Ijrochi bo'lish" bosilsa Chortoq Ijrochi ilovasi ochiladi yoki yuklab olinadi |
| 13 | Ijrochi ommaviy profili | `PublicProfile` | Reyting va transport |

**Ilovaga kirmaydi:** Web App'dagi ijrochi rejimi (`Provider`, `TaxiDriver`, `Vehicles` va boshqalar). Bu ishlar
"Chortoq Ijrochi" ilovasida qoladi.

---

## 5. Backend ishlari (kichik, mavjud kodni buzmaydi)

| # | Ish | Nega kerak |
|---|---|---|
| M1 | `devices.app` ustuni (`client` / `driver`), `PUT /devices/me` da `app` maydoni | Ikkala ilova bitta telefonda bo'lsa, push to'g'ri ilovaga borsin. Masalan, "yangi buyurtma" faqat Ijrochi ilovasiga, "haydovchi yetib keldi" faqat mijoz ilovasiga |
| M2 | `push.fire(..., app=...)` va mijoz hodisalari uchun push | Hodisalar: haydovchi qabul qildi, yetib keldi, safar yakunlandi, haydovchi topilmadi, so'rovga yangi taklif, bron tasdiqlandi |
| M3 | `/auth/app/start` da `app` maydoni | Bot mijozga "Chortoq ilovasiga kirish" deb yozsin, "Ijrochi" demasin. Sessiyalar ro'yxatida ilova nomi ko'rinsin |
| M4 | `/app/version?app=client` | Har ilova uchun alohida min/latest versiya va APK havolasi (.env) |
| M5 | Login/parol xabarini umumiylashtirish | Mijoz Telegram orqali birinchi kirganda ham login/parol oladi. Matnda ilova nomi to'g'ri bo'ladi |
| M6 | Testlar | M1–M5, ikki ilova bitta qurilmada bo'lgan holat, Web App va ilovaning bir vaqtda ishlashi |
| M7 | Testlar alohida bazada | Hozir `pytest` asosiy bazaga yozadi (admin panelda test buyurtmalari ko'rinadi). `taxigo_test` bazasi kerak |

Web App'ga tegadigan yagona o'zgarish ixtiyoriy: Android'da yuqorida "📱 Chortoq ilovasini yuklab oling" banneri.

---

## 6. Xarita

- **1-variant (tavsiya, tez):** Yandex xaritasi WebView ichida. Web App'dagi `YandexMap` va hozirgi JS API kaliti
  ishlatiladi. Qo'shimcha kalit kerak emas. Xarita ustidagi tugma va formalar native bo'ladi.
- **2-variant (keyinroq):** Yandex MapKit native. Tezroq ishlaydi, lekin mobil SDK kaliti va native modul kerak.
  Ijrochi ilovasi uchun ham shu kalit so'ralgan (PLAN-ANDROID §13). Kalit olinsa ikkala ilova unga o'tadi.

---

## 7. Push bildirishnomalar

- Firebase loyihasi **bitta**, ichida ikkita Android ilova (`uz.chortoq.ijrochi` va `uz.chortoq.app`).
  `google-services.json` ikkalasini ham o'z ichiga oladi.
- Firebase ulanmaguncha ilova ishlaydi, faqat yopiq turganda xabar kelmaydi. Ochiq paytda Socket orqali keladi,
  Telegram bot xabarlari ham avvalgidek ketadi.
- Kanallar: "Safar holati" (baland ovoz), "Takliflar va bronlar", "Umumiy".

---

## 8. Yig'ish va tarqatish

- `.github/workflows/android.yml` ikkala ilovani yig'adigan qilinadi (matrix: `driver-mobile`, `client-mobile`).
- `android-dev` pre-release'ga quyidagi fayllar chiqadi:
  - `chortoq-ijrochi-dev.apk`, `chortoq-dev.apk` — telefon uchun;
  - `*-emulator.apk` — BlueStacks uchun.
- Bot orqali tarqatish: `/ilova` buyrug'i mijozga oxirgi APK'ni yuboradi.
- Keyinroq: imzolangan release (keystore) va Google Play (ichki test, keyin ochiq).

---

## 9. Bosqichlar

| # | Bosqich | Ish | Muddat |
|---|---|---|---|
| 0 | Tayyorgarlik | Nom, ikonka va paket nomini tasdiqlash. `mobile-shared` ajratish. CI matrix | 1 kun |
| 1 | Backend | M1–M7 va testlar | 1–2 kun |
| 2 | Ilova asosi | Kirish, onboarding, bosh sahifa, profil, bildirishnomalar, mavzu, versiya tekshiruvi | 2 kun |
| 3 | **Taksi** | Manzil va xarita, narx, buyurtma, qidiruv, kuzatuv, qo'ng'iroq, to'lov, baho | 3–4 kun |
| 4 | Po'puti, yuk, texnika | Qidiruv va bron, so'rov yaratish, takliflarni qabul qilish, tarix | 2–3 kun |
| 5 | Push | Firebase ulangach M2 hodisalari ilovada | 1 kun (kalit bo'lsa) |
| 6 | Sifat | BlueStacks va 2–3 real telefonda to'liq sinov. Web App va ilova bir vaqtda: bittasida buyurtma, ikkinchisida ko'rinadi | 2 kun |
| 7 | Reliz | APK bot orqali, 5–10 mijoz bilan sinov, tuzatishlar | 2–3 kun |

**Jami: taxminan 2–2,5 hafta.** Taksi buyurtma qila oladigan birinchi APK 3-bosqich oxirida (≈1 hafta) chiqadi.

Har bosqichdan keyin:
- backend testlari;
- ilovada `tsc` va `lint`;
- APK yig'ish;
- BlueStacks'da o'zim tekshiraman va APK'ni botga yuboraman.

---

## 10. Qabul mezonlari ("mukammal ishlaydi" degani)

1. Mijoz ilovada taksi chaqiradi va haydovchi Ijrochi ilovasida qabul qiladi. Mijoz haydovchini xaritada
   real vaqtda ko'radi, safar yakunlanadi va baholanadi.
2. Xuddi shu buyurtma Web App'dagi "Buyurtmalarim"da ham ko'rinadi.
3. Web App'da berilgan buyurtma ilovada ham ko'rinadi.
4. Ilova yopiq bo'lsa ham "Haydovchi yetib keldi" push xabari keladi (Firebase ulangach).
5. Telefonda ikkala ilova bo'lsa ham push'lar chalkashmaydi.
6. Internet uzilib qaytsa ilova faol buyurtmani o'zi tiklaydi.
7. Po'puti broni va yuk/texnika so'rovi ilovada ham, Web App'da ham ishlaydi.
8. Barcha backend testlari o'tadi va testlar asosiy bazaga tegmaydi.

---

## 11. Sizdan kerak bo'ladi

1. **Nom va ikonka:** "Chortoq", oq fonda bordo «C». Boshqa variant bo'lsa ayting.
2. **Firebase** (push uchun, bepul). Ijrochi ilovasi uchun ham kerak, bitta loyiha ikkalasiga yetadi.
3. **(Ixtiyoriy) Yandex MapKit mobil kaliti.** Bo'lmasa xarita WebView orqali ishlaydi.
4. **(Ixtiyoriy) SMS orqali kirish.** Telegram'i yo'q mijozlar uchun SMS provayder akkaunti kerak (masalan, Eskiz.uz).
   Bo'lmasa kirish Telegram yoki admin bergan login/parol orqali bo'ladi.
5. **"Boshla"** degan buyruq.
