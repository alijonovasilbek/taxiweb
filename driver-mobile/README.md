# Chortoq Ijrochi — Android ilova

Taksi, po'puti, yuk tashish va maxsus texnika ijrochilari uchun ilova. Mijozlar Telegram Mini App'da qoladi.
To'liq reja: [`../PLAN-ANDROID.md`](../PLAN-ANDROID.md).

**Stek:** Expo SDK 58 (React Native 0.88, CNG: `android/` qo'lda tahrirlanmaydi), TypeScript, Expo Router,
TanStack Query, Zustand, socket.io-client, lucide-react-native.

## Tuzilma

```
src/
  app/                 ekranlar (Expo Router)
    _layout.tsx        splash, mavzu, react-query, majburiy yangilanish
    index.tsx          yo'naltirish: kirish → ruxsatlar → ilova
    login.tsx          Telegram orqali kirish (/auth/app/start → bot → /auth/app/poll)
    permissions.tsx    ruxsatlar ustasi + telefon brendi bo'yicha maslahat
    (tabs)/            Bosh · Taksi · Qatnovlar · So'rovlar · Transport · Profil (rolga qarab)
  api/client.ts        fetch + access/refresh tokenlar (401 → bitta refresh → qayta so'rov)
  api/socket.ts        Socket.IO (token yangilansa qayta ulanadi)
  api/hooks.ts         /provider/home, /app/version, /vehicles/my, /auth/app/sessions
  store/auth.ts        sessiya holati, qurilmani ro'yxatga olish
  lib/                 xavfsiz saqlash, qurilma ID, ruxsatlar, katalog
  theme/               Mini App bilan bir xil bordo tokenlar, kunduzgi/tungi rejim
```

## Ishga tushirish

```bash
npm ci
cp .env.example .env          # EXPO_PUBLIC_API_URL=https://... (backend yoki ngrok)
npx tsc --noEmit && npx expo lint
npx expo run:android          # Android SDK kerak; Expo Go'da fon GPS ishlamaydi
```

Kompyuterda Android yig'ish og'ir bo'lsa — GitHub Actions (`.github/workflows/android.yml`): har bir push/PR'da
debug APK artefakt bo'lib chiqadi, `v1.0.0` kabi tegda imzolangan release APK GitHub Release'ga yuklanadi.

## Release imzo kaliti (bir marta)

```bash
keytool -genkeypair -v -keystore chortoq-ijrochi.jks -alias chortoq -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 chortoq-ijrochi.jks   # → ANDROID_KEYSTORE_BASE64 secret
```

Kalitni **ikki joyda** saqlang: yo'qolsa, foydalanuvchilarga yangilanish chiqarib bo'lmaydi. Repoga qo'shmang
(`*.jks`, `*.keystore` — `.gitignore`da).

## Ikonkalar

`npm run icons` — `assets/` dagi ikonka, splash va bildirishnoma rasmlarini qayta yaratadi (Python + Pillow).
