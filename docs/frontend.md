# Frontend — как устроен и как с ним жить

Это живой путеводитель по папке `resources/js`. Читается сверху вниз: сначала идея, потом детали.

**Что за проект:** ULove — дейтинг: свайпы, мэтчи, чат и профиль. Стек: Vue 3 + Inertia v2 (бэкенд отдает страницы, фронт их рисует без перезагрузки), Pinia (общее состояние), Pinia Colada (кэш запросов), PrimeVue (готовые кнопки/диалоги), Echo+Reverb (живые обновления), VitePWA (установка как приложение + пуши). MapLibre остаётся только для legacy-модуля карты и не является частью бренда.

**Главное правило проекта (AGENTS.md):** компонент только рисует, вся логика — в хуке `useXxx.ts` из `composables/`. То есть:

```vue
<!-- правильно -->
<script setup>
const { pins, createPin } = usePins()
</script>
```

Никаких `axios`, `watch`, `Echo` прямо в `.vue` — все это прячем в хук, чтобы можно было переиспользовать и тестировать.

**Как течет данные:** Страница `Pages/...` вызывает фасад `useSwipes` / `useChatPage` / `useSettingsPage`. Фасад собирает мелкие хуки + `stores` + `services/*.api.ts`. Сервис стучится в Laravel `/api/*`, а живые обновления прилетают по Echo-каналам `chat.{id}` (сообщения), `user.{id}` (тосты/бейджи), `online` (кто в сети).

---

## 0. Запуск: 4 файла в корне

- `app.ts` — вход. Подключает css, иконки, axios-настройки, Echo, Pinia, Inertia, PrimeVue, PWA-сервис и монтирует приложение. Ничего не экспортирует, просто запускает.
- `bootstrap.ts` — настраивает глобальный `axios`: `X-Requested-With`, куки, CSRF. Зачем: чтобы все запросы к Laravel ходили авторизованно.
- `echo.ts` — подключается к Reverb через `pusher-js`, кладет в `window.Echo`. Зачем: мэтчи, уведомления и чат обновляются без перезагрузки. Нужны `VITE_REVERB_*` в `.env`.
- `ssr.ts` — то же что `app.ts`, но для серверного рендера (`vite build --ssr`).
- Плюс конфиги: `vite.config.js` — делит бандл на куски (maplibre/primevue/realtime отдельно, чтобы грузилось быстро), включает PWA и кэширование тайлов/картинок/API. `tailwind.config.js` — цвета `brand/ink/accent`, тени, шрифты. `package.json` — `npm run dev` (сайт+reverb+vite), `npm run build` (проверка типов + сборка + копирование service-worker).
- Локальный офлайн-кэш данных: `db/app.db.ts` — IndexedDB (настройки и кэш данных, per-user), читается раньше сети.

Если что-то не грузится — смотри сюда первым делом.

## 1. Pages/ — что видит пользователь (18 файлов)

Это экраны Inertia. Они тонкие специально: только раскладывают компоненты и вызывают один фасад-хук.

- `Welcome.vue` — лендинг для гостей: герой, картинка карты, «как работает 01-03», приватность, тарифы в блюре, кнопка регистрации. Залогиненным показывает кнопку «Карта». Внизу общий `AppFooter`. Использует `useSeo` чтобы были красивые title/description.
- `Dashboard.vue` — «мой профиль»: сверху `DashboardHero` (аватар, уровень, тариф), ниже инфо и кнопки действий. Вся подготовка данных — `useDashboardPage`.
- `Map/Index.vue` — главный экран: `MapTopBar` (фильтры), `MapCreateDialog` (новый пин), `PinDetailsCard` (карточка снизу), `MapInfoDialogs` (подсказки). Мозг — `useMapPage`.
- `Chat/Index.vue` — мессенджер: слева `ChatSidebar`, справа `ChatWindow`. Мозг — `useChatPage`. На телефоне сайдбар и окно меняются местами, за это отвечают `useChatLayout` + `useChatViewport`.
- `Profile/Show.vue` — чужой профиль: шапка + инфо + галерея (`ProfileGalleryDialog`, `ProfilePhotoViewer`, `ProfileFriendsDialog`). Хук `useProfileShowPage` решает: можно ли написать, добавить в друзья, заблокировать.
- `Profile/Edit.vue` — настройки. Роутится `/settings/:tab?` + `?tab=` (синхронизация URL в `useSettingsTabs`), хук `useSettingsPage` собирает табы.
- `Admin/Index.vue` — админка (только `is_admin`): табы `stats/manage/security/admin/refs/seo` (Справочники — `AdminReferencesManager` + `useAdminReference`, SEO — `AdminSeoManager` + `useAdminSeo` + `services/admin-seo.api.ts`). Мозг — 10 хуков `useAdmin*` (см. §4).
- `Faq.vue` — FAQ (`useFaq`). `Maintenance.vue` — заглушка техработ (`useAppMaintenance`).
- `Swipes.vue` — дейтинг-лента 18+: карточка кандидата (фото, имя/возраст, цель, город, км, интересы, bio), drag-свайп, кнопки пас/лайк/написать, мэтчи сверху, фильтры+приватность в диалоге, гейт возраста, модалка мэтча. Мозг — `useSwipes` + `dating.api`.
- `Reference.vue` — справочная страница (`props.slug`): грузит `usePublicReference`, рисует текст, блок организации, документы; пусто — заглушка «не заполнена».
- `Auth/*` — вход/регистрация/забыл пароль/сброс/подтверждение. Логин и регистрация идут через `useLoginForm/useRegisterForm` (там же геолокация домашней точки + определение улицы).
- `Profile/Partials/*` — кусочки настроек: большая форма профиля (аватар, bio-редактор, дом-зона, тариф), смена пароля, удаление аккаунта.

Заблудился? Ищи экран здесь, а логику — в хуке с похожим именем.

## 2. Layouts/ — рамка вокруг страниц

- `AuthenticatedLayout.vue` — общий скелет для залогиненных: верхняя панель, меню пользователя, мобильное меню, нижний таб-бар, анимация переходов, тосты, модалка колокола + второй колокол активности пинов, модалка обновлений, PWA-баннеры, `ScreenLockOverlay`, `AdminImpersonateBanner` («вы под юзером X»). Запускается хуком `useAppLayout`, который собирает `bell + pinActivity + updates` при входе.
- `GuestLayout.vue` — для гостей: слева красивая бренд-панель, справа карточка с формой. У FAQ особый широкий режим.
- `AppTopBar.vue` — шапка: лого, ссылки Карта/Чат/FAQ + иконка Свайпы (тултип), колокол заявок + колокол `pin.activity`, кнопка «+ Создать пин», аватар. Пункта «Профиль» нет — профиль через аватар → Настройки. Получает `user, badgeTotal` и раздает события `bell/menu/drawer`.
- `AppDrawerMenu.vue` — выезжающее меню справа на телефоне: Настройки, Карта, Чат, Свайпы, Админ-панель (админам), «+ Создать пин», футер с юзером и выходом.
- `AppFooter.vue` — общий подвал (`useAppFooter`): FAQ, Контакты, Политика, Оферта. Стоит в `AuthenticatedLayout` (кроме карты/чата), `GuestLayout` (FAQ) и `Welcome`.
- `AppUserMenu.vue` — попап под аватаром (профиль, настройки, выход). Стили меню централизованы в `useDropdownMenuStyle`, чтобы все выпадашки выглядели одинаково.

## 3. Components/ — кубики интерфейса

Делятся на примитивы `Ui` (глупые, только рисуют) и фичи `Features/*` (знают про домен, но логику все равно зовут из хука).

### Ui — кнопки, формы, модалки. Используй везде, не изобретай свои.
`PrimaryButton` (темная пилюля — главное действие), `SecondaryButton` (светлая — отмена), `DangerButton` (красная — удалить). `TextInput/InputLabel/InputError/Checkbox` — обертки над Prime с единым стилем. `Modal/Dropdown/DropdownLink` — диалоги и меню. Пример: форма логина собирает `TextInput + InputLabel + InputError + PrimaryButton`, а не голые `<input>`.

### Brand
`ApplicationLogo` — просто логотип. `ThemeToggle` — кнопка солнце/луна, дергает `useTheme` (`useAppearanceTheme` — алиас).

### Navigation
`NavLink/ResponsiveNavLink` — ссылки для десктопа/мобилы. `MobileBottomNav` — нижняя панель Профиль/Карта/Свайпы/Чат на всю ширину (grid, safe-area, актив = цвет иконки, бейдж непрочитанных; читает `useBadgeStore` + `useChatBadges`).

### Feedback — как показываем состояние
`GlobalNotificationToasts` — всплывашки «новое сообщение / заявка в друзья / активность пина / имперсонация» (слушает `useAppNotifications`). `BellNotificationsModal` — колокол в шапке: заявки + последние чаты, кнопки «в чат / в заявки» (данные из `useBellNotifications`). `OnlineDot` — зеленая точка. `MessageTicks` — галочки ✓/✓✓ (отправка/доставка/прочитано). `PageTransition` — плавная смена страниц, уважает «уменьшить движение» в ОС. `AppUpdateModal` — «что нового» (очередь из `useAppUpdates`, не путать с `PwaUpdateBanner` — тот про новую версию SW).

### Dashboard/Profile/Media
`DashboardHero` — темная карточка «это я»: аватар, бейджи уровня/тарифа, кнопки карта/чат/поделиться. `DashboardInfo/DashboardActions` — факты обо мне + сетка действий. `ProfileHeaderCard/ProfileInfoCard` — то же, но про чужого: онлайн, репутация, кнопки чат/друг/блок, состояние «заблокирован». `ProfileGalleryDialog/ProfilePhotoViewer` — галерея фото профиля (свайп — `usePhotoViewerSwiper`, загрузка — `useGalleryDialogUpload`). `ProfileFriendsDialog` — список друзей. `AvatarPreview` (+ `useAvatarPreview/useAvatarUpload`) — открыть аватар на весь экран (Esc закрывает). `BioRichEditor` — мини-редактор «о себе» (жирный/заголовки/списки/ссылка), на выходе чистый HTML.

### Map — только рисуют, думает `useMapPage`
`MapTopBar` — пилюля фильтров + счетчик «найдено N» (`useFilterDialog`). `MapCreateDialog` — форма нового пина (заголовок, текст, категория incl. `useCustomCategories`, анонимность, аудитория `usePinAudience all|male|female`, радиус, блюр `useLocationBlur`, отложенная публикация). `PinDetailsCard` — карточка снизу при клике на пин: просмотр/редактирование, лайки, жалобы (`useReportDialog`), комментарии, кнопка «написать автору» (`useMapPinChat/usePinChat`). `MapInfoDialogs` — две подсказки: «что за live-карта» и «мои пины, долететь» (`useMapOverlays`).

### Chat — только рисуют, думает `useChatPage`
`ChatSidebar` — табы Чаты/Друзья/Заявки/Блок + поиск + настройка приватности. `ChatWindow` — шапка диалога, лента сообщений, закрепы (`usePinnedMessages`), поле ввода + эмодзи + `@упоминания` (`useMentionInput/useMentions`), меню «редактировать/удалить/закрепить» по правому клику (`useMessageContextMenu`). `ChatList/MessageBubble` — строки списка и пузыри (статусы — `useMessageStatus`). `ChatSearchDialog` — найти человека (`useChatSearchUser/usePeopleSearch`). `ChatPrivacySelect` — «кто может писать: все/друзья/никто + разрешить случайные». `ChatConfirmDialog/ChatBottomSheet` — подтверждение удаления и нижняя шторка на телефоне.

### Settings — 9 вкладок + скрытая admin (см. `useSettingsTabs`)
Порядок: `profile, billing, pins, privacy, appearance, security, procedures, support, app` + условный `admin` (только `is_admin`). Вкладка `procedures` скрыта, пока нет записей (`useSecurityImpersonations.items/unread`). URL синхронизируется: `/settings/:tab`.
Файлы: Профиль, Тариф (план, лимиты `usePlanLimits/usePinLimit`, подписки на зоны), Мои пины (сетка + отложенные/архивные через `useScheduledPins` + удалить), Приватность (анонимность + невидимка для Pro + приватность комментов фото `usePhotoCommentsPrivacy` + скрытые друзья `useHiddenFriends`), Внешний вид, Безопасность (пароль + удаление + screen-lock `SettingsScreenLock`), Процедуры (`SettingsProceduresTab` — журнал «админ заходил подо мной»), Поддержка (написать + донат с курсом НБРБ — `NbrbCalculator`, `useNbrb/useDonate/useSupportExchange`), Приложение (режим, пуши, офлайн-кэш `usePwaSettings`), Админ (`SettingsAdminTab` — короткое зеркало админки).

### Admin (11 файлов) — только рисуют, думают `useAdmin*`
`AdminStatsCards/AdminActivityChart/AdminOnlineList` (мониторинг `useAdminMonitoring`), `AdminUsersManager` (поиск/бан/видимость/удаление `useAdminUsers`), `AdminUpdatesManager` (CRUD обновлений `useAdminAppUpdates`), `AdminMaintenanceManager` (техработы `useAppMaintenance`), `AdminLoginAttempts` (`useAdminLoginAttempts`), `AdminImpersonationLogs` + `AdminImpersonateDialog` + `AdminImpersonateBanner` (`useAdminImpersonationLogs/useAdminImpersonate`; баннер на мобилке в 2 строки), `AdminReferencesManager` (справочники: табы разделов, публикация-тогл, загрузка/удаление файлов, модалка с отдельной zod-формой под раздел — `useAdminReference`).

### Pwa / Security
`PwaInstallBanner` (`usePwaInstallBanner`), `PwaUpdateBanner`, `PwaPushToggle` (`usePush`). `Security/ScreenLockOverlay` — оверлей PIN4/alpha8 (`useScreenLock`, визуальная клавиатура `useVisualKeyboard`, скролл-лок `useScreenLockScroll`). Забытый код: ссылка «Забыл код? Сбросить» открывает диалог (`useScreenLockReset`) — код на почту (PrimeVue `InputOtp`) или переход в бота `@U1ove_bot`; после подтверждения `useScreenLock.resetByRemote` стирает локальную запись, сокет-событие `user:screen-lock.reset` и polling `screen_lock_reset_at` снимают локер на всех устройствах.

## 4. composables/ — мозг приложения (118 хуков)

Читать по сценариям, а не по алфавиту:

**Карта — «вижу пины вокруг»:** `useMapPage` — дирижер: берет `usePins` (список + фильтр по категории), `useMap` (сам MapLibre: рисует маркеры-пульсы, тултипы, меню владельца, слушает канал `map` + `.pin.activity` для счетчиков без перезагрузки), `usePinDetails` (открытая карточка: комменты, реакции, жалоба, буст), `usePinCreate/usePinEdit/usePinForm` (формы с zod-схемами `createPin/updatePin/comment`), `useThrottledMapFetch` (не дергать API чаще чем раз в 900мс и только если сдвинулся), `useGeolocation/useGeo` (где я, fallback — Минск), `useReverseGeocode` (улица по координатам через Nominatim), `useCustomCategories` (свои категории), `usePinAudience` (all|male|female), `useLocationBlur` (блюр 0/300/1000..5000), `usePinExpiry/usePinLifetime` (сколько жить), `useScheduledPins` (отложенные/архивные, Colada `['pins','scheduled']` 30с), `useMapPinChat/usePinChat` («написать автору» через `chatApi.status/createConversation`). Типичный путь: сдвинул карту → throttled-запрос `fetchNearby` → стор обновил `pins` → `renderPins` дорисовал маркеры.

**Чат — «пишу другу»:** `useChatPage` собирает `useChat` (ядро: диалоги, сообщения, оптимистичная отправка «показать сразу, потом подтвердить», typing через whisper, Echo-подписки, markRead/markDelivered, скролл вниз), `usePinnedMessages` (закрепленные: `chatApi.pinned/pin/unpin`, слушает `.message.pinned` в `chat.{id}`), `useFriendships`/`useBlocks` (заявки/друзья/черный список с оптимистикой), `useHiddenFriends` (скрытые друзья `toggleHidden`, лимиты free1/pro3/business∞), `useChatFilters` (поиск по имени), `useEmojiPicker`, `useMentionInput/useMentions` (`@Имя`, regex `MENTION_RE`), `useChatNavigation` (адрес `/chat/:id`, кнопка назад), `useChatSearchUser/usePeopleSearch/useProfilePeople` (поиск людей), `useChatBadges/useChatOnline` (бейджи/онлайн в чате). Статусы галочек считает `useChatMessageStatus` (+ `useMessageStatus`).

**Галерея — «мои фото»:** `useProfileGallery` (список/загрузка, лимиты free3/pro6/business15, `galleryApi`), `useProfilePhotoComments` (комменты `galleryCommentsApi`), `usePhotoViewer/usePhotoViewerSwiper` (просмотр), `useGalleryDialogUpload` (загрузка из диалога), `usePhotoCommentsPrivacy/usePrivacySettings` (кто может комментировать).

**Колокола и обновления:** `useAppLayout` собирает `bell + pinActivity + updates`. `useBellNotifications` — заявки/чаты. `usePinActivity` — активность пинов (`pinActivityApi.list/unreadCount/markRead`, Echo `PinActivityCreated`, синглтон `activities/unread`). `useAppNotifications` слушает личный канал `user.{id}`: сообщение, дружба, `.report.created`, `.impersonation.started` — тост + звук + вибрация, игнор своих и при залоченном экране; если вкладка скрыта — `showLocal` через SW. `useBadgeStore` считает цифры для шапки и нижнего меню. `useAppUpdates` — «что нового» (`appUpdatesApi.list/unread/markRead/markAllRead`, очередь `queue/history/unreadCount` + `AppUpdateModal`).

**Кто в сети:** `usePresence` сидит в `online`-канале + шлет heartbeat раз в минуту; `useLastSeen` рисует «в сети / был(а) 5 мин назад». `useChatOnline` — то же внутри чата.

**Профиль и формы:** `useAuthForm/useProfileForm/usePasswordForm` — связка vee-validate+zod-схема+`router.post/patch`. `useAvatar*/useAvatarPreview/useAvatarUpload` — выбор файла → превью → загрузка; `useBioEditor/useSanitizedBio` — редактируем богато, показываем безопасно. `useProfileShare` — поделиться. `useBirthDate/useGender/useResidence/useUserAge/useUserProfile` — поля профиля (возраст, пол, страна/домашний адрес с проверкой `useCountryMismatch`). `useHomeZone/useHomeZoneVisibility/useHomeLocation` — дом-зона.

**Настройки и оформление:** `useSettingsTabs` — 9 вкладок + `admin` (см. §3); `useSettingsPins` — мои пины + счетчик зон; `useSettingsPage/useSettingsSupport` — фасад и поддержка; `useTheme` (`useAppearanceTheme` — алиас) — светлая/темная/система; `useInvisible` — невидимка (только Pro/admin); `usePageTransition/useDropdownMenuStyle/usePageScrollLock/useBodyLock` — анимации и локи; `usePlanLimits/usePinLimit` — лимиты тарифа; `useNbrb/useDonate/useSupportExchange` — курсы НБРБ и донат (`/api/nbrb/*`); `useScreenLock` (+ `useScreenLockScroll`, `useVisualKeyboard`) — PIN4/alpha8 (IndexedDB per-user через `db/screenlock.db.ts`, fallback localStorage, хеш PBKDF2-SHA-256; на сервер уходит только флаг `is_sl_active` и сброс через `services/screenlock.api.ts`); `useScreenLockReset` — диалог сброса забытого кода (письмо/бот); `useSecurityImpersonations` — «Процедуры» (журнал входов админа, Echo `.impersonation.started`); `usePwa/usePwaSettings/usePwaInstallBanner/usePush` — PWA и пуши; `useSeo` (подхватывает переопределения страниц из shared-пропса `seo.page` — админка → SEO → Страницы) + `useFaq/useNavigation/useMobileBottomNav/useFilterDialog/useLongPress/useReportDialog/usePinCommentInput/usePasswordVisibility/useAppConfirm` — мелкие UI.

**Админка (9 хуков):** `useAdminUsers` (поиск/бан/видимость/удаление), `useAdminReports` (жалобы, Echo `.report.created`), `useAdminMonitoring` (графики/онлайн), `useAdminLoginAttempts` (логины), `useAdminImpersonationLogs` + `useAdminImpersonate` (журнал + «зайти под юзером»), `useAdminAppUpdates` (CRUD обновлений), `useAdminReference` (справочники: vee-validate-форма, схема переключается по разделу `contacts|privacy|offer`), плюс `useAppMaintenance` (техработы).

**Свайпы:** `useSwipes` — лента/индекс/драг (порог 110px), мэтчи, квота, фильтры (`goal/gender/age_min/age_max/radius_km/interests`, сброс = все), гейт 18+ (`verifyAge` один раз), `loadFeed/loadMore` (договорка за 3 карточки до конца), `swipe/act`, `openChat/writeWithoutMatch`, приватность.

**Справочники и подвал:** `useAppFooter` (4 ссылки), `usePublicReference(slug)` (загрузка публичной страницы, `notFound`), `useMobileBottomNav` (`dashboardHref/isActive/total`).

## 5. services/ + stores/ + queries/ — где живут запросы

- `services/api.ts` — один настроенный `axios` (CSRF + `X-Socket-ID` чтобы Echo не слал событие обратно мне). Все остальные сервисы используют его.
 - Всего 14 сервисов: `pins.api.ts` (`list/mine/show/scheduled/archived/create/update/remove/boost`), `chat.api.ts` (диалоги/сообщения/typing + `toggleHidden/publicFriends/pinnedMessages/pinMessage/unpinMessage/status`), `comments.api.ts` (`list/create/update/remove`), `reactions.api.ts` (`toggle/report`), `gallery.api.ts` (`galleryApi.list/upload/updateCaption/replace/remove/toggleLike/updatePrivacy` + `galleryCommentsApi.list/create/remove`), `pinActivity.api.ts` (`list/unreadCount/markRead` → `/api/pin-activities*`), `app-updates.api.ts` (`appUpdatesApi.list/unread/markRead/markAllRead` + `adminUpdatesApi.list/create/update/remove`), `reference.api.ts` (`referenceApi.show` + `adminReferenceApi.list/create/update/remove/uploadAttachment/removeAttachment`, типы `ReferencePage/ReferenceMeta/ReferenceAttachment`), `dating.api.ts` (`feed/act/matches/admirers/active/favorites/undo/boost/purchaseExtras/resetHistory/quota/updateSettings/verifyAge`, типы `SwipeCard/SwipeFilters/SwipeQuota/SwipeExtras`), `admin.api.ts` (`searchUsers/setVisibility/deleteUser/impersonate/stopImpersonation/updateUser/reports/resolveReport/overview/chart/exportExcel/online/users/loginAttempts/banUser/unbanUser/maintenance/updateMaintenance`), `custom-categories.api.ts` (`list/create/remove`), `geo.api.ts` (`reverseGeocode*`). Зачем отдельный слой: компонент не знает URL, легко мокать.
- `stores/pins.ts` — общая карта пинов: `pins/loading`, `fetchNearby` (отменяет прошлый запрос, склеивает до 150, прячет просроченные), `create/update/delete/boost`, `addRealtime/removeRealtime` (живые прилеты с канала `map`).
- `stores/badges.ts` — счетчики `unread/pending/total`, умеет подписаться на `user.{id}` один раз и не дублировать.
- `queries/pins.ts`, `queries/comments.ts` — кэш Pinia Colada: `nearbyPinsQuery` живет 15с, `myPins` 30с, комменты 10с. Галерея/активности/обновления/админ — без отдельных query-файлов, Colada вызывается прямо в хуках (напр. `scheduledPinsQuery` в `useScheduledPins`).

## 6. types/ + utils/ + validation/ + plugins/ + pwa/

- `types/entities/*` — словарь языка: `User/Pin/Comment(пин)/Reaction/Boost/Geo` + enums (категории пинов, тарифы, приватность). `Chat.ts` (Message/Conversation/Friendship с `is_pinned/pinned_at/is_hidden`) и `api/pagination.ts` лежат рядом, но не реэкспортируются из `entities/index.ts` — импортируй напрямую. Если не знаешь форму объекта — смотри сюда.
- Новые типы живут рядом с кодом: `GalleryPhoto/GalleryComment` (`services/gallery.api.ts`), `PinActivityItem` (`services/pinActivity.api.ts`), `ScreenLockRow` (`db/app.db.ts`), `MentionUser` (`composables/useMentions.ts`), `NbrbCurrency/NbrbRate/NbrbConvertResult` (`composables/useNbrb.ts`), `ImpersonationEntry` (`composables/useSecurityImpersonations.ts`), `CustomCategoryDef` (`composables/useCustomCategories.ts`). Расширения старых: `Pin` — `scheduled/archived, publish_at/is_scheduled, real_*/blur_*, gender_audience, priority`; `User` — `role/is_admin/is_moderator/plan`.
- `utils/date.ts` — «5 мин назад», дата/время по-русски (date-fns+ru). `utils/geo.ts` — расстояние haversine, попадание в квадрат. `utils/birthDate.ts`, `utils/validation.ts` — возраст и хелперы форм.
 - `validation/schemas/*` — правила на zod: пин (заголовок ≤100, текст ≤1000, радиус 500–500000), коммент (1–1000), профиль (bio ≤10000, запятая в координатах превращается в точку), пароль (мин. 8 + совпадение), screenlock (pin4/alpha8), справочники `reference.schema.ts` (contacts: обязательные реквизиты ООО + ИНН 10/12, ОГРН 13/15, email; privacy/offer: текст от 50 + версия/дата; кнопка активна только при `meta.valid`). Одна схема — и для подсказок в форме, и для блокировки кнопки.
- `plugins/primevue.ts` — тема ULove на базе Aura: фирменный indigo, темная тема, глобальные Toast/Confirm/Tooltip.
- `pwa/*` — чтобы работало как приложение: `pwa.service` (жизнь service-worker: регистрация, проверка обновлений, установка, онлайн/офлайн), `push.service` (подписка WebPush по vapid-ключу, разрешения браузера), `pwa.api` (сохранить/удалить подписку на бэке, тестовый пуш), `cache.service` (сколько занято, очистить кэш тайлов, проверка «готов к офлайну»), `pwa.config` (путь `/sw.js`, иконки). Настройки кэша из интерфейса — `usePwaSettings` в `SettingsAppTab`.

## 7. Шпаргалка «где что искать»

- Новый экран? `Pages/` + фасад `use*Page`.
- Новая кнопка/поле? Сначала глянь `Components/Ui`, потом `Features/*` (админка — `Features/Admin`, галерея — `Features/Profile`, обновления — `Features/Updates`, блокировка — `Features/Security`).
- Новая логика/запрос? Новый `useXxx.ts` + функция в `services/*.api.ts`, общее состояние — в `stores/`, кэшируемое — в `queries/` или Colada прямо в хуке.
- Живое обновление не приходит? Проверь `echo.ts` → подписку в `useMap/useChat/usePinActivity/usePinnedMessages/useBadgeStore` → каналы в `routes/channels.php` на бэке.
- Непонятный объект? `types/entities/` + типы рядом с сервисом/хуком (`GalleryPhoto`, `PinActivityItem`, `ImpersonationEntry`).
- Настройки? `useSettingsTabs` (порядок и видимость) + `Profile/Edit.vue`.

## 8. WebSocket — живые обновления без перезагрузки

Обычный запрос — «спросил-ответили-забыли». Сокет — открытый звонок: сервер сам говорит «прилетел новый пин/сообщение». У нас это связка Laravel Reverb + `pusher-js` + `laravel-echo`.

**Подключение (`echo.ts`):** при старте `app.ts` создается `window.Echo = new Echo({ broadcaster:'reverb', key, wsHost, wsPort })` из `VITE_REVERB_*`. Нет ключа — `Echo = null`, realtime тихо выключен. Логи `[reverb] connected/disconnected/error` в консоли — смотри их первыми, если «не прилетает».

**4 канала (`routes/channels.php` на бэке):**
- `map` — публичный, слушают все. Летят `pin.created/updated/deleted` + `pin.activity` (счетчики реакций/комментов — обновляют маркеры без перезагрузки).
- `chat.{id}` — только участник диалога (`hasParticipant`). Летят `message.sent/updated/deleted/delivered/read + typing + message.pinned` (закреп/откреп).
- `user.{id}` — только владелец. Дублирует `message.sent` + `friendship.updated` + `pin.activity` (мои уведомления) + `report.created` (админам) + `impersonation.started` (цели) — для тостов и бейджей, даже если ты не в чате.
- `online` — presence «кто в сети». Невидимок (`isInvisibleActive()`) не пускают.

**Хитрость `X-Socket-ID` (`services/api.ts`):** каждый axios-запрос шлет свой socket-id, бэк не рассылает событие обратно отправителю. Поэтому свой же пин не прилетит тебе второй раз по сокету.

**Кто что слушает:**
- Карта `useMap.bindRealtime`: `Echo.channel('map').listen(...)` → `pinsStore.addRealtime/removeRealtime` — маркер появился/пропал сам, счетчики обновились по `.pin.activity`.
- Чат `useChat`: `subscribeGlobal()` на `user.{uid}` (все мои сообщения где угодно) + `subscribeChat(id)` на `chat.{id}` (открытый диалог). `whisper('typing')` — «печатает...» летит напрямую между браузерами, без бэка, гаснет через 2.5с. Отправка оптимистичная: сообщение с `tempId` рисуется сразу, потом заменяется настоящим; дубли режет `seenIds`.
- Закрепы `usePinnedMessages`: `Echo.private(chat.{id}).listen('.message.pinned')` — список закрепов обновляется у обоих участников сразу.
- Активность `usePinActivity`: `Echo.private(user.{uid}).listen('.pin.activity/PinActivityCreated')` — колокол + синглтон `activities/unread`.
- Тосты `useAppNotifications`: слушает `user.{uid}` — чужое сообщение (и ты не в этом диалоге) → всплывашка + звук + вибрация, если вкладка скрыта — еще `showLocal` через SW. Свои игнорит, при залоченном экране (`useScreenLock().locked`) молчит. Сюда же прилетают `.report.created` (админам) и `.impersonation.started` (цели).
- Бейджи `stores/badges`: тот же `user.{uid}`, только пересчитывает `unread/pending` с задержкой 400мс.
- Онлайн `usePresence`: `Echo.join('online').here/joining/leaving` — сет id в сети. Плюс `heartbeat()` — `POST /api/chat/heartbeat` раз в 60с и при возврате на вкладку (обновляет `last_seen_at`). На `beforeunload/pagehide` — `leave('online')`.
- Безопасность `useSecurityImpersonations`: `Echo.private(user.{uid}).listen('.impersonation.started')` — вкладка «Процедуры» оживает сама.

**Обрывы:** везде ретраи — не готов `Echo` → повтор через 2.5–5с, при `connected` — переподписка, при фокусе вкладки — `loadConversations/fetch()` заново.

## 9. PWA — приложение, офлайн и пуши

PWA = сайт, который устанавливается как приложение, работает без сети и шлет пуши при закрытой вкладке. Сборка — `vite-plugin-pwa (generateSW)`, код — папка `pwa/`.

**Сборка (`vite.config.js`):** генерирует `/sw.js` (фоновый помощник браузера) + `manifest.webmanifest` (имя ULove, иконки 192/512/maskable, `display:standalone`, ярлыки Свайпы/Чаты). В SW зашиты предкэш `js/css/html/woff2 + offline.html/иконки` и `importScripts: ['/push-sw.js']` — наш обработчик пушей.

**Что кэшируется (`runtimeCaching`):** `pwa-pages` (страницы, NetworkFirst 3с, 20 шт/сутки), `pwa-fonts` (шрифты, CacheFirst год), `pwa-map-tiles` (тайлы OSM, CacheFirst 300 шт/месяц — карта в офлайне), `pwa-images` (картинки, StaleWhileRevalidate неделя), `pwa-api` (`/api/pins|conversations` GET, NetworkFirst 4с, 5 мин).

**Жизнь SW (`pwa/pwa.service.ts` + `usePwa.ts`):** `register()` ставит `/sw.js`, слушает `updatefound → installed` и ставит флаг `needUpdate`. `PwaUpdateBanner` → «обновить», `applyUpdate()` шлет `SKIP_WAITING` + перезагрузка. `bindOnce()` ловит `beforeinstallprompt` → `canInstall=true` → `PwaInstallBanner`, `promptInstall()` показывает системный диалог. `isStandalone()/getDisplayMode()` понимают «уже как приложение», события `online/offline` обновляют индикатор. Не путать с `AppUpdateModal` — тот показывает контентные обновления («что нового», `useAppUpdates`), а не новую версию SW.

**Пуши по шагам:** `pwa.config` берет VAPID-ключ из `<meta>` → `push.service.subscribe()`: `Notification.requestPermission` → `pushManager.subscribe({ userVisibleOnly, applicationServerKey })` → `pwa.api.savePushSubscription({ endpoint, keys })` в таблицу `push_subscriptions`. Тумблер `PwaPushToggle` дергает `usePush.toggle()`, ошибки по-русски в `describeError`. Кнопка «тест» — `POST /api/push-subscriptions/test`, fallback — локальное уведомление.

**Прилетел пуш при закрытом браузере (`public/push-sw.js`):** событие `push` → `showNotification(title/body/avatar/url)` с вибрацией. Клик `notificationclick` → ищет вкладку с этим URL и фокусит, иначе `navigate`/`openWindow`. Внутри сайта тот же формат рисует `push.service.showLocal()`.

**Настройки (`pwa/cache.service.ts` + `usePwaSettings` + `SettingsAppTab`):** `getEstimate()` — сколько МБ занято, `clearRuntimeCaches()` — чистка тайлов, `isOfflineReady()` — проба `/offline.html`, `persistStorage()` — просим не стирать кэш.

**Ограничения:** нужен HTTPS и собранная версия (не dev), на iOS пуши только если PWA на домашнем экране, битый Chrome лечится удалением данных сайта. Не работает — проверь `Notification.permission`, `serviceWorker.getRegistration()`, консоль `[reverb]` и `push_subscriptions` на бэке.
