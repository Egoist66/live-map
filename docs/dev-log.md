# Dev-лог

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
