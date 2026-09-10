# Mobile-стратегия: Web (Laravel Cloud) + Capacitor (iOS/Android)

> Цель: веб продолжает работать как сейчас на Laravel Cloud, мобильные приложения переиспользуют текущий `Vue 3 + Vite + Inertia + PWA` код без форка.

## 1. Почему так

- У нас уже есть PWA (`vite-plugin-pwa`, `manifest.webmanifest`, `push-sw.js`, кэш тайлов/картинок/API).
- Полный рерайт на Flutter/RN — дорого и дублирует логику.
- Capacitor в режиме `server.url` — это нативный WebView-контейнер вокруг prod-URL. Один кодбейз для web + mobile.
- TWA/Bubblewrap — только Android, поэтому Capacitor — основной путь (iOS + Android + нативные плагины).

## 2. Принцип: один кодбейз, разветвление в хуке

Логика только в хуках (по AGENTS.md Правило №1). Не плодить `if (isNative)` по компонентам.

Создать позже:

- `resources/js/composables/usePlatform.ts` — `isNative`, `isIos`, `isAndroid`, `isWeb` через `Capacitor.isNativePlatform()` + `Capacitor.getPlatform()`.
- `resources/js/composables/usePush.ts` — на вебе: существующий Web Push (`push-sw.js`), в нативе: FCM через `@capacitor/push-notifications`.
- `resources/js/composables/useGeo.ts` — на вебе: `navigator.geolocation`, в нативе: `@capacitor/geolocation`.
- `resources/js/composables/useAuthStorage.ts` — на вебе: cookie/Sanctum как сейчас, в нативе: токен в `Preferences` + `Authorization: Bearer`.

Компоненты (`*.vue`) только вызывают эти хуки.

## 3. Установка Capacitor (не ломает web-сборку)

```bash
npm i @capacitor/core @capacitor/cli
npm i @capacitor/push-notifications @capacitor/geolocation @capacitor/camera @capacitor/preferences @capacitor/haptics
npx cap init "UPin" --web-dir=dist --npm-client=npm
npx cap add android
npx cap add ios
```

`capacitor.config.ts` в корне:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.upin.live',
  appName: 'UPin',
  webDir: 'dist',
  server: {
    url: 'https://ВАШ-ДОМЕН.laravel.cloud',
    cleartext: false,
  },
  allowNavigation: ['ВАШ-ДОМЕН.laravel.cloud'],
  ios: { contentInset: 'always' },
  android: { allowMixedContent: false },
};

export default config;
```

> Режим `server.url` = WebView грузит Laravel Cloud напрямую. Отдельный SPA-билд для Capacitor НЕ нужен, `vite build` для веба остается как есть (`laravel-vite-plugin`). `android/` и `ios/` в git — по желанию команды, обычно коммитят.

Синхронизация после изменений фронта:

```bash
npm run build
npx cap sync
npx cap open android
npx cap open ios
```

## 4. Laravel Cloud: что настроить

1. `APP_URL=https://ВАШ-ДОМЕН.laravel.cloud`, `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=none`.
2. `SANCTUM_STATEFUL_DOMAINS=ВАШ-ДОМЕН.laravel.cloud` для web-cookie. Для натива — отдельная схема токенов: `Sanctum::createToken()` + `auth:sanctum` на API, токен хранить в Capacitor `Preferences`.
3. CORS (`config/cors.php`): разрешить `capacitor://localhost`, `ionic://localhost`, `http://localhost` на всякий случай (нужно только если будет локальный билд, с `server.url` origin = домен).
4. Reverb/WebSocket: только `wss://`, в `resources/js/echo.ts` брать host из `.env` (`VITE_REVERB_HOST`), не хардкодить `localhost`.
5. HTTPS обязателен, `cleartext: false`, `allowMixedContent: false`.
6. Диплинки: позже `Applinks (Android)` + `Associated Domains (iOS)` для `/map`, `/chat`, `/pins/*`.

## 5. Пуши, карта, офлайн

- Web: остается `push-sw.js` + `manifest.webmanifest`.
- Native: FCM (`@capacitor/push-notifications`), отправка через тот же бэкенд-сервис, только device_token другой. Регистрация токена — в `usePush.ts`.
- Карта (MapLibre): тайлы уже кэшируются в PWA (`pwa-map-tiles`), в WebView работает так же. Нативный GPS — через плагин, пробросить в тот же store (Pinia, Правило №8).
- Фото/камера: `<input file>` на вебе, `@capacitor/camera` в нативе — опять же внутри хука.

## 6. Что НЕ делать

- Не форкать `resources/js` на `web/` и `mobile/`.
- Не вставлять `.then()` цепочки / логику в `.vue` — только `async/await` в хуках (Правила №1, №4).
- Не коммитить секреты FCM/APNs, только через env Laravel Cloud.
- Не переключать весь auth на токены сразу — веб оставляем на cookie, токены только для натива.

## 7. Порядок внедрения (когда дойдем)

1. `capacitor.config.ts` + `server.url` на staging-домен, проверка `npx cap open android`.
2. `usePlatform.ts` + разводка `usePush/useGeo` (web-ветка = текущее поведение).
3. Sanctum-токены для API + сохранение в `Preferences`.
4. FCM: получение токена, endpoint `/api/device-tokens`, тест рассылки.
5. Иконки/сплэш (`@capacitor/assets`), `versionCode/versionName`.
6. TestFlight + Play Internal testing.
