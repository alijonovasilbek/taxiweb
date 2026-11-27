# Chortoq — mijozlar uchun Android ilova

Taksi, po'puti, yuk tashish va maxsus texnika. Telegram Web App bilan bitta backend va bitta akkaunt:
bir joyda berilgan buyurtma ikkinchisida ham ko'rinadi. Reja: `../PLAN-MIJOZ-ANDROID.md`.

- Expo SDK 58 (RN 0.88) + TypeScript + Expo Router, paket `uz.chortoq.app`
- Xarita: backend'dagi `/api/maps/embed` (Yandex JS API, WebView) — kalit serverda
- Kirish: Telegram orqali (`/auth/app/start` `app: "client"`) yoki login/parol
- APK GitHub Actions'da yig'iladi: `android-dev` pre-release → `chortoq-dev.apk`, `chortoq-emulator.apk`

```bash
npm ci
npx tsc --noEmit && npx expo lint
```
