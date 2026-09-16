# Dev-лог

## 2026-09-16 — Таб «Районы» в глобальном поиске + аккуратная шапка района
- 🔍 Глобальный поиск (Ctrl+K) теперь с табами «Люди · Районы»: районы ищутся по названию (`GET /api/districts?search=`, топ-20), из выдачи можно открыть страницу, вступить одной кнопкой (роль сразу обновляется) и уйти в общий чат знакомиться внутри.
- 🐞 Иконка поиска на профиле открывала другой диалог (`ChatSearchDialog` через локальный `usePeopleSearch`), а не глобальный — поэтому табов не было видно: таб «Районы» добавлен и туда (таб синхронизирован через `peopleSearch.activeTab`), чинит сразу профиль, дашборд и чат.
- 🧩 Новое: стор `peopleSearch` держит `activeTab/districtQuery/districtResults` (pinia, дебаунс 300мс), хук `useGlobalDistrictSearch` (открыть/вступить/чат + тосты), `districtsApi.search(q)`; бэк `DistrictController::index` фильтрует `name LIKE %term%`.
- 🧩 Новое: стор `peopleSearch` держит `activeTab/districtQuery/districtResults` (pinia, дебаунс 300мс), хук `useGlobalDistrictSearch` (открыть/вступить/чат + тосты), `districtsApi.search(q)`; бэк `DistrictController::index` фильтрует `name LIKE %term%`.
- 🎨 Шапка района больше не спорит с обложкой: слои `z-0/z-10` + `isolate`, аватар ровно внахлёст наполовину, название без жёсткого `truncate`.
- Проверки: `vue-tsc --noEmit` ✅, `php -l DistrictController` ✅.

## 2026-09-16 — Новости района + уведомления жителям о пинах
- 📰 Новости UDistrict: `district_posts` + ветки `district_post_comments` + `district_post_likes`; публикует только владелец (картинка до 10МБ через `ImageOptimizer`), лайкают/комментируют жители, читают все.
- 🔔 Жители получают всё: пин внутри (`district.pin_created` из `PinController::store`), новость (`district.post_published`), коммент/ответ/лайк (`district.post_commented/replied/liked`) — всё через `DistrictNotifier` + `UserNotifier` (realtime + push), ссылки сразу на `/districts/{id}`.
- 🎨 Лента `Districts/Show`: композер владельца + `DistrictNewsCard` с ветками (ответы, удаление), счётчики через `applyCommentsDelta`; хуки `useDistrictNews`/`useDistrictNewsComments`, тосты и колокольчик (`describeInboxRow`) под новые типы.
- 🖼️ Общая обложка района: `cover_path` + `cover_url`, ставит владелец (`POST/DELETE /api/districts/{id}/cover`), видят все; шапка выше (`h-36/sm:h-52`), аватар с рамкой не режется.
- 🔗 Клик по названию чата района ведёт сразу на `/districts/{id}` без карты; туда же переведены район-уведомления и тосты.
- Проверки: `vue-tsc --noEmit` ✅, `php -l` новых контроллеров/нотификаций ✅ (миграции `cover`, `district_posts` — прогнать `php artisan migrate`).

## 2026-09-16 — Районы как VK-сообщества: отдельные роуты вместо модалок
- ✨ Новые Inertia-роуты: `/districts` (витрина), `/districts/create` (создание), `/districts/{id}` (страница группы) — `DistrictController::page*` с SSR-карточкой, список догружается API.
- 🎨 Стиль VK-группы в нашем дизайне: нейтральная обложка с точечным паттерном (без фиолетового градиента), квадратный аватар с буквой (без 🏠-эмодзи), синий акцент `blue-600`, табы «Лента · Участники · Информация · Заявки» как в профиле.
- 🗺️ Карта переведена на роуты: клик по заливке и `?district=` ведут на `/districts/{id}`, финиш кисти кладёт черновик в `sessionStorage` (`useDistrictDraft`) и уводит на `/districts/create`.
- 📱 Адаптив: мобила — одна колонка, кнопки на всю ширину; десктоп — `1fr + 300px` с сайдбаром; тёмная тема через `dark:`-ветки везде.
- Проверки: `vue-tsc --noEmit` ✅, `php -l` контроллера и роутов ✅.

## 2026-09-15 — Inertia SSR на проде: гидратация + Laravel Cloud
- 🐞 Прод отдавал пустой `div#app[data-page]` (CSR): SSR-бандл собирался (`build:ssr` → `bootstrap/ssr/ssr.js`), но SSR-процесс не был запущен — Laravel молча откатывался в CSR.
- 🔧 Фикс кода: `app.ts` `createApp` → `createSSRApp` (иначе нет гидратации SSR-HTML), `config/inertia.php` на `env(INERTIA_SSR_*)` + `ensure_bundle_exists`, `Dockerfile` проверяет `bootstrap/ssr/ssr.js`, `supervisord.conf` запускает `php artisan inertia:start-ssr` (для Docker/VPS).
- ☁️ Laravel Cloud (`upin.laravel.cloud`): включить `Use Inertia SSR` в App compute + build `pnpm run build:ssr` + `INERTIA_SSR_ENABLED=true` и редеплой — свой supervisord там не нужен.
- Проверки: `vue-tsc --noEmit` ✅, `config:show inertia.ssr` ✅.

## 2026-09-15 — Системные уведомления в PWA: автоподписка + локальный фолбэк
- 🐞 Причина тишины: закрытая/свёрнутая PWA не держит ни сокет Echo (рвётся через 60с в фоне), ни поллер (тики только на видимой вкладке) — доставка идёт только серверным web-push, а подписка оформлялась лишь вручную тумблером в настройках.
- 🔧 Новый `usePwaPushAuto` (запуск из `useAppLayout`): в standalone само оформляет и привязывает подписку — тихо при готовом разрешении, с однократным системным запросом при `default` (флаг `upin:pwa-push-asked`).
- 🔔 `notifyHidden` (`useAppNotifications`): системный баннер показывается всегда из шины (сокет + поллер), тег стабилен на диалог (`chat-{id}` как у серверного пуша) — серверный баннер заменяет локальный, дублей нет; `showLocal` с `renotify: true`.
- 🛡️ `push-sw.js`: баннер подавляется только при строго сфокусированном окне (`focused === true`), иначе всегда системное уведомление.
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` ✅ (SW перегенерирован).

## 2026-09-15 — Убран системный сплэш PWA «Живая карта района»
- 📱 Системная заставка Android (генерируется ОС из `manifest.name`) показывала «UPin — Живая карта района» перед нашим анимированным сплэшем — выглядело как двойной лоадер.
- 🔧 Фикс (`vite.config.js`): `manifest.name` → `UPin` (описание с «живой картой» осталось в `description` для сторов/SEO); наш анимированный `#pwa-splash` в `app.blade.php` не тронут — он теперь единственный брендированный экран.
- ⚠️ После обновления пользователям нужно переустановить/обновить PWA-ярлык, иначе ОС ещё покажет старое имя из кэша установленного манифеста.
- Проверки: `pnpm build` ✅ (манифест перегенерирован, `name: UPin`).
- 🎨 Фон системного сплэша (`background_color/theme_color`) → `#0B0F1A` в цвет анимированного `#pwa-splash`: системный и наш экраны сливаются в один.

## 2026-09-15 — Сплэш только для PWA + мини-лоадер для браузера, гладкая иконка
- 📱 Сплэш теперь только в PWA (`standalone/fullscreen/minimal-ui`, iOS `navigator.standalone`, `?source=pwa`): в обычном браузере узел вырезается до первой отрисовки. В браузере вместо него — тонкий градиентный лоадер сверху (`#mini-loader`, гаснет с монтированием).
- ✨ Сплэш завлекательнее: хук «Твой район оживает здесь» градиентом, блик по логотипу, стаггер-появление пилюли/чипов/бара.
- 🎨 Иконка ровная и гладкая: рендер с суперсэмплингом (края без лесенки), симметричная геометрия пина; `favicon.ico` — мульти-кадры 16/32/48, чёткий во вкладках.
- Проверки: `view:cache/clear` ✅, `pnpm build` ✅ (SW перегенерирован).

## 2026-09-15 — Триггер меню профиля: нативная кнопка вместо PrimeVue Button
- 🐞 Аватар уходил влево за пределы круга на мобилке: слот PrimeVue Button (аватар + скрытые имя/шеврон + паддинги `!p-1`) конфликтовал с фиксированным кругом 36px — центрирования через CSS не хватало.
- 🔧 Фикс (`AppTopBar`): триггер меню — нативная `<button>` с `grid place-items-center` (как замок/колокольчик рядом): мобилка — строгий круг 36/40px с аватаром 28/32px ровно по центру; десктоп — пилюля `h-11` с именем и шевроном как раньше.
- Проверки: `vue-tsc` ✅, `pnpm build` ✅.

## 2026-09-15 — Компактные кнопки hero дашборда на мобилке
- 🔘 Ряд «Карта · Чат · Друзья · Галерея · Поиск · Поделиться» (`DashboardHero`): на `<640px` текстовые — `text-xs`, паддинги и `min-h 36px`; иконки — 36×36; зазор ряда меньше (`max-sm:gap-1.5`).
- Проверки: `vue-tsc` ✅, `pnpm build` ✅.

## 2026-09-15 — Аватар в шапке съезжал влево на мобилке
- 🐞 Причина: новое правило `button.topbar-round-btn` (36/40px фикс) + отсутствие `justify-content: center` у PrimeVue Button — контент лип влево, круг-аватар смещался.
- 🔧 Фикс: `justify-content: center !important` в оба мобильных брейкпоинта `app.css`.
- Проверки: `pnpm build` ✅.

## 2026-09-15 — Фикс ложного скринлокера при null-пароле в БД
- 🐞 Причина: `useScreenLock.load()` при ЛЮБОЙ ошибке запроса (419/500/офлайн на старте) включал локер по протухшему коду из IndexedDB — бэк при этом честно отдавал `enabled:false` (код null). Протухший код остаётся от старых `save/verify` и не чистится при снятии на другом устройстве.
- 🔧 Фикс: память последнего состояния `screenlock:server-enabled` — успех `load()` пишет истину сервера, офлайн-`save()` пишет намерение (true), `remove()` пишет false, смена аккаунта чистит; в `catch` при записи false протухший код трется и локер не взводится; 401 (нет сессии) — всегда выкл + чистка.
- 🚪 Выход для зависших: на оверлее есть «Забыл код? Выйти из аккаунта», после обновления один онлайн-релоад сам вычистит stale-код.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-15 — Аудит websocket + realtime-шина, фолбэк тостов из SW
- ✅ Цепочка сокетов цела: `broadcastAs` бэка ↔ `USER_EVENTS` (`useUserChannel`), каналы `user.*`/`chat.*`/`map`/`online` ↔ подписки фронта, `channels.php` + `broadcasting/auth` на месте, `X-Socket-Id` глушит self-echo (`toOthers`), бэк dual-send broadcast+webpush+expo в try/catch.
- ✅ Два транспорта без дублей: socket→Echo→шина, polling→poller→та же шина (`useRealtimeMode` + `useRealtimePoller`, дедуп с обеих сторон).
- 🔧 Найден и закрыт гэп: SW-форвард `upin:sw-push` (фокус-вкладка, вчера) никто не слушал — при мёртвом Echo событие терялось. `useAppNotifications` теперь ловит его глобально (тосты смонтированы в `AuthenticatedLayout`): задержка 1.5с + сверка по сигнатуре title+body гасят дубль с Echo; если сокет мёртв — in-app тост, для успевшей скрыться вкладки — локальный баннер (серверный SW его пропускал осознанно).
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-15 — Брендированный splash PWA + аудит пушей и кэшей
- ✨ Стартовый splash в `app.blade.php` (инлайн, первый кадр до CSS/JS): тёмная карта с улицами/рекой/живыми пинами, радар-кольца, лого-пин, «UPin — живая карта района», чипы «📍 Пины рядом · 💬 Чаты · 💞 ULove», shimmer-бар и «сделано с ulove к своему району»; гасится через новый `useSplash.hideSplash()` после монтирования Vue + фолбэк-таймеры в blade (load/pageshow/6с), `prefers-reduced-motion` учтён.
- 🔔 Пуши (`public/push-sw.js`): keepalive без пейлоада молча игнорируется (был ложный «Новое уведомление»); окно в фокусе — без дубля системного баннера, пейлоад уходит странице (`upin-push`, realtime-шина остаётся foreground-путём); окно не в фокусе/закрыто — системный баннер всегда; дефолтные действия Открыть/Закрыть; `pushsubscriptionchange` просит страницу переподписаться.
- 🌉 `pwa/push.service.ts`: `onForegroundPush/onPushResubscribe/startPushBridges` (форвард в `window`-событие `upin:sw-push` + тихое самолечение подписки с сохранением endpoint), мосты стартуют из `app.ts`.
- 📦 Кэши (`vite.config.js`): в прекэш добавлены `maskable-512x512.png` + `apple-touch-icon.png` (были вне SW-прекэша); общее правило NetworkFirst для `GET /api/*` (120с, кроме `/api/version` — опрос обновлений всегда свежий); `id` в манифесте; `navigateFallback` осознанно оставлен `null` (в generateSW он регистрируется раньше runtime-правил и затенил бы навигационный кэш; для SSR-приложения это ломает навигацию).
- 🎨 Иконки: `scripts/gen-pwa-icons.mjs` рисует настоящий фирменный пин (градиент, как `pwa-icon.svg`) — PNG 192/512/maskable/apple-touch перегенерированы, пустой `favicon.ico` (0 байт) заменён валидным ICO; `offline.html` — в стиле splash + авто-reload по `online`.
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` ✅ (SW перегенерирован: 85 прекэш-записей, `pwa-api`, `maskable`/`apple-touch` в прекэше, `id` в манифесте), `php artisan view:cache/clear` ✅.

## 2026-09-14 — Пины района по правому клику + фикс задержки районов
- 🏘️ Новый `pins.district_id` (миграция `2026_10_08_000001`, `nullOnDelete`): правый клик по заливке → «📍 Создать пин района» (только owner/member), точка — место клика, бэк проверяет жительство + точку внутри геометрии + зону.
- 🔒 Видимость: районный пин видят только жители (owner/member) в своей зоне; гость в зоне без членства не видит до вступления; SOS/инвайт районное ограничение не снимают; админ/автор видят всегда (`PinVisibility`, `PinController`, `RealtimeController`, `isPinVisibleLocally`).
- ⚡ Фикс рассинхрона районов: троттлинг `fetchDistrictsForView` 2с→0.8с, догрузка на `zoomend`, форс-fetch после живого GPS и геолокации, районы в polling-тике (`districts_upsert` в `mapChanges` + `applyMapSync`), мгновенный рендер созданного (`upsertRealtime`).
- Проверки: `php -l` ✅, миграция не прогонялась — нет доступа к БД локально (`php artisan migrate` 2002).

## 2026-09-14 — Expo-пуши в upin-mobile + AES-256-GCM для messages
- 📲 Пустая `expo_push_tokens`: бэк принимал только `ExponentPushToken[` — теперь оба формата (`Exponent/ExpoPushToken[...]`, трим, `platform` до 32, миграция widen), фильтр `ExpoPushService::isExpoToken()` тот же; `POST /expo-push-tokens/test` возвращает `tokens` для диагностики.
- 🌉 Мост WebView: `expo-push.ts` читает токен из `UPinApp/UPin/window.expoPushToken`, слушает `upin:push-token/upin-push-token/expo-push-token/push-token` + `message` (RN→Web), шлёт оба `get-expo-push-token/getExpoPushToken`, ретраи 40×3с + focus/visible/online/auth-changed; `useAuthStorage` диспатчит `upin:auth-changed` после login/logout (был вечный 401 первого bind).
- 🔒 `messages.body` шифруется AES-256-GCM (`MessageCrypto`, формат `gcm1:base64(iv+tag+cipher)`, ключ `MESSAGE_CRYPTO_KEY` base64-32 либо производный от `APP_KEY`); каст `MessageBodyCast` (legacy-plaintext читается, пишется всегда шифр); backfill `php artisan chat:encrypt-messages --dry-run`; фронт без изменений (по TLS открытый текст).
- ⚠️ На проде: задать `MESSAGE_CRYPTO_KEY` (`php -r "echo base64_encode(random_bytes(32)).PHP_EOL;"`), накатить миграции, прогнать `chat:encrypt-messages`, проверить `expo-push-tokens/test` (`tokens>0`, `sent>0`), в upin-mobile проверить инжект `UPinApp.expoPushToken` + обработку `type:'notify'`.
- Проверки: `php -l` ✅, криптороундтрип ✅, `vue-tsc --noEmit` ✅.

## 2026-09-14 — WebView тёмная тема, свайп-ответ, голосовые до 1 мин
- 🌙 WebView тёмная тема: белые полосы у статус-бара/жестов убраны — единый `#0B0F1A`: фон `<html>/<body>` + `overscroll-behavior-y: none`, `useTheme` красит `theme-color` и фон при смене темы, инлайн-скрипт в `app.blade.php` ставит фон до CSS (без белой вспышки), у нижнего меню глухая тёмная подложка + filler под safe-area.
- ↩ Свайп-ответ: новый хук `useMessageSwipe` (горизонтальный жест в любую сторону, порог 55px, вертикальный скролл не ломается, long-press-меню не конфликтует) + иконка-подсказка; `ChatWindow` склеивает жесты свайпа и контекстного меню.
- 🎤 Голосовые сообщения (макс 60 c): хук `useVoiceRecorder` (opus/webm 32 кбит/с, автостоп на лимите, превью для прослушивания, уровень микрофона), `useVoicePlayer` (один активный плеер) + `VoiceMessagePlayer`, кнопка-микрофон в композере вместо отправки, запись/превью-панели на PrimeVue, Escape отменяет.
- 🗄 Бэкенд: `ChatAttachment::VOICE` (webm/ogg/m4a/mp3/wav, макс 5 МБ), `voice_duration` (1–60 c) → `attachment_duration`, тип `voice`, пуши/цитаты/превью «🎤 Голосовое»; миграция `2026_09_30_000003_add_voice_to_messages` (накатить `php artisan migrate`).
- Проверки: `php -l` ✅, `vue-tsc --noEmit` ✅ (миграция не прогонялась — нет доступа к БД локально).

## 2026-09-13 — Capacitor полностью удалён, только web
- 🗑️ Удалены `android/`, `capacitor.config.ts`, все `@capacitor/*` + `@capawesome/capacitor-badge` (pnpm), `kreait/firebase-php` (composer), скрипты `cap:*`/`mobile:*`, `docs/mobile-capacitor.md`.
- 🗑️ Бэкенд: удалены `MobileAuthController`, `DeviceTokenController`, `DeviceToken` (+миграция), `FcmService` и его вызовы (чат/мэтч/SOS/нотификации — остался `WebPushService`), роуты `/auth/token` и `/device-tokens`, секция `firebase` из `config/services.php`, `deviceTokens()` из `User`.
- 🧹 Фронт: удалены `usePlatform/useNativeShell/useNativePush/useAppBadge`, `mobile.api`; хуки переведены на web (`useAuthStorage`, `useGeolocation`, `useLastRoute`, `useChatLayout`, `usePinCommentInput`, `usePwaInstallBanner/usePwaSettings`, `useAppNotifications`, `pwa.service`); в настройках убраны APK/натив-пуш блоки.
- ✅ Проверки: `vue-tsc --noEmit` ок., `php -l` ок., `route:list` ок.

## 2026-09-13 — Capacitor-каркас: Android + dual-auth API без ломки web
- 📱 Установлены `@capacitor/core/cli/android + 9 плагинов` (geolocation/push/camera/preferences/haptics/status-bar/splash/keyboard/app), создан `capacitor.config.ts` (`com.upin.live`, `server.url`, `CAP_SERVER_URL`), добавлен `android/`, скрипты `mobile:build/cap:sync/open`.
- 🔑 Dual-auth: `HasApiTokens` + guard `sanctum`, `POST/DELETE /api/auth/token`, `device_tokens` (миграция + `DeviceToken` + `DeviceTokenController`), старые группы `api.php` переведены на `auth:web,sanctum` — web-cookie работает как раньше, Bearer добавлен опцией.
- 🧠 Фронт по Правилам №1-4: `usePlatform/useAuthStorage (Preferences+зеркало)/useNativeShell/useNativePush`, `mobile.api`, `services/api` (+Bearer, `VITE_API_URL` без `/api`), `echo.ts` (+Bearer + абсолютный `authEndpoint`), `useGeolocation` (натив first, fallback web).
- Проверки: migrate ✅, `route:list api/auth|device` ✅, `vue-tsc --noEmit` ✅, `npx cap sync android` ✅ (9 плагинов).

## 2026-09-13 — Убрана иконка поиска из навигации
- 🔍 Кнопка `pi-search` удалена из `AppTopBar`, событие `search` и привязка в `AuthenticatedLayout` вычищены.
- ⌨️ Поиск людей остаётся доступен через Ctrl+K и диалог `GlobalPeopleSearchDialog`.
- Проверки: `vue-tsc` ✅.

## 2026-09-13 — Аудит адаптивности и тёмной темы (карта, комменты, SOS)
- 🌙 Тёмная тема: новые кнопки (рефреш карты, удаление комментов) — PrimeVue Aura с `darkModeSelector: '.dark'`, цвета адаптируются сами; кастомных цветов без `dark:`-пары не добавлено; диалог подтверждения и тосты уже тёмные глобально.
- 📱 Мобилка: топбар карты сжимается за счёт `truncate`/`min-w-0` (проверено до 320px), ряд действий коммента умещается, карточка в редактировании держит `min-h` ленты и скролл шапки; SOS-баннер ограничен `92vw` с переносом кнопок.
- Изменений кода не потребовалось, `vue-tsc` ✅.

## 2026-09-13 — SOS не воскресает после закрытия (надгробия удалённых пинов)
- 🪦 Причина мигания: тик поллинга, ушедший до коммита удаления, возвращал SOS-пин в `upsert` (окно сервера ~10с) — пин воскресал до следующего `checkExit` (~5с).
- 🔧 Фикс: в сторе пинов надгробия недавно удалённых id (TTL 60с) — `addRealtime` и слияние `fetchNearby` игнорируют их; `removeRealtime`/`deletePin` ставят надгробие, `dropSosPinInstantly`/`checkExit` идут через `removeRealtime`.
- Проверки: `vue-tsc` ✅.

## 2026-09-13 — Удаление своих комментариев + адаптация карточки в редактировании
- 🗑 Удаление комментариев: кнопка-корзина PrimeVue у своих комментов и ответов (админ видит у всех), подтверждение через общий `ConfirmDialog`, спиннер на удаляемом, счётчик пина уменьшается сразу.
- 📊 Лимит удалений: **3 в день на Free, безлимит на PRO/админе** (`comment_delete:{user}:{date}` в кэше, 429 «Лимит удалений…» тостом).
- 📐 Режим редактирования пина: шапка карточки ограничена (`30dvh` / `280px` со скроллом), у ленты комментов минимальная высота (`160px` мобилка / `240px` десктоп), на десктопе карточка ограничена высотой вьюпорта — комменты всегда можно листать.
- Техника: `PinCommentController::destroy` (лимит через `User::isPro`), `deleteComment/deletingCommentId` в `usePinDetails`, `canDeleteComment` + `isEditingPin` в `PinDetailsCard`. Проверки: `php -l` ✅, `vue-tsc` ✅.

## 2026-09-13 — SOS исчезает мгновенно + кнопка ручного обновления карты
- ⚡ Завершение SOS: пин убирается из стора и перерисовывается до ответа сервера (`closeOwnSos` в `useSosMode`), карточка закрывается сразу; при ошибке лента перечитывается обратно.
- 📡 Второй участник выходит из изоляции мгновенно: подписка на сокет `pin.deleted` в дополнение к шине `map:pins`, тихий опрос `/api/sos/mine` ускорен с 10с до 4с.
- 🔄 Ручной рефреш карты: новый хук `useMapRefresh` (поллинг-синк + `sos.load` + `fetchNearby` + изоляция + `renderPins`), в `MapTopBar` кнопка PrimeVue `pi-refresh` со спиннером.
- Проверки: `vue-tsc` ✅.

## 2026-09-13 — SOS в realtime: оба транспорта (сокет + шина поллинга)
- 📡 SOS видят все: клиентский `isPinVisibleLocally` больше не режет активный SOS (зеркало бэкенда), сокет `pin.created` с общей map-рассылки доходит до любых зон; поллинг `mapChanges` докладывает живые SOS вне bbox (`liveSosPins`), а `pins/index` подмешивает SOS вне радиуса.
- 🔔 Принятие SOS: системное сообщение едет сокетом (`MessageSent` → `user.{creator}` + `chat.{id}`) и поллингом (`freshMessages` → `user:message.sent`), у создателя тост со ссылкой в чат + бейдж непрочитанного, плюс серверный WebPush на скрытую вкладку.
- 🚪 Автовыход из изоляции: удаление/истечение SOS-пина выходит из режима у обоих — мгновенно по `map:pins.deleted` (поллинг) и тихим опросом `/api/sos/mine` каждые 10с (сокет-режим, TTL): пин убирается, карточка закрывается, лента обновляется.
- Проверки: `php -l` ✅, `vue-tsc` ✅.

## 2026-09-13 — SOS-режим: лимиты, принятие, изоляция карты, отдельный чат
- 🆘 Лимиты SOS в месяц: **1 бесплатно, 3 на PRO** (админ — безлимитно). Счётчик виден в диалоге создания при выбранном SOS; превышение — 429 «Лимит SOS».
- 🤝 Принять/Отклонить: у чужого SOS-пина кнопки «Принять» / «Отклонить». Первый принявший становится помогающим, вызов переходит в active; отказ скрывает вызов у отказавшегося (можно передумать — «Всё же помочь»).
- 🗺 Изоляция: создатель и принявший видят на карте **только этот SOS-пин** (бэкенд `pins/index` режет ленту, фронт вычищает стор + вотчер), пин особо выделен — красное свечение, быстрый пульс, бейдж «🆘 SOS». Остальные пины скрыты, пока вызов жив или создатель не удалит пин.
- 💬 Отдельный чат: при принятии создаётся диалог `type=sos` с обоими участниками + системное сообщение «принял(а) SOS», после принятия — сразу переход в чат. Закрытие SOS создателем удаляет пин, чат остаётся. Красный баннер режима: статус, «Открыть чат», «Завершить SOS».
- 🌍 SOS-пин виден всем авторизованным поверх зон/страны/пола (`PinVisibility`).
- Техника: миграция `sos_calls` + `sos_call_declines` + `conversations.pin_id`; `SosCall/SosCallDecline`, `SosService` (лимиты/accept/decline/activeFor), `SosController` (`/api/sos/mine`, `/api/pins/{pin}/sos…`); фронт `sos.api`, `stores/sos`, `useSosMode/useSosAction`, `SosPinActions/SosModeBanner`. Проверки: migrate ✅, `php -l` ✅, `vue-tsc` ✅, сквозной smoke (лимиты→принятие→чат→каскад) ✅.

## 2026-09-13 — SOS-категория пинов с предупреждением об ответственности
- 🆘 Новая встроенная категория **SOS** (первая в списке, красный `#B91C1C`, красная полоска тултипа на карте).
- ⚠️ При выборе SOS в создании и редактировании пина — модалка PrimeVue: «SOS — только для экстренных ситуаций. Вы несёте ответственность за ложное объявление ЧС: пользователи вправе пожаловаться администрации и в соответствующие органы». Кнопки «Отмена» / «Осознаю ответственность»; без подтверждения категория не ставится.
- 🛡 Бэкенд требует `sos_confirmed=true` для `store/update` с категорией SOS (422 иначе) — обход диалога невозможен. Жалобы на ложный SOS — через существующую причину «Фейк / недостоверно» (кнопка ⚠).
- Техника: `Pin::SOS_CATEGORY/isSosCategory`, `useSosConfirm` хук, `selectCategory` в `usePinCreate/usePinEdit`, `sos_confirmed` в payload. Проверки: `php -l` ✅, `vue-tsc` ✅.

## 2026-09-13 — Фикс `_subOldScore` в заданиях (SQLSTATE 42S22)
- 🐞 Причина: хуки `updating` в `User` писали `_subOldScore/_subOldLevel` в `attributes`, и UPDATE падал с `Unknown column '_subOldScore'`. Проявлялось при начислении XP за задания.
- 🔧 Фикс: объявлены реальные свойства `public mixed $_subOldScore/_subOldLevel` на модели (минуют `__set` Eloquent), в `updated` — сброс в `null` вместо `unset`.
- ✅ Проверено: создание тестового юзера + `ReputationService::addScore` без SQL-ошибки, `_subOldScore` в attributes нет, `vue-tsc` чисто.

## 2026-09-13 — Задания для PRO-недели + новая шкала рангов

### Что добавлено
- 🎮 Раздел **«Задания»** в профиле (`/settings/quests`): два трека на выбор — **Пины · UPin** и **Свайпы · ULove**, по 5 заданий в каждом.
- 🏆 Полный трек = **PRO на 7 дней**. После выдачи — модалка «PRO на неделю — твой!», следующие задания через месяц (кулдаун 30 дней), докупка PRO через тариф.
- ⭐ Каждое задание даёт очки рейтинга (`reputation_score`): 50–150 XP, всего ~550 XP за трек.
- 📊 Новая шкала рангов (7 ступеней): Новичок 0 → Исследователь 150 → Активист 350 → Свой в городе 700 → Ветеран 1200 → Легенда 2000 → Гид 3500.

### Задания
**Пины:** Первая афиша (1 пин, 50 XP) → Собиратель сердец (10 реакций, 100 XP) → Живое обсуждение (5 комментариев, 100 XP) → Зазывала (3 инвайта, 150 XP) → Серия из 5 (5 пинов, 150 XP).
**Свайпы:** Анкета-магнит (о себе + 3 интереса + фото, 50 XP) → Разведчик (30 свайпов, 100 XP) → Харизма (5 входящих лайков, 150 XP) → Три мэтча (150 XP) → Первый шаг (3 диалога после мэтча, 150 XP).
- Прогресс считается по реальным действиям с начала календарного месяца — «на отмашку» не закрыть.

### Техника
- Backend: `QuestCatalog`, `QuestService` (замер/выдача), `ReputationService` (ранги), модели `UserQuestProgress` + `QuestReward`, `QuestController` (`GET /api/quests`, `POST /api/quests/refresh`, `POST /api/quests/claim`), миграция `2026_10_04_000002_quest_system` (level → varchar(32), quest-поля юзера, 2 таблицы).
- Frontend: `services/quests.api.ts`, `stores/quests.ts`, `useQuests` + `useRank`, компоненты `QuestRankBar` / `QuestCard` / `QuestPremiumModal` / `SettingsQuestsTab`, таб «Задания» в настройках.
- Проверки: `php artisan migrate` ✅, `php -l` ✅, `vue-tsc --noEmit` ✅ (чисто).
