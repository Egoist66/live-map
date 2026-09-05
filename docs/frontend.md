# Frontend — как устроен и как с ним жить

Это живой путеводитель по папке `resources/js`. Читается сверху вниз: сначала идея, потом детали.

**Что за проект:** UPin — карта пинов + чат + профиль. Стек: Vue 3 + Inertia v2 (бэкенд отдает страницы, фронт их рисует без перезагрузки), Pinia (общее состояние), Pinia Colada (кэш запросов), PrimeVue (готовые кнопки/диалоги), MapLibre (карта), Echo+Reverb (живые обновления), VitePWA (установка как приложение + пуши).

**Главное правило проекта (AGENTS.md):** компонент только рисует, вся логика — в хуке `useXxx.ts` из `composables/`. То есть:

```vue
<!-- правильно -->
<script setup>
const { pins, createPin } = usePins()
</script>
```

Никаких `axios`, `watch`, `Echo` прямо в `.vue` — все это прячем в хук, чтобы можно было переиспользовать и тестировать.

**Как течет данные:** Страница `Pages/...` вызывает фасад `useMapPage` / `useChatPage` / `useSettingsPage`. Фасад собирает мелкие хуки + `stores` + `services/*.api.ts`. Сервис стучится в Laravel `/api/*`, а живые обновления прилетают по Echo-каналам `map` (все пины), `chat.{id}` (сообщения), `user.{id}` (тосты/бейджи), `online` (кто в сети).

---

## 0. Запуск: 4 файла в корне

- `app.ts` — вход. Подключает css, иконки, axios-настройки, Echo, Pinia, Inertia, PrimeVue, PWA-сервис и монтирует приложение. Ничего не экспортирует, просто запускает.
- `bootstrap.ts` — настраивает глобальный `axios`: `X-Requested-With`, куки, CSRF. Зачем: чтобы все запросы к Laravel ходили авторизованно.
- `echo.ts` — подключается к Reverb через `pusher-js`, кладет в `window.Echo`. Зачем: карта и чат обновляются без перезагрузки. Нужны `VITE_REVERB_*` в `.env`.
- `ssr.ts` — то же что `app.ts`, но для серверного рендера (`vite build --ssr`).
- Плюс конфиги: `vite.config.js` — делит бандл на куски (maplibre/primevue/realtime отдельно, чтобы грузилось быстро), включает PWA и кэширование тайлов/картинок/API. `tailwind.config.js` — цвета `brand/ink/accent`, тени, шрифты. `package.json` — `npm run dev` (сайт+reverb+vite), `npm run build` (проверка типов + сборка + копирование service-worker).

Если что-то не грузится — смотри сюда первым делом.

## 1. Pages/ — что видит пользователь

Это экраны Inertia. Они тонкие специально: только раскладывают компоненты и вызывают один фасад-хук.

- `Welcome.vue` — лендинг для гостей: герой, картинка карты, «как работает 01-03», приватность, тарифы в блюре, кнопка регистрации. Использует `useSeo` чтобы были красивые title/description.
- `Dashboard.vue` — «мой профиль»: сверху `DashboardHero` (аватар, уровень, тариф), ниже инфо и кнопки действий. Вся подготовка данных — `useDashboardPage`.
- `Map/Index.vue` — главный экран: `MapTopBar` (фильтры), `MapCreateDialog` (новый пин), `PinDetailsCard` (карточка снизу), `MapInfoDialogs` (подсказки). Мозг — `useMapPage`.
- `Chat/Index.vue` — мессенджер: слева `ChatSidebar`, справа `ChatWindow`. Мозг — `useChatPage`. На телефоне сайдбар и окно меняются местами, за это отвечают `useChatLayout` + `useChatViewport`.
- `Profile/Show.vue` — чужой профиль: шапка + инфо. Хук `useProfileShowPage` решает: можно ли написать, добавить в друзья, заблокировать.
- `Profile/Edit.vue` — настройки (8 вкладок). Хук `useSettingsPage` собирает табы, пины, невидимку, поддержку.
- `Auth/*` — вход/регистрация/забыл пароль/сброс/подтверждение. Логин и регистрация идут через `useLoginForm/useRegisterForm` (там же геолокация домашней точки + определение улицы).
- `Profile/Partials/*` — кусочки настроек: большая форма профиля (аватар, bio-редактор, дом-зона, тариф), смена пароля, удаление аккаунта.

Заблудился? Ищи экран здесь, а логику — в хуке с похожим именем.

## 2. Layouts/ — рамка вокруг страниц

- `AuthenticatedLayout.vue` — общий скелет для залогиненных: верхняя панель, меню пользователя, мобильное меню, нижний таб-бар, анимация переходов, тосты, модалка колокола, PWA-баннеры. Запускается хуком `useAppLayout`, который при входе подтягивает бейджи, онлайн-статус и уведомления.
- `GuestLayout.vue` — для гостей: слева красивая бренд-панель, справа карточка с формой. У FAQ особый широкий режим.
- `AppTopBar.vue` — шапка: лого, ссылки Профиль/Карта/Чат/FAQ, колокол с цифрой, кнопка «+ Создать пин», аватар. Получает `user, badgeTotal` и раздает события `bell/menu/drawer`.
- `AppDrawerMenu.vue` — выезжающее меню справа на телефоне.
- `AppUserMenu.vue` — попап под аватаром (профиль, настройки, выход). Стили меню централизованы в `useDropdownMenuStyle`, чтобы все выпадашки выглядели одинаково.

## 3. Components/ — кубики интерфейса

Делятся на примитивы `Ui` (глупые, только рисуют) и фичи `Features/*` (знают про домен, но логику все равно зовут из хука).

### Ui — кнопки, формы, модалки. Используй везде, не изобретай свои.
`PrimaryButton` (темная пилюля — главное действие), `SecondaryButton` (светлая — отмена), `DangerButton` (красная — удалить). `TextInput/InputLabel/InputError/Checkbox` — обертки над Prime с единым стилем. `Modal/Dropdown/DropdownLink` — диалоги и меню. Пример: форма логина собирает `TextInput + InputLabel + InputError + PrimaryButton`, а не голые `<input>`.

### Brand
`ApplicationLogo` — просто логотип. `ThemeToggle` — кнопка солнце/луна, дергает `useTheme`.

### Navigation
`NavLink/ResponsiveNavLink` — ссылки для десктопа/мобилы. `MobileBottomNav` — нижняя панель Профиль/Карта/+/Чат/FAQ с бейджем непрочитанных (читает `useBadgeStore`).

### Feedback — как показываем состояние
`GlobalNotificationToasts` — всплывашки «новое сообщение / заявка в друзья» (слушает `useAppNotifications`). `BellNotificationsModal` — колокол в шапке: заявки + последние чаты, кнопки «в чат / в заявки». `OnlineDot` — зеленая точка. `MessageTicks` — галочки ✓/✓✓ (отправка/доставка/прочитано). `PageTransition` — плавная смена страниц, уважает «уменьшить движение» в ОС.

### Dashboard/Profile/Media
`DashboardHero` — темная карточка «это я»: аватар, бейджи уровня/тарифа, кнопки карта/чат/поделиться. `DashboardInfo/DashboardActions` — факты обо мне + сетка действий. `ProfileHeaderCard/ProfileInfoCard` — то же, но про чужого: онлайн, репутация, кнопки чат/друг/блок, состояние «заблокирован». `AvatarPreview` — открыть аватар на весь экран (Esc закрывает). `BioRichEditor` — мини-редактор «о себе» (жирный/заголовки/списки/ссылка), на выходе чистый HTML.

### Map — только рисуют, думает `useMapPage`
`MapTopBar` — пилюля фильтров + счетчик «найдено N». `MapCreateDialog` — форма нового пина (заголовок, текст, категория, анонимность, радиус). `PinDetailsCard` — карточка снизу при клике на пин: просмотр/редактирование, лайки, жалобы, комментарии. `MapInfoDialogs` — две подсказки: «что за live-карта» и «мои пины, долететь».

### Chat — только рисуют, думает `useChatPage`
`ChatSidebar` — табы Чаты/Друзья/Заявки/Блок + поиск + настройка приватности. `ChatWindow` — шапка диалога, лента сообщений, поле ввода + эмодзи, меню «редактировать/удалить» по правому клику. `ChatList/MessageBubble` — строки списка и пузыри. `ChatSearchDialog` — найти человека по имени. `ChatPrivacySelect` — «кто может писать: все/друзья/никто + разрешить случайные». `ChatConfirmDialog/ChatBottomSheet` — подтверждение удаления и нижняя шторка на телефоне.

### Settings — 9 вкладок, каждая — один файл
Профиль, Тариф (план, лимиты пинов, подписки на зоны), Мои пины (сетка + удалить), Приватность (анонимность + невидимка для Pro), Внешний вид (светлая/темная/система), Безопасность (пароль + удаление), Поддержка (написать + донат с курсом НБРБ), Приложение (режим, пуши, офлайн-кэш).

### Pwa
`PwaInstallBanner` — «установить как приложение» (показывается только если браузер умеет и еще не установлено). `PwaUpdateBanner` — «вышла новая версия, обновить». `PwaPushToggle` — включатель пушей + кнопка «проверить».

## 4. composables/ — мозг приложения (63 хука)

Читать по сценариям, а не по алфавиту:

**Карта — «вижу пины вокруг»:** `useMapPage` — дирижер: берет `usePins` (список + фильтр по категории), `useMap` (сам MapLibre: рисует маркеры-пульсы, тултипы, меню владельца, слушает канал `map`), `usePinDetails` (открытая карточка: комменты, реакции, жалоба, буст), `usePinCreate/usePinEdit` (формы с zod-схемами), `useThrottledMapFetch` (не дергать API чаще чем раз в 900мс и только если сдвинулся), `useGeolocation` (где я, fallback — Минск), `useReverseGeocode` (улица по координатам через Nominatim). Типичный путь: сдвинул карту → throttled-запрос `fetchNearby` → стор обновил `pins` → `renderPins` дорисовал маркеры.

**Чат — «пишу другу»:** `useChatPage` собирает `useChat` (ядро 479 строк: диалоги, сообщения, оптимистичная отправка «показать сразу, потом подтвердить», typing через whisper, Echo-подписки, markRead/markDelivered, скролл вниз), `useFriendships`/`useBlocks` (заявки/друзья/черный список с оптимистикой — список обновляется мгновенно, откат при ошибке), `useChatFilters` (поиск по имени), `useEmojiPicker`, `useChatNavigation` (адрес `/chat/:id`, кнопка назад). Статусы галочек считает `useChatMessageStatus`.

**Кто в сети и уведомления:** `usePresence` сидит в `online`-канале + шлет heartbeat раз в минуту; `useLastSeen` рисует «в сети / был(а) 5 мин назад». `useAppNotifications` слушает личный канал `user.{id}`: прилетело сообщение или изменилась дружба — тост + звук + вибрация. `useBadgeStore` считает цифры для шапки и нижнего меню.

**Профиль и формы:** `useAuthForm/useProfileForm/usePasswordForm` — связка vee-validate+zod-схема+`router.post/patch`: валидируем локально, отправляем, показываем ошибки. `useAvatar*` — выбор файла → превью → загрузка; `useBioEditor/useSanitizedBio` — редактируем богато, показываем безопасно (режем `on*` и `javascript:`). `useProfileShare` — поделиться: системный share → буфер → prompt.

**Настройки и оформление:** `useSettingsTabs` — список 8 вкладок; `useSettingsPins` — мои пины + счетчик зон; `useTheme` — светлая/темная/система, хранится в localStorage, применяется классом `.dark`; `useInvisible` — невидимка (только Pro/admin); `usePageTransition/useDropdownMenuStyle` — анимации и единый стиль меню.

## 5. services/ + stores/ + queries/ — где живут запросы

- `services/api.ts` — один настроенный `axios` (CSRF + `X-Socket-ID` чтобы Echo не слал событие обратно мне). Все остальные сервисы используют его.
- `services/pins.api.ts`, `chat.api.ts`, `comments.api.ts`, `reactions.api.ts`, `geo.api.ts` — тонкие функции под каждый эндпоинт (`list/mine/create/toggle/report/reverseGeocode...`). Зачем отдельный слой: компонент не знает URL, легко мокать.
- `stores/pins.ts` — общая карта пинов: `pins/loading`, `fetchNearby` (отменяет прошлый запрос, склеивает до 150, прячет просроченные), `create/update/delete/boost`, `addRealtime/removeRealtime` (живые прилеты с канала `map`).
- `stores/badges.ts` — счетчики `unread/pending/total`, умеет подписаться на `user.{id}` один раз и не дублировать.
- `queries/pins.ts`, `queries/comments.ts` — кэш Pinia Colada: `nearbyPinsQuery` живет 15с, `myPins` 30с, комменты 10с. То есть повторное открытие карточки не бьет в сеть.

## 6. types/ + utils/ + validation/ + plugins/ + pwa/

- `types/entities/*` — словарь языка: `User/Pin/Message/Conversation/PinComment/Reaction/Boost/Geo` + enums (категории пинов, тарифы, приватность). Если не знаешь форму объекта — смотри сюда.
- `utils/date.ts` — «5 мин назад», дата/время по-русски (date-fns+ru). `utils/geo.ts` — расстояние haversine, попадание в квадрат.
- `validation/schemas/*` — правила на zod: пин (заголовок ≤100, текст ≤1000, радиус 500–50000), коммент (1–1000), профиль (bio ≤10000, запятая в координатах превращается в точку), пароль (мин. 8 + совпадение). Одна схема — и для подсказок в форме, и для блокировки кнопки.
- `plugins/primevue.ts` — тема UPin на базе Aura: фирменный indigo, темная тема, глобальные Toast/Confirm/Tooltip.
- `pwa/*` — чтобы работало как приложение: `pwa.service` (жизнь service-worker: регистрация, проверка обновлений, установка, онлайн/офлайн), `push.service` (подписка WebPush по vapid-ключу, разрешения браузера), `pwa.api` (сохранить/удалить подписку на бэке, тестовый пуш), `cache.service` (сколько занято, очистить кэш тайлов, проверка «готов к офлайну»), `pwa.config` (путь `/sw.js`, иконки).

## 7. Шпаргалка «где что искать»

- Новый экран? `Pages/` + фасад `use*Page`.
- Новая кнопка/поле? Сначала глянь `Components/Ui`, потом `Features/*`.
- Новая логика/запрос? Новый `useXxx.ts` + функция в `services/*.api.ts`, общее состояние — в `stores/`, кэшируемое — в `queries/`.
- Живое обновление не приходит? Проверь `echo.ts` → подписку в `useMap/useChat/useBadgeStore` → каналы в `routes/channels.php` на бэке.
- Непонятный объект? `types/entities/`.

## 8. WebSocket — живые обновления без перезагрузки

Обычный запрос — «спросил-ответили-забыли». Сокет — открытый звонок: сервер сам говорит «прилетел новый пин/сообщение». У нас это связка Laravel Reverb + `pusher-js` + `laravel-echo`.

**Подключение (`echo.ts`):** при старте `app.ts` создается `window.Echo = new Echo({ broadcaster:'reverb', key, wsHost, wsPort })` из `VITE_REVERB_*`. Нет ключа — `Echo = null`, realtime тихо выключен. Логи `[reverb] connected/disconnected/error` в консоли — смотри их первыми, если «не прилетает».

**4 канала (`routes/channels.php` на бэке):**
- `map` — публичный, слушают все. Летят `pin.created/updated/deleted`.
- `chat.{id}` — только участник диалога (`hasParticipant`). Летят `message.sent/updated/deleted/delivered/read + typing`.
- `user.{id}` — только владелец. Дублирует `message.sent` + `friendship.updated` для тостов и бейджей, даже если ты не в чате.
- `online` — presence «кто в сети». Невидимок (`isInvisibleActive()`) не пускают.

**Хитрость `X-Socket-ID` (`services/api.ts`):** каждый axios-запрос шлет свой socket-id, бэк не рассылает событие обратно отправителю. Поэтому свой же пин не прилетит тебе второй раз по сокету.

**Кто что слушает:**
- Карта `useMap.bindRealtime`: `Echo.channel('map').listen(...)` → `pinsStore.addRealtime/removeRealtime` — маркер появился/пропал сам.
- Чат `useChat`: `subscribeGlobal()` на `user.{uid}` (все мои сообщения где угодно) + `subscribeChat(id)` на `chat.{id}` (открытый диалог). `whisper('typing')` — «печатает...» летит напрямую между браузерами, без бэка, гаснет через 2.5с. Отправка оптимистичная: сообщение с `tempId` рисуется сразу, потом заменяется настоящим; дубли режет `seenIds`.
- Тосты `useAppNotifications`: слушает `user.{uid}` — чужое сообщение (и ты не в этом диалоге) → всплывашка + звук + вибрация, если вкладка скрыта — еще `showLocal` через SW. Свои игнорит.
- Бейджи `stores/badges`: тот же `user.{uid}`, только пересчитывает `unread/pending` с задержкой 400мс.
- Онлайн `usePresence`: `Echo.join('online').here/joining/leaving` — сет id в сети. Плюс `heartbeat()` — `POST /api/chat/heartbeat` раз в 60с и при возврате на вкладку (обновляет `last_seen_at`). На `beforeunload/pagehide` — `leave('online')`.

**Обрывы:** везде ретраи — не готов `Echo` → повтор через 2.5–5с, при `connected` — переподписка, при фокусе вкладки — `loadConversations/fetch()` заново.

## 9. PWA — приложение, офлайн и пуши

PWA = сайт, который устанавливается как приложение, работает без сети и шлет пуши при закрытой вкладке. Сборка — `vite-plugin-pwa (generateSW)`, код — папка `pwa/`.

**Сборка (`vite.config.js`):** генерирует `/sw.js` (фоновый помощник браузера) + `manifest.webmanifest` (имя UPin, иконки 192/512/maskable, `display:standalone`, ярлыки Карта/Чаты). В SW зашиты предкэш `js/css/html/woff2 + offline.html/иконки` и `importScripts: ['/push-sw.js']` — наш обработчик пушей.

**Что кэшируется (`runtimeCaching`):** `pwa-pages` (страницы, NetworkFirst 3с, 20 шт/сутки), `pwa-fonts` (шрифты, CacheFirst год), `pwa-map-tiles` (тайлы OSM, CacheFirst 300 шт/месяц — карта в офлайне), `pwa-images` (картинки, StaleWhileRevalidate неделя), `pwa-api` (`/api/pins|conversations` GET, NetworkFirst 4с, 5 мин).

**Жизнь SW (`pwa/pwa.service.ts` + `usePwa.ts`):** `register()` ставит `/sw.js`, слушает `updatefound → installed` и ставит флаг `needUpdate`. `PwaUpdateBanner` → «обновить», `applyUpdate()` шлет `SKIP_WAITING` + перезагрузка. `bindOnce()` ловит `beforeinstallprompt` → `canInstall=true` → `PwaInstallBanner`, `promptInstall()` показывает системный диалог. `isStandalone()/getDisplayMode()` понимают «уже как приложение», события `online/offline` обновляют индикатор.

**Пуши по шагам:** `pwa.config` берет VAPID-ключ из `<meta>` → `push.service.subscribe()`: `Notification.requestPermission` → `pushManager.subscribe({ userVisibleOnly, applicationServerKey })` → `pwa.api.savePushSubscription({ endpoint, keys })` в таблицу `push_subscriptions`. Тумблер `PwaPushToggle` дергает `usePush.toggle()`, ошибки по-русски в `describeError`. Кнопка «тест» — `POST /api/push-subscriptions/test`, fallback — локальное уведомление.

**Прилетел пуш при закрытом браузере (`public/push-sw.js`):** событие `push` → `showNotification(title/body/avatar/url)` с вибрацией. Клик `notificationclick` → ищет вкладку с этим URL и фокусит, иначе `navigate`/`openWindow`. Внутри сайта тот же формат рисует `push.service.showLocal()`.

**Настройки (`pwa/cache.service.ts` + `SettingsAppTab`):** `getEstimate()` — сколько МБ занято, `clearRuntimeCaches()` — чистка тайлов, `isOfflineReady()` — проба `/offline.html`, `persistStorage()` — просим не стирать кэш.

**Ограничения:** нужен HTTPS и собранная версия (не dev), на iOS пуши только если PWA на домашнем экране, битый Chrome лечится удалением данных сайта. Не работает — проверь `Notification.permission`, `serviceWorker.getRegistration()`, консоль `[reverb]` и `push_subscriptions` на бэке.
