# Dev-лог

## 2026-09-21 — Входящий звонок перекрывался навигацией: teleport диалогов в body
- 🐞 Баг: модалка входящего тонула под шапкой/нижним меню — «Принять» не нажать. Причина: видеодиалоги живут внутри `PageTransition` (трансформ ломает `position: fixed` маски PrimeVue), ни один Dialog в проекте не использовал `appendTo`.
- 🔧 `IncomingCallDialog` + `VideoOverlay`: `appendTo="body"` — маска и окно телепортируются в body поверх всего (z маски PrimeVue > z-50 шапки и z-40 нижнего меню).
- Проверки: `vue-tsc` ✅. Проверить вживую: входящий на втором аккаунте — диалог по центру поверх всего, кнопки жмутся.

## 2026-09-21 — Видео из чата: звонки всем собеседникам + честная модалка ошибки
- 🐞 Баг: кнопка видео в шапке чата отвечала 403 «Видео — для мэтчей и друзей», хотя диалог есть. Причина: чат ≠ дружба (мэтч-чаты и переписки без accepted-дружбы резались правилом).
- 🔧 Правило смягчено: звонок разрешён при мэтче, дружбе ИЛИ общем direct-диалоге (`Conversation::findDirect`); мэтч — режим `match`, остальное — `direct`. Посторонним без всего — 403 «Сначала начни чат или добавь в друзья».
- 🔧 Модалка больше не врёт: контекст `entryContext` (`roulette|direct`) — ошибка прямого звонка показывает «Не получилось позвонить» + [Понятно], а не вход в рулетку.
- Проверки: `php -l` ✅, `vue-tsc` ✅, smoke (чат без дружбы→`direct` ✅, ghost→403 ✅, тестовая дружба 2↔7 восстановлена ✅, звонки/сигналы вычищены ✅).

## 2026-09-21 — Видео до идеала: оба транспорта, ротация рулетки, адаптивные модалки
- 🔧 Websocket: без изменений (broadcast + user-канал с ретраем) — основной путь.
- 🔧 Polling: `postSignal` пинает поллер в burst (ответ ~1с вместо ~2.5с); хост добивает `ringing-out` опросом `show()` + пинает offer при `active` (эмуляция потерянного `accepted`); `pending`-полл теперь и в `searching` (был только idle — искавший с мёртвым сокетом висел вечно).
- 🔧 Рулетка: `recentlyPaired` (минута) — «Дальше» и авто-rejoin не сводят ту же пару; конец по инициативе пира в active — авто-поиск нового с инфо-строкой; отказ/таймаут — инфо без автопоиска. Новый `store.info` (скайбокс) отдельно от `error`.
- 🔧 Peer: `retry()` — ручной iceRestart-offer для caller при `failed`; callee чинится только «Дальше»/отбоем (подсказка в UI).
- 🔧 Модалки: тёмная шапка/фон через `pt` (была белая шапка на тёмном теле), `max-h + scroll` контента, адаптивные паддинги/PiP/чипы, явная кнопка «Закрыть» при ошибке, кнопка «Обновить» соединение при failed (caller).
- Проверки: `php -l` ✅, `vue-tsc` ✅, smoke ротации (пара→re-join без мэтча ✅, данные вычищены ✅). Тест вживую: оба обновить вкладку, звонок друг→друг и рулетка на двух аккаунтах.

## 2026-09-21 — Видео не долетало до второй стороны: добивка + ретраи + eviction SW
- 🔍 Факты: звонки в БД создавались (`direct`, потом `ended` по таймеру звонящего) — POST уходил, а входящий на втором аккаунте не всплывал. Кандидаты: протухший прод-SW отдавал старый бандл без видеокода (видны `bad-precaching-response .../build/*.js 404`), user-канал мог не подписаться если Echo поднялся позже mount, плюс краш `IncomingCallDialog` (TDZ, уже чинён).
- 🔧 Бэк: `GET /api/video/pending/incoming` (`VideoService::pendingIncoming` — ringing за последние 40с) + роут; `migrate` нечего (таблицы уже есть).
- 🔧 Фронт: `VideoGlobalHost` добирает входящие поллингом раз в 5с пока сокет мёртв (при живом сокете полл не ходит, дедуп по callId в `handleIncoming`); `ensureUserChannel` — ретрай подписки раз в 2с пока нет Echo/uid; `pwa.service` в DEV однократно выносит старый SW и чистит `pwa-*/workbox-*` кэши.
- Проверки: `php -l` ✅, `route:list` (10 роутов) ✅, `vue-tsc` ✅, tinker-smoke (pending видит звонок ✅, после hangup пусто ✅, тестовые данные вычищены ✅). Для проверки вживую обеим сторонам обновить вкладку.

## 2026-09-21 — Видео из чатов для друзей + глобальный хост звонков
- 🔧 Бэк: `VideoService::startMatchCall` пускает не только мэтч, но и accepted-дружбу (`Friendship::areFriends`); без мэтча звонок идёт в новом режиме `VideoCall::MODE_DIRECT` (`match_id=null`), с мэтчем — как раньше `match`. Посторонним — 403 «Видео — для мэтчей и друзей». Блоки/занятость/18+ без изменений.
- 🔧 Фронт: новый `useChatVideoCall(activeConv)` (peer из личного диалога, районные чаты без кнопки), кнопка `pi-video` в шапке `ChatWindow` + `videoCall`-эмит, проводка `@video-call` в `Chat/Index.vue`; типы `VideoCallPayload/VideoIncomingEvent` расширены `mode: direct` (оверлей для direct — как мэтч, без «Дальше»); ошибка допуска открывает оверлей с текстом вместо тишины.
- 🔧 Глобализация: новый `VideoGlobalHost` (bindRealtime + оба диалога) смонтирован в `AuthenticatedLayout` асинхронно — входящие доходят в чате/карте, а не только в свайпах; дубли из `Swipes.vue` убраны (кнопки мэтчей и рулетки остались).
- Проверки: `php -l` ✅, `vue-tsc --noEmit` ✅, tinker-smoke (друг→`mode:direct` ✅, посторонний→403 ✅, тестовые дружба/звонки/сигналы вычищены ✅).

## 2026-09-21 — Видео P2P + Reverb: мэтч-звонки и рулетка в свайпах (сокет + polling)
- 🔧 Бэк: миграция `video_calls` + `video_signals` (сигналы персистентны — polling забирает их через sync, сокет — через broadcast); модели `VideoCall/VideoSignal`; события `VideoIncoming (video.incoming)` и `VideoSignalEvent (video.signal)` на оба `user.*`-канала; `VideoService` (мэтч-проверка, busy-контроль, ленивый ringing-таймаут 40с без cron, очередь рулетки на Cache+lock, Free-лимит рулетки 20/день, PRO безлимит, 18+ через `assertAdult`); `VideoController` (9 роутов `/api/video/*`, ICE — `throttle:chat-signal`); `RealtimeController::sync` отдаёт `video_incoming` + `video_signals[video_after_id]`.
- 🔧 Фронт: `video.api`, Pinia `stores/videoRoulette` (сессия, входящие, lifecycle, busy-автоотклонение), `useUserMedia` (камера/мик, мьют), `usePeerConnection` (RTCPeerConnection, offer всегда caller — glare невозможен, trickle ICE через REST), `useVideoSession` (оркестратор-синглтон: медиа → звонок → peer, heartbeat очереди 45с, авто-открытие оверлея, реф-колбэки переживают пересоздание <video>); шина `user:video.*`, `useUserChannel` + поллер разносят оба транспорта в один формат с дедупом сигналов (повторный offer не уронит соединение).
- 🔧 UI (только PrimeVue + Tailwind): `IncomingCallDialog` (WebAudio-рингтон, Принять/Отклонить), `VideoOverlay` (вход в рулетку, поиск с превью, дозвон, активный звонок: PiP, elapsed, mute/cam/hangup, «Дальше» + жалоба в `/api/reports` для рулетки); в `Swipes.vue` — кнопка `pi-video` у каждого мэтча + промо-карта «Видео-рулетка», `bindRealtime` на mount. TURN — `VITE_TURN_URLS/USERNAME/CREDENTIAL` в `.env.example` (без TURN ~30% звонков за NAT не встанет; дефолт — публичный STUN).
- ⚠️ Не влезло / следующим шагом: heartbeat `last_seen` в очереди (сейчас живость по TTL+rejoin), звонки из drawer-мэтчей на мобиле (там только чат), авто-«Дальше» по таймеру сессии, звонок из диалога чата мэтча, coturn в `docker-compose`, ручные QA на двух устройствах (Safari `playsinline`).
- Проверки: `php -l` ✅, `migrate` ✅, `vue-tsc --noEmit` ✅, tinker-smoke (ringing→incoming→accept→offer→signals→hangup ✅, рулетка a-wait/b-match ✅), тестовые строки из БД вычищены ✅.

## 2026-09-21 — Фото лендинга локально: `public/landing/` вместо pravatar/unsplash
- 🔍 Аудит: hero-слайдер (`useWelcomeHeroSwiper`) и аватары «уже листают» (`Welcome.vue`) тянули лица с `i.pravatar.cc` / `images.unsplash.com` — лишний DNS/TLS-хендшейк, нулевой кэш-контроль и риск битых фото при недоступности чужих хостов.
- 🔧 Скачаны 1:1 в `public/landing/` (проверены `getimagesize`, все JPEG): `hero-anya.jpg` (pravatar 47, 600px) + `hero-anya-fallback.jpg`, `hero-maks/dima/sofia.jpg` (unsplash 800×640), `face-1/2/3.jpg` (pravatar 100px, ~3КБ). Суммарно ~285КБ.
- 🔧 Хук и `Welcome.vue` переведены на `/landing/*`; первый слайд (LCP лендинга) — `eager` + `fetchpriority=high`, остальные `lazy`; аватарам добавлен `aria-label→alt`. CSP `img-src`: `pravatar`/`unsplash` удалены, `ui-avatars.com` оставлен (фолбэк безфотоюзеров в `useAvatar.ts` — общеапповый, не лендинг).
- ⚠️ Рядом замечено, не тронуто: `public/og-cover.jpg` отсутствует (SEO `og:image` ведёт в 404, проверено повторно 21.09 — файла всё ещё нет) — нужен дизайн-ассет. Ошибка `vue-tsc` в WIP `AdminSeoManager.vue(70)` уже исправлена на твоей стороне (перепроверка 21.09: `vue-tsc --noEmit`, exit 0).

## 2026-09-21 — Временная OG-обложка `public/og-cover.jpg` (1200×630)
- 🔧 Сгенерирована Pillow-скриптом в стилистике лендинга: тёмный градиент + светящиеся пятна, логотип UPin + «ПИЛОТ», бейдж «Гиперлокальная соцсеть», заголовок «Всё районное — на одной карте», подзаголовок, мини-статы (Пины/Знакомства/Чаты), справа стеклянная карта с маршрутом, светящимся пином, плашкой «Рядом сейчас» и карточкой «Мэтч → чат». Segoe UI (кириллица), JPEG q86.
- 🐞 По пути пойман классический грабель PIL: полупрозрачные заливки при рисовании напрямую на RGBA заменяют пиксели, а не блендятся — всё полупрозрачное рисуется на отдельном overlay-слое + `alpha_composite`.
- ⚠️ Временная заглушка до настоящего дизайна: заменить файл, когда будет ассет от дизайнера (имя и размеры 1200×630 уже зашиты в SEO-мета).
- Проверки: `getimagesize` 1200×630 JPEG 68КБ ✅, визуально ок ✅. Код не тронут — пересборка не требуется (`public/` едет как есть).
- Проверки: `php -l` ✅, `vue-tsc` по нашим файлам чисто ✅, `vite build` ✅, в бандле `pravatar|unsplash` — 0 совпадений, `/landing/hero` в `Welcome-*` ✅.

## 2026-09-21 — Lighthouse Performance 30 → фиксы (SW-флуд, API-шторм, картинки, шрифты, кэш)
- 🐞 Замер `/profile` (mobile, Moto G): FCP 3.1с, LCP 8.2с, SI 5.7с, TBT 1100мс, CLS 0.245, TTI 12.7с. Драйверы из отчёта: 221 запрос/2.5МБ (132 докачки чанков после load), ~15 API параллельно на mount, картинки 1440px в сетке 84px (~1МБ), `cacheLifetimeMs: 0` на `/build/*`, CLS от подмены figtree 700/800, LCP-аватар без приоритета, `<img src="">` в ленте.
- 🔧 SW (`vite.config.js`): прекеш был `**/*.{js,css,html,woff2}` — на первом визите качал весь билд (~130 файлов). Ужат до шелла (app/vendor/primevue/form/realtime/css + офлайн/иконки): в `sw.js` осталось ~15 записей. Ленивые чанки — новый runtime-кэш `pwa-build` (CacheFirst, 30д; имена хэшированы = иммутабельны).
- 🔧 API-шторм: новый `useIdleTask().runWhenIdle()` (`requestIdleCallback` + фолбэк, SSR no-op). `useAppLayout` перенёс 8 инитов (бейджи, presence, уведомления, пины, админ-репорты, апдейты, имперсонации, версия, realtime) в idle одним `Promise.allSettled`; `useAppBoot` — echo/SW/пуши/expo тоже в idle. Визуальное (тема, motion, сплэш, safe-area) осталось синхронным.
- 🔧 Картинки: `ImageOptimizer` — общий `resizeIntoTmp()` + `storeThumbnail()`/`deleteThumbnails()`/`thumbPathFor()` (480px/q76, `<dir>/thumbs/`); новые аплоады галереи жмутся до 1280px (`GALLERY_MAX_SIDE`); миграция `thumb_path` + `thumb_url` в сериалайзере (фолбэк на оригинал); удаление чистит превью; команда `photos:backfill-thumbs` (чанки, идемпотентна, `--dry-run`). Сетка (`ProfileDesignGallery`) грузит `thumb_url`, + `width/height` против CLS; вьювер — по-прежнему оригинал.
- 🔧 Шрифты/кэш/LCP/мелочь: `app.blade.php` — `preconnect crossorigin` + прелоад figtree 700/800 woff2 (их поздняя подмена давала CLS 0.24; async-вариант отклонён — инлайн-`onload` режется нашим CSP); новый `CacheStaticAssets` (годовой `immutable` для `/build/*`, зареган глобально); hero-аватар — `fetchpriority=high`/`eager` через `pt.image` + `aria-label→alt` (чинит и `image-alt`); `useFlowRepost.displayOf` нормализует `''→null` (убит `<img src="">`), фото поста — `width/height` + `aspect-[4/3]` + `decoding=async`.
- ⚠️ Замер был с расширениями (runWarnings; `fonts.googleapis.com Open Sans` в коде вообще нет — это инжект расширения). Перемерять в инкогнито. Порядок деплоя: 1) `migrate` (nullable-колонка, обратно совместимо), 2) код, 3) `photos:backfill-thumbs`. Следующие кандидаты (не влезли): ленивый маунт 10 диалогов лейаута (`v-if` по open-флагам, ~33КБ), avatar-thumb 256, Ziggy `only`-фильтр (`config/ziggy.php`).
- Проверки: `php -l` 7 файлов ✅, `migrate --pretend` ✅, деградация без GD (null + фолбэк, без фаталов) ✅, `vue-tsc --noEmit` ✅, `pnpm build` (клиент + SSR) ✅, прекеш `sw.js` ~15 записей ✅.

## 2026-09-20 — 504 + Failed to fetch dynamically imported module: retry в resolve
- 🐞 Симптом (dev): первая навигация на тяжёлую страницу (Dashboard, профиль) — `504` + `Failed to fetch dynamically imported module`, жёсткая перезагрузка чинит.
- 🔍 Причина: не дубли Vite (проверено — один процесс, strictPort на месте), а холодный transform: первый запрос чанка страницы тянет всё дерево зависимостей и не укладывается в таймаут прокси перед Vite. Повторный запрос забирает уже прогретый модуль — поэтому reload помогает.
- 🔧 `app.ts`: `resolvePageWithRetry` — одна повторная попытка через 800мс, затем `window.location.reload()` вместо мёртвого экрана с uncaught promise. Покрывает и прод: stale-чанк после деплоя лечится тем же путём (повтор → свежий манифест через reload).
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` (клиент + SSR) ✅.

## 2026-09-20 — Шифрование комментариев, профиля и уведомлений как чата (AES-256-GCM)
- 🔍 Аудит: чат шифровался (`MessageCrypto` + `MessageBodyCast` + `chat:encrypt-messages`), а всё остальное лежало открытым текстом: 4 таблицы комментариев, bio/thought/dating_about/dating_custom_goal, отрывки текстов в `notifications.data` (там же и actor_id — связка «кто что пишет»).
- 🔧 Новые `EncryptedTextCast` (nullable-вариант каста чата) и `EncryptedPayloadCast` (конверт `{"__enc"}` — JSON валиден, запросы по type/key не ломаются); новая модель `UserDatabaseNotification` (та же таблица). Касты: 4 модели комментов `content`, User `bio/thought/dating_about/dating_custom_goal`. Читатели/писатели переведены на новую модель; callers возвратов не используют — сигнатуры целы.
- 🔧 Миграция widen до TEXT (шифротекст длиннее plaintext): `profile_photo_comments.content`, `users.thought`, `users.dating_custom_goal`. Команда `privacy:encrypt-texts --dry-run` — бэкфилл чанками, идемпотентно, прямые DB-записи без двойного шифрования.
- ⚠️ Сознательно НЕ тронуто (решение): body/title постов и пинов — по ним SQL LIKE-поиск ленты; home_city/address/name — не сообщения + identity; reports — модерация; типы уведомлений `app.*` — открытый текст (JSON-запросы `data->update_id`).
- 🚀 Порядок деплоя строгий: 1) `migrate` (widen обратно совместим), 2) код, 3) `privacy:encrypt-texts`, иначе новые шифрозаписи обрежутся в старых VARCHAR. Ключ тот же (`MESSAGE_CRYPTO_KEY`/APP_KEY).
- Проверки: `php -l` 15 файлов ✅, раундтрип шифра/кастов/конверта + регистрация команды (15/15) ✅. Фронт без изменений (API отдаёт расшифрованное через касты).

## 2026-09-20 — Откат v-if в PageTransition: mismatch при выкл. анимациях + живой лоадер
- 🐞 Симптом (режим OFF): `Hydration node mismatch ("" vs Fragment)` на странице настроек + дёргающийся верхний лоадер.
- 🔍 Причина №1 (моя ошибка): `v-if/v-else` по `motionOff` переключал структуру дерева, когда флаг из localStorage подтягивался после монтирования. На странице настроек живёт async-компонент (`PwaInstallGuideDialog`), гидрация там асинхронная — флип ветки прилетал посреди неё: сервер отдал одно дерево, клиент достраивал другое. Откатил к одной стабильной структуре (всегда `<Transition>`); OFF по-прежнему мгновенный через `page-instant` + kill-switch. Бонус отката: тумблер больше не перемонтирует страницу целиком (не сносит состояние форм).
- 🔧 Причина №2: kill-switch глушил и верхний лоадер (инлайн-стили NProgress проигрывают `!important` — полоса шла шагами). `#mini-loader` и `#nprogress` (бар + спиннер) выведены из-под запрета id-селекторами — плавные всегда, как просили.
- ⚠️ Отдельно: `Failed to load resource 502` — сетевой, не фронтовый (в motion-пути fetch нет). Нужен URL из Network. Плюс после `pnpm build` обязательно перезапустить SSR-демон (`inertia:start-ssr`/supervisor/Herd) — иначе старая `ssr.js` отдаёт чужое дерево и mismatch вернётся сам по себе.
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` (клиент + SSR) ✅.

## 2026-09-20 — Тумблер анимаций теперь реально отключает переходы
- 🔧 Раньше OFF гасил переходы только через CSS (`page-instant` + kill-switch), а `<Transition>` всё равно монтировался и держал двойное дерево. Теперь `usePageTransition` отдаёт `motionOff` наружу, а `PageTransition` при выключенных анимациях рендерит обычный `<div>` вообще без `<Transition>` — мгновенная смена, ноль оверхеда.
- 🛡️ SSR: сервер и гидрация всегда видят ветку с `<Transition>` (`appear: false`, лишней разметки нет), переключение ветки — только клиентский патч после `onMounted`.
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` (клиент + SSR) ✅.

## 2026-09-20 — Page transition заработал по-настоящему: персистентные лейауты
- 🐞 Симптом: переходы между страницами не играли вообще —ﬠнавигация была «топорной», мгновенная смена без эффекта.
- 🔍 Причина (корневая): все 19 страниц монтировали лейаут прямо в шаблоне (`<AuthenticatedLayout>` / `<GuestLayout>` / `<component :is="Layout">`). При визите Inertia дерево целиком пересоздавалось вместе с лейаутом — `<Transition>` внутри тоже умирал и рождался заново (`appear: false`), смену страниц не видел физически. Анимировать было нечего.
- 🔧 Завершена миграция на персистентные лейауты (проводка `applyPersistentLayout` в `app.ts`/`ssr.ts` уже была, но без снятия template-обёрток давала бы ДВОЙНОЙ лейаут): из всех 19 страниц убраны template-обёртки и импорты лейаутов — Auth ×6 (GuestLayout), статичные ×10 (AuthenticatedLayout), динамические Swipes/Faq/Reference (`<component :is>` + `Layout`-computed; `isAuth` оставлен где используется в контенте). Лейаут теперь живёт между визитами, меняется только контент — кроссфейд `page-fade-slide` (opacity+transform, без блюра) играет на каждой навигации. Welcome/Maintenance остались layoutless.
- 🛡️ Проверено на stale: `route().current()` в лейаутах/топбаре — в шаблонах, пересчитываются при ре-рендере от нового слота; `menuItems.active` — в `computed` от `user` (новый объект `auth.user` каждый визит → пересчёт); `useGuestLayout` — от реактивного `page.component`; хоткеи — рантайм-проверка. SSR: `Welcome/Maintenance` исключены, первый рендер детерминирован.
- Проверки: `vue-tsc --noEmit` ✅, `pnpm build` (клиент + SSR) ✅.

## 2026-09-20 — Фриз свитчера анимаций + мёртвые переходы и улёт свайпов
- 🐞 Симптом: с выключенными анимациями клик по свитчеру фризил приложение; переходы между страницами не играли; в свайпах пропала анимация улёта карточек.
- 🔍 Причина №1 (фриз): page-transition анимировал `filter: blur(8–12px)` ВСЕГО дерева страницы — полноэкранный блюр перекрашивает страницу каждый кадр, на мобиле/WebView это фриз навигации и тумблера (переключение класса на `<html>` тоже дёргало тяжёлые transition).
- 🔍 Причина №2 (свайпы): `swipe()` всегда ждал 360мс улёт, но при `motion-off` keyframes `fly-like/fly-pass` убиты kill-switch за 0.01мс — получался мёртвый фриз 360мс на каждый свайп без визуала.
- 🔧 `app.css`: из переходов убран `filter/blur` полностью (пресеты играют только GPU-дешёвыми opacity+transform, 300/340мс, enter-delay 50мс); `prefers-reduced-motion` теперь гасит и `fly-card`/`story-fill`.
- 🔧 `useMotion`: `animationsEnabled` стал writable computed (чистый `v-model` в свитчере); новые SSR-безопасные хелперы `prefersReducedMotion()` / `shouldSkipMotion()` (на сервере всегда false — SSR-разметка детерминирована).
- 🔧 `useSwipes.swipe()`: ожидание улёта `shouldSkipMotion() ? 30 : 360` — с выключенными анимациями лента идёт дальше мгновенно, с включёнными улёт играет как раньше.
- 🔧 `SettingsAppearanceTab`: `:modelValue + @update` заменён на `v-model="animationsEnabled"`.
- 🛡️ SSR не тронут: все `window/localStorage/matchMedia` за гардами, стартовое значение `motionOff=false` на сервере и первой гидрации, `page-instant` включается только на клиенте.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-20 — Свитч анимаций инвертирован: ON = анимации включены
- 🐞 Симптом: после включения опции «Анимации» все анимации пропадали (переходы страниц + улёт свайпов) — читалось как «включил анимации», а по факту включался `motion-off`.
- 🔍 Причина: полярность свитча была негативной (ON = выключить), kill-switch `!important` гасит и transitions, и keyframes-анимации (улёт свайпов — `animation`, не `transition`, поэтому умер вместе со страницами).
- 🔧 `useMotion`: наружу — позитивные `animationsEnabled`/`setAnimationsEnabled`/`toggleAnimations` (дефолт ON), внутри тот же `motionOff`; старые `setMotionOff` оставлены как deprecated. Таб «Внешний вид»: «Анимации — плавные переходы между экранами и эффекты», ON = всё играет.
- ℹ️ У кого флаг уже успел записаться `motion-off=1` — свитч покажет OFF, один клик в ON всё вернёт.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-20 — Скринлок навсегда убивал скролл: overflow через общий менеджер
- 🐞 Симптом: включил скринлок → зашёл заново → разблокировал → страницу нельзя скроллить, лечится только перезагрузкой.
- 🔍 Причина: скролл лочили ДВЕ несогласованные системы. `useScreenLockScroll` писал `body/html.style.overflow` напрямую со своим снапшотом, а все остальные (модалки, вьюверы) — через ref-counted менеджер `useScrollLock`. При разблокировке менеджер запоминал наш `hidden` как «исходный» (оверлей ещё висел в leave-transition) и возвращал страницу в `overflow: hidden` навсегда.
- 🔧 `useScreenLockScroll`: `overflow` теперь только через `acquire/releaseScrollLock('screen-lock')` — счётчик вернёт скролл, когда закроются ВСЕ оверлеи. `position:fixed/top/width/touchAction/overscroll` менеджер не трогает — остались в локальном снапшоте, порядок в `unlockBody`: сначала release, потом свои стили, потом `scrollTo`.
- Проверки: `vue-tsc --noEmit` ✅. Ручная проверка: вкл. лок → дождаться лока → разблокировать → скролл жив; повторить с открытой модалкой поверх.

## 2026-09-20 — Тяжёлое грузится лениво: async-компоненты + swiper/realtime вне критического пути
- 🔍 Аудит: страницы Inertia уже сплитятся по роутам (`import.meta.glob` без eager), `maplibre` (~990KB) — только на `/map`. Но: `swiper` сидел в общем `vendor` (все страницы), 8 оверлеев лежали в чанке `AuthenticatedLayout` (каждая залогиненная страница), `realtime` (echo+pusher, 72KB) грузился даже гостям из `app.ts`.
- 🔧 `defineAsyncComponent`: 8 редких оверлеев в `AuthenticatedLayout` (колокол, беты, хоткеи, глобойск, мини-чат, термы, выбор режима, апдейты); `ProfilePhotoViewer` + `ChatSearchDialog` в `Profile/Show` и `Dashboard`; все 5 диалогов в `Chat/Index`; `FlowMediaCarousel`/`FlowComposerPreview` (swiper) в ленте/композере/редакторе; `PwaInstallGuideDialog` в баннере и настройках. Мгновенно нужное оставлено статикой: тосты, скринлок (приватность), `ConfirmDialog`, топбар/футер/навигация.
- 🔧 `app.ts`: `echo` — динамический импорт только при `auth.user.id` (гости минус 72KB realtime).
- 🔧 `vite.config`: чанк `swiper` — `manualChunks` до этого принудительно пихал ВЕСЬ `node_modules` в `vendor`, игнорируя async-границы. Теперь swiper в отдельном ленивом чанке (там только async-импорты; если появится статический — станет eager, следим за билдом).
- 📉 Замер (raw): `AuthenticatedLayout` 218 → 112KB (−49%), `vendor` 461 → 354KB (−23%), `swiper` 96KB lazy, `app` −1KB. PrimeVue/maplibre без изменений (UI-кит и карта по требованию).
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅, `vite build --ssr` ✅.

## 2026-09-20 — Настройка «Отключить анимации» во внешнем виде
- ✨ Новый хук `useMotion` (синглтон как `useTheme`, SSR-безопасный): флаг `motionOff` в `localStorage (motion-off)`, применяет класс `motion-off` на `<html>`, `initMotion()` вызван в `app.ts` рядом с `initTheme()`.
- 🎨 CSS kill-switch в `app.css`: `.motion-off` гасит все `transition`/`animation` и плавный скролл.
- 🔧 `usePageTransition`: при включённом флаге переходы между экранами — `page-instant` (мгновенно, без анимации).
- 🖥️ `SettingsAppearanceTab`: новая секция «Анимации» с PrimeVue `ToggleSwitch` («Выключить переходы и эффекты для скорости»).
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-20 — Залогиненных с `/` сразу в профиль, без мигания лендинга
- 🐞 Симптом: открываешь корень сайта авторизованным (ввод домена, запуск PWA со `start_url: /`) — сначала мигает стартовая Welcome-страница и только потом JS (`useLastRoute`) увозит внутрь. Промежуточный экран лишний.
- 🔧 `PageController@welcome`: ранний `return redirect()->route('dashboard')` для `auth()->check()` — серверный 302 сразу в `/profile`, лендинг рендерится только гостям. Неверифицированных `verified`-middleware на `/profile` штатно отправит на подтверждение почты.
- 🔧 `useLastRoute`: код-возврат на последний экран оставлен как страховка от протухшего PWA-кэша `/`, докблоки обновлены под новую реальность.
- Пост-логин/регистрация не трогал: там осознанный лендинг по режиму (`landingPath`: `/map` для UPin, `/swipes` для ULove).
- Проверки: `php -l` ✅, `route:list` (`dashboard → profile/{identifier?}`) ✅.

## 2026-09-20 — `insertBefore of null` остался + умерла анимация переходов: убран `mode out-in`, Teleport'ы за mount-гейтом
- 🐞 Симптом: после прошлого фикса ошибка в консоли осталась, а красивая анимация перехода между экранами вообще перестала работать. Связано напрямую: исключение бросалось посреди transition — Vue обрывал анимацию целиком.
- 🔍 Причина №1 (главная): `PageTransition` с `mode="out-in"` держал старое дерево в leave-лимбо, где vee-validate/PrimeVue-эффекты продолжали патчить уже разобранные Teleport/Portal (`insert` ← `process` ← effect в стеке). Плюс ключ был `component:url` — query-обновления и polling перезапускали transition посреди ввода в формы.
- 🔍 Причина №2: в `GuestLayout` баннеры `PwaInstallBanner`/`PwaUpdateBanner` (внутри Transition + PrimeVue Dialog с Teleport) монтировались во время гидратации, а их `visible` флипается в `onMounted` из стореджа — enter-transition во время гидратации на каждой гостевой странице (Login/Register — место краша из стека `form-*.js`).
- 🔧 `PageTransition`: убран `mode` (одновременный кроссфейд вместо `out-in` — анимация снова видна, лимбо-окна нет), добавлен `@before-leave` blur активного элемента (сфокусированный инпут в удаляемом дереве — классический триггер), `appear: false` оставлен.
- 🔧 `usePageTransition`: ключ теперь `component:path` без query/hash; удалён вращий `transitionAppear: true` (компонент использует `appear: false`); убраны `prefersReduced`/`onMounted` из хука (reduced-motion уже покрыт CSS `@media`); добавлен JSDoc.
- 🔧 `GuestLayout`: PWA-баннеры за `isClientReady`, как раньше в `AuthenticatedLayout`.
- 🔧 Сырые `<Teleport to="body">` создаются только после mount через `useMounted` из `@vueuse`: `PhotoLightbox`, `AvatarPreview`, `ProfilePhotoViewer` (3 шт.), вьювер аватара в `Profile/Show`. Все по умолчанию закрыты — визуально ноль изменений, SSR-разметка совпадает.
- ⚠️ После деплоя проверить на проде: жёсткая перезагрузка (Ctrl+Shift+R) + инкогнито без PWA-кэша, походить Login ↔ Register ↔ Map; в консоли должно быть чисто, переходы — плавный кроссфейд.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅, `vite build --ssr` ✅.

## 2026-09-20 — Прод: краш `insertBefore of null` в PrimeVue-чанке при входе
- 🐞 Симптом: на проде (только прод — там включён Inertia SSR) в консоли `TypeError: Cannot read properties of null (reading 'insertBefore')`, стек `insert (primevue-*.js)` ← `Teleport.process (form-*.js)` ← patch ← effect. В dev SSR нет — не воспроизводится.
- 🔍 Причина: не PrimeVue (его `Portal` SSR-безопасен — Teleport рендерит только после `mounted`), а наши сырые `<Teleport to="body">` + `<Transition>` (`ScreenLockOverlay`, `AvatarPreview`, `PhotoLightbox`, `ProfilePhotoViewer`, `Teleport` в `Profile/Show`) и `PageTransition` с `appear: true` + `mode out-in` поверх всего SSR-дерева. Оверлеи в layout при старте синхронно переключаются из состояния, которое сервер не видел (скринлок/термы/модалки читают localStorage/API в `onMounted`), — `Teleport.process` получает null-контейнер.
- 🔧 Новый хук `useClientReady` (mounted + `nextTick`): блок оверлеев в `AuthenticatedLayout` (тосты, модалки, скринлок, `ConfirmDialog`) монтируется только после settled-гидратации. На сервере эти оверлеи всё равно закрыты — пользы от их SSR ноль, визуально без изменений.
- 🔧 `PageTransition`: `appear` по умолчанию `false` — appear-анимация первого кадра не имеет смысла при SSR (контент уже отрисован) и роняет Teleport внутри страницы.
- 🔧 `vite.config`: `resolve.dedupe: ['vue']` — одна копия рантайма на бандл, чтобы Vue не разъезжался по чанкам `primevue/form/vendor` с несогласованными vnode.
- ⚠️ После деплоя проверить на проде: жёсткая перезагрузка (Ctrl+Shift+R) + инкогнито без PWA-кэша; если ошибка останется — прислать URL страницы и полный стек с source maps.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-20 — Баннер «Вышло обновление»: бесконечный показ после «Обновить» убран
- 🐞 Причина: `checkForBuildUpdate` залипал флагом без памяти о действии пользователя — после `refreshApp` + перезагрузки опрос снова видел mismatch (stale HTML из кэша, rolling-инстанс с другой версией, закэшированный HTTP-ответ `/api/version`) и тут же поднимал баннер снова. Клик «Обновить» зацикливался.
- 🔧 Один деплой — один баннер: `refreshApp` перед перезагрузкой пишет применённую версию в `localStorage (uconnect-applied-build)`, опрос её больше не поднимает; метка чистится сама, когда запущенная версия с ней совпала. Следующий деплой даст новый хэш — баннер покажется снова ровно один раз.
- 🔧 Опрос `GET /api/version` теперь с bust-параметром `?t=`, а `VersionController::show` отдаёт `Cache-Control: no-store` — stale-версия из HTTP-кэша исключена.
- 🔧 SW-ветка: `usePwa.applyUpdate` пишет метку времени (`uconnect-sw-applied-at`), `onUpdate` игнорит `waiting`-воркер 30 минут после применения; `useAppRefreshBanner.apply` при билдовом обновлении гасит и SW-флаг.
- Проверки: `php -l` ✅, `vue-tsc --noEmit` ✅.

## 2026-09-20 — Свайпы: фикс 500 на prod при любом свайпе
- 🐞 Причина №1 (подтверждена логом prod: `matchConversationTx(): Argument #2 ($other) must be of type User, null given`): в `recordAction` транзакция `DB::transaction(function () use ($me, $otherId, ...))` не захватывала `$other`, но использовала её в ветке мэтча — PHP подставлял `null` → `TypeError` → 500 ровно при взаимном лайке. Исправлено: `$other` добавлен в `use`.
- 🛡️ `DatingService`: новые хелперы `swipePayload()` (колонку `is_incognito` пишет только если `Schema::hasColumn` её видит) и `storeSwipe()` (гонка unique чинится перечитыванием; нет строки — повтор без инкогнито; `save` тоже с ретраем без колонки). Повторный мэтч переиспользует `Conversation::findDirect` вместо создания дубля direct-чата.
- 🗄️ Миграции: `create_swipe_tables` теперь создаёт `is_incognito` сразу; `add_incognito...` стала идемпотентной (гарды `hasTable`/`hasColumn` в `up`/`down`) — безопасна и на старых, и на свежих базах. На проде после деплоя докатить `php artisan migrate --force`.
- Проверки: `php -l` ✅.

## 2026-09-20 — Свайпы: гонки закрыты, инкогнито больше не палит id
- 🔒 Гонка взаимного лайка: весь `recordAction` теперь в одной транзакции — пара сериализуется `lockForUpdate` по ordered user-строкам (порядок одинаковый → без дедлоков), `firstOrCreate DatingMatch` с фолбэком на `QueryException` (unique `user_a/user_b`), `updateOrCreate SwipeAction` с перечитыванием при дубле unique. Уведомляет только создатель мэтча (`isNewMatch`) — двойные мэтч-тосты/пуши/чаты исключены; чат собирается чистым `matchConversationTx`, анонс (`announceMatchConversation`) после коммита.
- 🔕 Новизна лайка по факту записи (`wasRecentlyCreated || wasChanged('action')`): повторный like тихий, `pass → like` уведомляет заново, `like → pass` отзывает висящий `dating.liked` (`withdrawLike` через `deleteUnread`) — stale-пингов «тебя лайкнули» больше нет. Семантика задокументирована: последнее действие решает (строка одна, unique `liker/liked`).
- 🕵️ Инкогнито закрыто: `briefFor`, `actorShape`, `RealtimeController::brief` и карточка `admirers()` отдают `id: null` + занулённые `goal/about/interests/last_seen_at` — по пингу анкету не открыть, раскрытие только при мэтче. Фронт: `SwipeCard.id: number | null`, ключ поклонников `admirerKey()` (инкогнито — по `created_at`), гарды `null` в `swipe/swipeAdmirer/writeWithoutMatch/removeFavorite/openChat`.
- ➡️ Push о мэтче оставлен только второй стороне — сознательно: у автора модалка из ответа + `MatchCreated`/inbox на все устройства, а пуш бил бы по девайсу в руках (подавления foreground нет).
- Проверки: `php -l` 4 файла ✅, `vue-tsc --noEmit` ✅ (по пути поправлены 5 ошибок типов).

## 2026-09-20 — Свайпы + realtime: убраны двойные рефетчи и повторные пуши
- 🔔 Двойной рефетч: поллер зеркалит каждое событие парой `notify:*` + `user:*`, а `useSwipes.subscribeRealtime` слушал обе ветки — каждый лайк/мэтч давал `loadFeed+loadAdmirers` / `loadMatches+loadFavorites` дважды. Оставлена подписка только на канонические `user:match.created` / `user:swipe.liked` (сокет других имён не эмитит). Плюс `Swipes.vue` теперь отписывается в `onUnmounted` (раньше подписка висела до следующего визита).
- 🔕 Повторный лайк больше не спамит: `recordAction` переиспользует уже посчитанный `$alreadyLiked` — `notifyLiked` (inbox + `swipe.liked` + пуши) уходит только за новый лайк, даблклики и повторы тихие.
- 🛡️ Сайд-эффекты после коммита: `ensureMatchConversation` слал `MessageSent`-broadcast и пуши мэтча внутри `DB::transaction` — при rollback приходило уведомление о несуществующем чате. Транзакция теперь только пишет (чат + участники + системное сообщение), broadcast/push — после, в `broadcastMatchMessage` / `pushMatchMessage` с тем же пейлоадом.
- ⚡ `matchedIds` — один запрос с `orWhere` вместо двух `pluck` (дёргается из `favoritesCount`, `favorites`, `admirers`, `active`).
- ❌ Не подтверждено и не тронуто: `toOthers()` на серверных broadcast — `X-Socket-ID` шлётся из `api.ts`, исключается только сокет-автор, мультидевайс цел; повтор тостов после полной перезагрузки — intended (напоминание о непрочитанных, `initialShown` уже guards ремаунты); `ShouldBroadcastNow` оставлен — воркера очереди в compose нет, перевод на очередь убил бы realtime.
- Проверки: `php -l` ✅, `vue-tsc --noEmit` ✅.

## 2026-09-20 — Галерея без чекбокса анонимного лайка + промо PRO при первом лайке
- 🕵️ Чекбокс «Анонимный лайк — PRO» убран из `ProfilePhotoViewer` (сырой `input[type=checkbox]` заменён ничем — лайки фото теперь всегда открытые). Вместе с ним ушёл `incognito`-ref из `usePhotoViewer`: `onLike()` всегда шлёт `toggleLike(p, false)` и возвращает результат. Бэк (`ProfilePhotoController`, `canUseIncognitoLike`) не тронут — старые инкогнито-лайки продолжают отображаться как «Тайный поклонник».
- 💜 Первый лайк показывает красивое промо (PrimeVue `Dialog`, градиент violet→fuchsia→indigo, `base-z-index 3000` поверх вьювера): «Анонимные лайки — … нужен тариф PRO» + кнопки «Понятно» / «Выбрать PRO» (`/settings/billing`). Логика в новом хуке `useAnonymousLikePromo` (флаг `live-map:anon-like-promo-seen` через `useStorage` из vueuse — показ один раз, только не-PRO и только при постановке лайка, не при снятии).
- 💳 Опция переехала в тариф PRO: новый пункт «Анонимные лайки фото — тебя видят как „Тайного поклонника“» в `usePlanDetails` (Business покрыт через «Всё из PRO») + упоминание в FAQ-тарифах.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-19 — Убраны уведомления подписчикам о чужой репутации
- 🐞 Баг: каждое сообщение в чате начисляло автору очки (`chat_message` в `MessageController`), меняло `reputation_score` → хуки `User` слали `LevelChangedNotification` всем подписчикам → тост «Имя — репутация изменилась» при каждом сообщении. Репутация — личное дело каждого, итог каждый видит сам в недельном отчёте (`rewards.weekly`).
- 🔧 Удалены хуки `updating/updated` по репутации и временные поля `_subOldScore/_subOldLevel` в `User`, метод `UserSubscriptionNotifier::levelChanged` и класс `LevelChangedNotification`. Фронт: ветка тоста `sub_level` в `useAppNotifications` больше не пушит (история старых записей в колокольчике и `usePinActivity` продолжают их корректно отображать), подпись кнопки подписки — «Посты, пины, фото». Колонка `notify_level` и API-флаги оставлены как есть (без миграции, просто больше ничего не читают).
- Проверки: `php -l` ✅, `vue-tsc --noEmit` ✅.

## 2026-09-19 — Кнопка районов сразу открывает кисть, шторм 429 при движении карты убран
- 🎨 Кнопка-палитра возле рефреша больше не уводит в список районов: клик сразу вооружает кисть UDistrict (панель инструментов + `Alt + ЛКМ` на десктопе). На мобилке кнопка задизейблена с подсказкой, хук показывает тост «Недоступно на телефоне» и ничего не открывает. Вся логика в `useMapPage.startDistrictPaint`, `MapTopBar` только отображает проп `canDrawDistrict`.
- 🐞 Шторм 429 при панорамировании: пины (`useThrottledMapFetch` — дебаунс 1200мс, троттлинг 5с, эпсилон сдвига, пауза 15с после 429, стоп на скрытой вкладке), районы (`fetchDistrictsForView` — троттлинг 3с, пропуск микродвижений bbox, схлопывание параллельных полётов, пауза 15с после 429, стоп во время рисования), стор районов (дедуп in-flight, тихий 429 без тоста), бейджи (пакет из 6 запросов не чаще раза в 15с, `allSettled`, пауза 20с после 429, подавление фоновых синков 30с в polling-режиме, фокус через троттлинг).
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-19 — Архив без голосовых + ZIP всего, награды полностью тихие
- 📦 Архив вложений: голосовые больше не попадают в список (только фото и документы, старые NULL-kind сохранены); новая кнопка «Скачать всё ZIP» — `GET /api/chat/attachments/download-all` упаковывает всё одним ZIP с DEFLATE-сжатием (до 100 файлов / 200 МБ), временные файлы удаляются сразу после отправки, место на сервере не занимает; работает и на S3 (качает во временные файлы).
- 🔇 Награды полностью тихие: все тосты за действия убраны (`useRewardToast` только обновляет шкалу) — единое уведомление о наградах приходит раз в неделю в колокольчик.
- Проверки: `php -l` ✅, `vue-tsc` ✅, `vite build` ✅.

## 2026-09-19 — Тихие награды за мелочь: тост только за весомое и ранг-ап
- 🔇 Жалоба «каждое сообщение повышает рейтинг»: очки за мелочь (лайки, комменты, голоса, сообщения — меньше 5 ★) теперь капают молча в недельный зачёт, шкала ранга обновляется без тоста. Тост — только за весомые действия (5 ★+: пост, пин, новость, мэтч, фото, репост) и всегда за новый ранг. Итог мелочи виден в табе «Система рейтинга» и в понедельничном итоге.
- Проверки: `vue-tsc` ✅, `vite build` ✅.

## 2026-09-19 — Точки свайпа адаптивны под тёмную тему
- 🌓 Пилюля точек теперь темизируется: светлая (`bg-white/80`, тёмные точки `stone-900`) в light, тёмная (`dark:bg-black/55`, белые точки) в dark + тонкий `ring` для читаемости на любом фото. В `FlowMediaCarousel` и `FlowComposerPreview`.
- ⬛ Точки `PhotoLightbox` оставлены бело-на-тёмном — фон лайтбокса всегда чёрный (`bg-black/95`) в обеих темах, адаптивность там не нужна.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Полноэкранный свайп мышью/пальцем, стрелки только на десктопе, фикс точек
- 🐞 Точки-пилюля на мобилке были сломаны: глобальное правило `@media (max-width: 640px) button { min-height: 44px }` растягивало дотсы в овалы — точкам добавлен `!min-h-0 !min-w-0 !p-0`, снова круглые 6px (`FlowMediaCarousel`, `FlowComposerPreview`, точки лайтбокса).
- 🖼️ Полноэкранный `PhotoLightbox`: drag левой кнопкой мыши (как свайп пальцем) — кадр тянется за курсором, бросок > 60px листает; при зуме мышь панорамирует. Вся логика в `usePhotoZoom`, компонент только биндит стиль.
- 📱 Стрелки-шевроны в лайтбоксе скрыты на мобилке (`!hidden sm:!inline-flex`), вместо них — точки-пилюля внизу для навигации тапом.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Точки слайдера: маленькие аккуратные в тёмной пилюле
- ⚪ Длинная «пилюля» активного слайда убрана: теперь все точки круглые 6px, активная — ярко-белая чуть крупнее (`scale-110`), остальные — белые 45% с ховером; сидят в полупрозрачной тёмной пилюле с блюром — читаются на любом фото. Плюс `aria-current` для скринридеров. В обоих слайдерах (`FlowMediaCarousel`, `FlowComposerPreview`).
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Слайдер фото поста на мобилке: единая геометрия, стрелки убраны
- 🖼️ Фото в `FlowMediaCarousel` на мобилке теперь в uniform-боксе `aspect-[4/3]` + `object-cover`: слайды одинаковой высоты, картинка кадрируется, а не тянется; видео — тот же бокс с `object-contain` на чёрном. На десктопе (`sm:`) как было — натуральная высота до 420px.
- ❌ Кнопки-шевроны поверх картинки удалены полностью из `FlowMediaCarousel` и `FlowComposerPreview` (до этого `hidden` проигрывал PrimeVue-стилям и стрелки торчали даже на телефоне): листание — пальцем, точками и счётчиком `1/N`, с клавиатуры — стрелками.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Таб «Система рейтинга», сверка квестов, недельные итоги
- 📑 Новый таб «Задания → Система рейтинга» (профиль): недельный прогресс с капами, шкала всех рангов, полная таблица «сколько что даёт». Цифры едут из `/api/quests` (`rating_catalog` из `ActivityRewards::REWARDS` + `weekly`), поэтому описание всегда синхронно с сервером. Хук `useRatingSystem`, компонент `QuestRatingTab`.
- ✅ Сверка квестов: `QuestService::state` прогнан на живых данных — рейтинг, каталог (20), неделя, оба трека с прогрессом/целями/XP корректны; XP квестов складывается с очками активности (двойного учёта нет, капы активности квесты не режут).
- 🔔 Недельные итоги: команда `rewards:weekly-recap` (шедулер — пн 9:00) шлёт заработавшим уведомление `rewards.weekly` в колокольчик + realtime + push (заработано, ранг, титул). Уровень и титул в профиле обновляются сами — читаются из свежих пропсов, мапа титулов покрывает все 7 рангов.
- Проверки: команда выполнена (0 получателей — заработков на прошлой неделе нет) ✅, `php -l` ✅, `vue-tsc` ✅, `vite build` ✅.

## 2026-09-19 — Награды по неделям + антишулерство (повторы не платят)
- 🛡️ Капы переведены с дневных на недельные (ISO-неделя, сброс по понедельникам): таблица `REWARDS` теперь с `weekly_cap`, счёт — count-запросы по `week_key` (`o-W`).
- 🛡️ Антишулерство: новая таблица `activity_reward_claims` (миграция применена ✅) с уникальным ключом `(user, action, target_type, target_id, meta, week_key)` — повтор того же действия над тем же объектом в ту же неделю даёт 0: снял/поставил лайк, удалил/написал коммент, повторный свайп и мэтч. Бонус автору за входящий лайк привязан к паре (объект + лайкнувший). Гонки закрыты транзакцией + уникальным ключом (`QueryException` → null).
- 🔧 Все 11 контроллеров пробросили `target` в `award()` (пост/пoll/пин/фото/новость/человек); чат — только под капом без объекта. Модель `ActivityRewardClaim` с PHPDoc.
- Проверки: механика прогнана на живых данных (первый лайк +1, повтор — null без изменения счёта, другой объект — +1, тестовые данные вычищены) ✅, `php -l` ✅, дока `docs/rewards.md` переписана под недели.

## 2026-09-19 — Очки за каждую активность: баг «ранг не растёт» закрыт
- 🐞 Баг: очки давались только за закрытие месячных квестов (`QuestService`), поэтому создание постов, лайки и свайпы ранг не двигали. Теперь награждается каждое действие — см. таблицу в `docs/rewards.md`.
- ⭐ Бэк: новый `ActivityRewards` (таблица 20 действий, дневные капы в кэше, никогда не роняет основное действие); вшит в 11 контроллеров: посты/создание/лайк/коммент/репост/опрос UFlow, свайпы (+мэтч обоим), пины/создание/реакции/комменты, фото/загрузка/лайк, новости/лайки/комменты района, сообщения чата. Лайк себе не награждается, анлайки очки не трогают; автор получает бонус за входящие лайки.
- 📳 Фронт: новый `useRewardToast().applyReward(res)` — тост `+N ★` сразу после действия, повышение ранга — отдельным тостом «Новый ранг: …», шкала ранга в сторе квестов патчится свежим `rating` без перезагрузки. Подключено в 16 хуков: композер/лента/комменты/репост/опрос UFlow, свайпы (+ответные лайки), создание пина ×2 формы, реакции/комменты пина, галерея/лайк фото, новости/лайки/комменты района, чат и мини-чат.
- Проверки: `php -l` 12 файлов ✅, `vue-tsc` по тронутым файлам ✅.

## 2026-09-19 — В мини-чате не было галочек: свой id всегда был 0
- 🐞 `getUid()` мини-чата читал только `meta[name="user-id"]`/`window.userId`, которых в проекте нигде нет (только читаются, нигде не задаются) — возвращался 0, свои сообщения считались чужими: рисовались слева серыми и `MessageTicks` (`v-if="isOwn"`) не выводился вообще. Большой чат работал, т.к. берёт id из Inertia-пропсов.
- 🔧 `getUid()` в `useMiniChat` теперь сначала читает `usePage().props.auth.user.id` (как `useChat`), потом запаски meta/window — свои сообщения снова фиолетовые справа и с галочками ✓/✓✓/синие ✓✓.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Галочки доставки/прочтения в мини-окнах чата
- ✓✓ Свои сообщения в мини-окне теперь показывают тот же `MessageTicks` (✓/✓✓/синие ✓✓), что и большой чат, рядом со временем; статус резолвится общим `resolveMessageStatus` через новый хук `useMiniChatWindow` (туда же переехали `isOwn/timeOf`, скролл-прилипание и отправка — компонент только отображает).
- 📡 Живое обновление галочек: `useMiniChat` подписан на `user:message.delivered`, `user:message.read` и пакет `chat:receipts` из polling-тика — квитанции вшиваются в окна и превью списка на обоих транспортах (сокет Echo + поллер).
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Мини-окно чата вечно грузилось: сырой объект мимо реактивности
- 🐞 Окно открывалось, данные с сервера прилетали, но спиннер не гас: новое окно создавалось обычным объектом, а шаблон читает его через реактивный прокси массива — записи `win.messages/win.loading` шли мимо прокси Vue и перерендера не было. Большой чат грузился нормально, потому что там состояние изначально в `ref`.
- 🔧 Окно теперь создаётся через `reactive()` — все записи триггерят обновление; заодно загрузка ужата до одного `getConversation` (сообщения + `messages_has_more` из него же, как в большом чате) вместо двух параллельных запросов, при недоступном диалоге — понятная ошибка вместо пустого окна.
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — VK-док быстрых сообщений на десктопе (FAB справа снизу + мини-окна)
- 💬 Новый `MiniChatDock` в `AuthenticatedLayout`: круглая FAB-кнопка PrimeVue (`pi-comments`, бейдж непрочитанных) справа снизу, только десктоп (`hidden lg:flex`); клик открывает панель всех чатов (поиск, аватар, превью, время, счётчик), клик по чату — маленькое диалоговое окно `MiniChatWindow` (до 3 рядом), писать и получать можно без захода в `/chat`, внизу панели — «Открыть все чаты».
- 🪝 Вся логика — в новом хуке `useMiniChatDock` (бейдж, поиск, `displayName/avatarFor/timeOf/previewOf`, `toggleList/openChat/openAllChats`, закрытие по клику мимо через vueuse `onClickOutside`), компонент — только отображение; `useMiniChat` доработан: `myId` + `unreadTotal`, подписки на оба транспорта (`user:message.sent` с сокета Echo и `chat:message` с поллера + правки/удаления), модульный `reloadConversations` вместо недоступного `refreshList` (этот баг ронял `vue-tsc` ещё до изменений).
- 📡 Realtime и уведомления не дублируются: тосты и колокольчик как раньше едут из `useAppNotifications`/`badges` по той же шине, док лишь вшивает превью и помечает прочитанным (`markReadQuiet` + `badge.refresh`).
- Проверки: `vue-tsc --noEmit` ✅, `vite build` ✅.

## 2026-09-19 — Свайп фото в UFlow: превью композера и карусель поста на Swiper
- 🖼️ Превью при создании поста теперь листается: новый `FlowComposerPreview` (Swiper: свайп пальцем + drag мышью + клавиатура, точки, счётчик `1/4`, стрелки PrimeVue на десктопе, крестик удаления на каждом слайде) вместо статичной grid-сетки; `FlowComposer` только отображает (`:previews` + `@remove`).
- 🎠 `FlowMediaCarousel` (просмотр поста) переписан с самописного scroll-snap на Swiper — раньше на десктопе листать мышью было нечем, теперь drag + стрелки + точки + счётчик; клик по фото по-прежнему открывает лайтбокс, видео с `controls` на месте.
- 🪝 Вся логика — в новом хуке `useFlowMediaSwiper(count)` (индекс, `register/onSlideChange/go/next/prev`, поджатие индекса при удалении фото), компоненты — только отображение.
- Проверки: `vue-tsc` по новым/тронутым файлам ✅, `vite build` ✅ (остальные ошибки типов в репо — предсуществующий WIP, не тронут).

## 2026-09-19 — UFlow как Threads: опросы, медиа, хэштеги, цитаты, мощные ветки
- 📊 Опросы: `flow_polls/options/votes` (один голос, смена запрещена, дедлайн), создание вместе с постом, `POST /flow-polls/{poll}/vote|close`, `FlowPollService::serialize` с батч-картой голосов (без N+1); фронт — конструктор в композере (2–4 варианта, 1ч/24ч/7д/бессрочно), `FlowPollCard` (кнопки → проценты, закрыть автору), хук `useFlowPoll`.
- 🖼️ Медиа: `flow_post_media` (до 4 фото через `ImageOptimizer` или 1 видео ≤50МБ, взаимоисключающе), легаси `image_path` живёт для старых постов; фронт — мультипикер с превью в композере, `FlowMediaCarousel` (snap-свайп, точки, счётчик, лайтбокс для фото).
- #️⃣ Хэштеги: `tags + flow_post_tag`, `FlowHashtags::extract/sync` (кириллица, нижний регистр, ≤10, счётчики пересчётом, пустые удаляются), фильтр `?tag=` в ленте, `GET /flow-tags/trending`, чипы трендов + баннер тега, `FlowRichText` делает теги кликабельными.
- 🔁 Цитаты и отмена: `repost_comment` + опциональный `comment` в `POST /repost`, диалог репоста (цитата/убрать), `my_repost_id` батчем в ленте (без N+1), зелёное состояние кнопки, уведомление автору оригинала `flow.reposted` (колокольчик+тост+пуш).
- 💬 Ветки: сортировка new/top (`sort`, `withCount(replies)`), счётчики `replies_count`, ленивые глубокие уровни (`GET .../comments/{comment}/replies`), рекурсивный `FlowCommentItem` со сворачиванием, тост вместо unhandled rejection.
- ⚡ Оптимизация: `with(media, poll.options, tags)` в ленте, батч-карты голосов и репостов, индексы на всех новых таблицах, каскады + чистка файлов/тегов при удалении.
- Проверки: `vue-tsc` ✅, `php -l` ✅, миграции применены ✅, хэштеги/голос/сериализация прогнаны на живых данных ✅.
- 🐞 Удаление репоста + «Оригинал удалён»: `destroy()` декрементит `reposts_count` корня, `confirmDelete` откатывает флаг через `store.revertRepost` (карточка оригинала не остаётся зелёной), у цитат убран ложный «Оригинал удалён» (остаётся цитата + оригинал); дрейфанувшие счётчики пересчитаны.
- 📡 Живой UFlow + мобильная полировка: стор подписывается на `user:notification.created` и освежает видимые карточки (лайки/комменты/репосты/опросы, 404 → убрать из ленты), ветка сама перезагружается на чужих комментах (черновик цел, отправка блокирует); работает на сокетах и поллинге. Мобилка: тач-цели опроса увеличены, скроллбар чипов трендов скрыт, карусель snap+`playsinline`, диалоги на всю ширину ≤640px.
- 🎬 Видео 422: виноват PHP, а не код — `upload_max_filesize=2M` резал любое видео с телефона до Laravel. Поднято: `docker/php-uploads.ini` (64M) + `COPY` в Dockerfile, nginx `55M`, `pnpm dev` с `-d` флагами (нужен рестарт сервера!). Плюс: шире форматы (3gpp/m4v), мгновенная проверка размера/типа в композере, подсказка «до 50 МБ», русские тексты ошибок валидации.

## 2026-09-19 — Автогашение колокольчика, миниатюры в уведомлениях, репосты UFlow
- 🔔 Колокольчик гаснет сам при открытии: `BellNotificationsModal` по открытию дожидается `refresh()` (пины/события, жалобы, новости, безопасность) и вызывает новый `useNotificationsReadAll().markBellOpened()` → `readAll()` (inbox + новости + безопасность). Чаты и заявки не трогаются — счётчик сообщений остаётся, гаснет только открытием диалога.
- 🖼️ Миниатюры сущностей в уведомлениях: бэк (`UserNotification::photoShape/flowPostShape`) теперь кладёт `photo.url` и `flow_post.image_url` в пейлоады лайков/комментов/публикаций фото и всех событий UFlow (лайк, коммент, ответ, упоминание, новый пост); новый хук `useNotificationMedia().entityImage(a)` достаёт картинку, секции UFlow/Фото/Подписки в колокольчике показывают её справа (`w-11 h-11 rounded-xl`), слева как раньше — аватар автора. Старые строки без url тихо остаются без миниатюры.
- 🔁 Репосты UFlow себе на страницу: миграция `flow_posts.repost_of_id (nullOnDelete) + reposts_count`, `FlowPost::original/reposts`, `POST /api/flow-posts/{post}/repost` (свой пост — 422, репост репоста ссылается на корень цепочки, ничего не дублируется — только ссылка, подписчики узнают через `sub_flow_post`); фронт — `flowApi.repost`, хук `useFlowRepost` (тосты + `store.prepend` + `displayOf`), в `FlowPostCard` современная SVG-иконка ретвита (`RepostIcon`, в primeicons такой нет) со счётчиком (скрыта на своих), репост показывает оригинал как есть, снизу подпись «Репост от …». Репост виден в профиле и вкладке «Мои».
- Проверки: `vue-tsc --noEmit` ✅, `php -l` ✅, миграция применена ✅, роут в `route:list` ✅, сериализация репоста и пейлоады уведомлений прогнаны на живых данных ✅.
- 🐞 404 комментариев (`/api/flow-posts/5/comments`): лента показывала посты скрытых из поиска авторов, а комменты/лайки отдавали 404 из `abortIfBlocked` — `FlowPostController@index` исключал `User::hiddenFromSearchFor($viewer)` (как пины/знакомства/поиск); `useFlowComments.load()` показывает тост вместо необработанного rejection.
- 🔓 Админские посты видны всем + приватность комментов UFlow для всех: фильтр ленты больше не прячет посты админов, `abortIfBlocked` обоих flow-контроллеров пропускает discoverability-гейт для админов (блокировки действуют); новая общая настройка `users.flow_comments_privacy` (everyone|friends|none, как у фото): `User::canCommentFlowPost`, гейт 403 в `FlowPostCommentController@store`, `can_comment` в сериализации поста, `PATCH /api/user/flow-comments-privacy`, селектор в табe «Приватность» настроек (`useFlowCommentsPrivacy`), в `FlowPostCard` вместо поля ввода — «Автор ограничил комментарии». Проверено на живых данных: everyone→можно, none→нельзя, пост админа в ленте ✅.

## 2026-09-18 — Двойной баннер обновления, зум фото, @ник в ответах, иконка ответа в чате
- 🔔 Двойной баннер при деплое: `usePwaInstallBanner` теперь молчит, пока висит необработанное обновление (`needUpdate || buildUpdateAvailable`) — install-баннер сидел на той же геометрии и выглядел как дубль update-баннера; `pwa.service register()` получил in-flight guard (параллельный `register('/sw.js')` из `app.ts` + `usePwa.init()` давал двойные `updatefound`-подписки); `useAppRefreshBanner` — уходящий экземпляр больше не перехватывает владение у нового при смене лейаутов.
- 🖼️ Фото на весь экран с pinch-zoom: новое `PhotoLightbox` (Teleport `z-[3000]`, чёрный фон, свайп-листание, кнопки ±, даблтап, колесо мыши) + хуки `usePhotoZoom` (pinch с фокусом под пальцами, пан, даблтап, свайпы) и `usePhotoLightbox` (состояние открытия); подключено к `FlowPostCard` и `DistrictNewsCard` (клик по фото → лайтбокс); UGallery — Swiper Zoom (`usePhotoViewerZoom`, `maxRatio 3`, даблтап 1x↔3x) прямо во `ProfilePhotoViewer`.
- 💬 Ответы с `@ник`: `useFlowComments`/`useDistrictNewsComments` — `setReply()` подставляет `@имя ` (анониму нечего подставлять), сброс/отправка снимают только авто-префикс; `usePinDetails` — тот же механизм + `cancelReply()` теперь убирает авто-`@ник` из поля (раньше оставался); комменты фото (`useProfilePhotoComments` + `ProfilePhotoViewer`) — кнопка «Ответить» + пилюля «Ответ для @имя», упоминание едет тем же текстом (бэк уже рассылает по `Mentions::extractIds`).
- ↩️ Чат: мобильная кнопка «↩ Ответить» в `MessageBubble` заменена на иконку `pi pi-reply` (PrimeVue `Button`, `aria-label="Ответить"`), текст убран.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-18 — Install-баннер всегда предлагается + надёжная кнопка обновления
- 📲 `usePwaInstallBanner` переписан на «предлагать всегда»: убран гейт «только новички» (старые юзеры без приложения баннера вообще не видели), закрытие — это snooze на 14 дней (`PWA_INSTALL_SNOOZE_DAYS`, метка в сторедже), а не вечный отказ; легаси-метка «1» трактуется как просроченная — предложение возвращается. Виден всем гостям и юзерам без standalone; молчит только на snooze и пока висит обновление (приоритет у update-баннера).
- 🔔 Проверка цепочки обновления: `appVersion` (хэш `build/manifest.json`) шарится в пропсах, `GET /api/version` на месте, поллер `useBuildVersion` (60с + navigate/focus/online) и SW-детект `usePwa` оба поднимают один `PwaUpdateBanner` (смонтирован в обоих лейаутах, владелец один).
- 🔧 `pwa.service applyUpdate()`: кнопка «Обновить» теперь не бывает холостой — перезагрузка по `controllerchange` после `SKIP_WAITING`, а если SW сообщение не обработал, перезагрузка по таймауту 2.5с.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-18 — Баннер обновления больше не гаснет сам (latch флага)
- 🐞 Баннер появлялся и мгновенно пропадал: `checkForBuildUpdate` перезаписывал `buildUpdateAvailable = mismatch` каждым опросом — во время rolling-деплоя инстансы отдают разные версии (`V2,V1,V2…`), флаг флипповал и баннер гас. SW-канал (`needUpdate`) так гаснуть не мог — он уже залипающий, гас только билд-канал.
- 🔧 Флаг теперь залипает: раз показанное обновление держится до действий юзера (`refreshApp`/`dismissBuildUpdate` снимают как раньше); отложенная версия (`dismissBuildUpdate`) по-прежнему не поднимает баннер; опросы при залипшем флаге — дешёвый early-return.
- Проверки: `vue-tsc --noEmit` ✅, симуляция смешанного флота `[V2,V1,V2]` — до `[true,false,true]`, после `[true,true,true]` ✅.

## 2026-09-18 — Вспышка баннера на каждой навигации (hidden-first)
- 🐞 Баннер на секунду появлялся и исчезал при переходе по страницам: лейауты per-page, install-баннер перемонтируется на каждой навигации; стартовал видимым (`dismissedAt = 0`), первый paint рисовал его, а `onMounted` тут же гасил через leave-transition. У отложивших установку (snooze) — вспышка на каждом переходе.
- 🔧 `usePwaInstallBanner` стартует скрытым (`dismissedAt = Date.now()`): точная метка подтягивается в `onMounted` — кому положено, плавно выезжает enter-анимацией, кому нет, не рисуется вообще. SSR тоже детерминирован (сервер и гидрация оба скрыты).
- Заодно упрощён `useAppRefreshBanner`: выкинут механизм owner/epoch — одновременно смонтирован всегда один экземпляр, видимость стала чистой функцией залипающих флагов; владение некому терять на навигации.
- Проверки: `vue-tsc --noEmit` ✅.

## 2026-09-18 — Баннеры молчат: диагностика (snooze + стабильность версии)
- 🔍 «Вообще не показывается»: оба молчания объяснены кодом, а не поломкой. Update-баннер реагирует только на смену хэша `build/manifest.json` — правки кода с HMR версию не меняют, локально молчание корректно. Install-баннер после «Позже» уходит в snooze на 14 дней (`pwa-install-dismissed`), update после «Позже» — до следующего билда (`uconnect-dismissed-build`): кто закрывал оба при тестировании дубля, видит тишину.
- ✅ Модель видимости прогнана: fresh → виден, snoozed → скрыт, expired (20 дней) → виден снова.
- 🧪 Протокол локальной проверки: сброс ключей в консоли + `pnpm build` при открытой странице → update-баннер появляется и стоит до нажатия.

## 2026-09-18 — Стрелка ответа у сообщений чата
- ↩️ Стрелки ответа убраны полностью из `MessageBubble` (и боковые, и нижняя): ответить можно свайпом и через контекстное меню.

## 2026-09-18 — Современные табы UConnect (без белого и стрелок)
- 🎨 `ChatSidebar`: табы Чаты/ULove/Друзья/Заявки/Блок остаются, но перекрашены — явные цвета пилюль в `scoped`-стиле (`p-tab-active`: белая в светлой, `zinc-700` в тёмной; неактивные приглушены и читаются в обеих темах).
- ➡️ Убраны стрелки-навигаторы (`Tabs :showNavigators="false"` — скролл свайпом и так есть) и подчёркивающая ink-полоса (`p-tablist-active-bar` скрыта): белых краёв больше нет, фокус — тонкой фиолетовой рамкой.

## 2026-09-17 — SSR реально чиним: рендер падал, сервер был running
- 🐞 Прод отдавал пустой `div#app`, хотя `inertia:check-ssr` писал running: Node-процесс жил, но каждый рендер бросал исключение — Laravel молча откатывался в CSR. Локальный стенд (`POST /render` в `node bootstrap/ssr/ssr.js`) воспроизвёл падение.
- 🔧 `echo.ts`: топ-левел `window.Pusher/new Echo` ронял импорт SSR-бандла (тянулся через `useAuthSession`) — сайд-эффекты переехали в `initEcho()`, `app.ts` вызывает его только на клиенте.
- 🔧 `HandleInertiaRequests::share()` теперь отдаёт `ziggy` (роуты + `location`): Node не видит blade-скрипт `@routes`, без этого `route().current()` падало.
- 🧩 Новое: `@/route` — SSR-safe обёртка над Ziggy (браузер: blade-глобал, SSR: `globalThis.Ziggy` из `ssr.ts`); голый глобал `route()` выпилен из всех `.ts` и `<script>` (16 композаблов + 9 `.vue`), в шаблонах остался плагин.
- 🔧 SSR-гарды `typeof window/document === 'undefined'`: `ScreenLockOverlay` (immediate-watcher), `useBodyLock`, `useAvatarPreview` (+JSDoc).
- 📦 `package.json` `build` теперь включает `vite build --ssr` — дефолтная build-команда Cloud собирает SSR-бандл сама, `bootstrap/ssr/` остаётся в `.gitignore`.
- Проверки: пачечный рендер 16/16 страниц через локальный SSR (`Welcome`…`Admin/Index`, нулевой stderr) ✅, `vue-tsc` в составе `build:ssr` ✅. Дальше: коммит → пуш → редеплой Cloud (там только код, env/тумблер уже стоят).

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

## 2026-09-21 — SEO-центр в админке (как в WordPress)
- 🌍 Новый таб **«SEO»** в панели модерации (`/admin`): 5 секций — Общее, Страницы, Счётчики, Скрипты, Robots и Sitemap. Всё меняется динамически, в код лезть не нужно.
- 📝 Общее: site_name, title/description со счётчиками и Google-превью (как в Yoast), keywords, author, locale, OG/Twitter, цвет темы, OG-картинка, robots по умолчанию. Старые значения из `config/seo.php` — дефолты, ничего не удалено.
- 📄 Страницы: переопределения title/description/keywords/OG/canonical/robots для любого пути (`/`, `/map`, `/faq`, …) + свои пути; вкл/выкл без удаления.
- 📊 Счётчики: достаточно вставить ID — Google Analytics (G-…), GTM, Яндекс.Метрика, Facebook/VK пиксели и верификации Google/Yandex/Bing подключаются сами в `<head>`.
- 🧩 Скрипты: три слота — в `<head>`, после открытия `<body>`, перед `</body>` (чаты, A/B-тесты, виджеты). Тумблер вкл/выкл; при кастомном коде CSP сам ослабляется до `unsafe-inline`, иначе остаётся строгой (nonce).
- 🕷 Robots и Sitemap: режим авто (базовые Disallow + свои Allow/Disallow, Crawl-delay, ссылка на sitemap) или полностью свой текст; sitemap — вкл/выкл, исключения путей, доп. URL; кнопки просмотра `/robots.txt` и `/sitemap.xml`.
- Техника: `SeoSettingsService` (хранение в `app_settings` под `seo.*`, кэш, дефолты из конфига), `AdminSeoController` (`GET|PUT /api/admin/seo…`), `SeoController` переведён на сервис, `HandleInertiaRequests` шарит `seo` для SPA, `AppServiceProvider::shareSeoHead` отдаёт `$seoHead/$seoIntegrations` в blade, `SecurityHeaders` разрешает хосты аналитики; фронт — `services/admin-seo.api.ts`, `useAdminSeo`, `AdminSeoManager.vue`, `useSeo` подхватывает переопределения страниц из shared-пропсов.
- Проверки: `php -l` ✅, `route:list admin/seo` ✅ (6 роутов), tinker (global/pages/robots/sitemap + forHead) ✅, `vue-tsc --noEmit` ✅ (чисто).
