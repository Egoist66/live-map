# Кабинет бизнеса — документация

## Идея в 30 секунд

Бизнес платит не за «тариф», а за клиентов рядом. Платформа зарабатывает
на визитке ($9.99/мес), рекламных пинах ($9.99/7 дней), пушах по району
(от $14.99) и купонах ($4.99). Позже — комиссия 5–10% за бронь/заказ.

Кабинет — удобный, мощный, информативный: профиль по законодательству РБ,
дашборд (просмотры, пины, лайки), подсказки заработка, карта и промо.

## Вход: третий таб ULove Business

Никаких модалок и запоминаний: на общем лендинге три таба —
ULove / Business (`useWelcomeMode`, таб `business` со своим
контентом, палитрой, CTA и SEO; выбор таба живёт в `welcome_landing_tab`).

1. Таб Business — лендинг ULove Pro: hero с превью метки компании,
   шаги, тарифная панель. CTA ведут с `?account=business`:
   регистрация → `/register?account=business`, вход → `/login?account=business`.
2. Регистрация разделена только по query-параметру:
   - Персона — обычная форма (цели, пол, карта), всегда `account_type=person`.
   - Компания (`?account=business`) — `BusinessRegisterForm` +
     `useBusinessRegisterForm` + `business-register.schema`: название,
     email, форма собственности, УНП 9 цифр, юрадрес, телефон, город,
     пароль. Ноль слов про дейтинг.
   - Бэк принимает `account_type=business` без `gender`, создаёт
     `Business`-профиль с реквизитами сразу. После регистрации →
     `/cabinet/onboarding`.
3. Вход с `?account=business` — та же форма, но шапка «Вход в кабинет».
   `landingPath()` бизнеса — `/cabinet`.

## Сущности

### User.account_type

- `person|business`, default `person` (миграция `2026_09_27_000001`).
- `isBusinessAccount()`, `activeBusiness()`, `landingPath()` → бизнес всегда
  в `/cabinet` (см. `User.php`).
- Регистрация: `RegisteredUserController` принимает `account_type`,
  создаёт черновик `Business` через `BusinessService::profileFor`.

### Business (расширено под РБ)

Миграция `2026_09_27_000002`: `legal_form, unp, reg_number, legal_address,
director_name, verification_status, verification_notes, verified_at, logo_path`.

- `legal_form`: `ooo|ip|odo|zao|self_employed|craft|other`.
- `unp`: строго 9 цифр (`/^\d{9}$/` и на бэке, и в zod-схеме).
- `verification_status`: `draft|pending|verified|rejected`.
- Верифицированный получает: бейдж «Проверено», бессрочные пины,
  радиус 50 км, пуш-рассылку, купоны с кнопкой «Маршрут».
- Смена `unp|legal_form|name` у verified → снова `pending` (защита от подмены).

## API

- `PATCH /api/account-type {account_type}` → `{account_type, landing}`.
- `GET /api/businesses/map?lat,lng,radius` → компании в радиусе
  (метка, `pins_count`, `owner_profile`) — видно всем пользователям карты.
- `GET /api/businesses/{id}/pins` → живые пины компании для модалки.
- Пины: `promo` (до 140 символов, только бизнес, с модерацией) +
  `is_business` в каждом `toPublicArray` (включая realtime).
- Фото: `business_photos` (макс 10) + `businesses.services` (о себе/услуги);
  `GET /api/businesses/{id}/photos`, `POST/DELETE` (владелец/админ),
  `GET /api/business-photos/by-owner/{user}` для карточки пина;
  листалка — Galleria в `PinDetailsCard`, загрузка — `BusinessPhotosManager`.
- `GET /api/business` → кабинет-профиль (`BusinessResource`).
- `PATCH /api/business` (throttle profile-write) → обновление профиля РБ.
- `GET /api/business/dashboard` → `{business, stats, recent_pins, recent_ads, ads_quota, earn}`.
- `POST /api/business/submit` (throttle social-write) → `pending`
  (повтор в pending — 409 «уже на проверке»).
- Админ+модератор: `GET /api/admin/businesses?status,q` (очередь заявок,
  таб «Бизнес»), `POST /api/admin/business/{id}/verify|reject {reason}`.
- Реклама (только verified): `GET /api/businesses/{id}/ads` (витрина, все),
  `GET /api/business/ads/quota`, `POST /api/businesses/{id}/ads`,
  `PATCH/DELETE /api/business-ads/{ad}` — лимит 3 в скользящие 7 дней (429).
- Районы: `POST /api/districts/{id}/join {message?}` — организации обязаны
  указать цель вступления (мин. 10 символов); `members` отдаёт владельцу
  цель + org-флаги заявок; отказ — inbox `district.request_rejected`.

Realtime (правило №10, №13):
- `BusinessVerificationSubmitted` → private `user.{staffId}` (админы +
  модераторы), as `business.verification.submitted` — очередь «Бизнес»
  обновляется живьём (socket + `business:pending` в sync + inbox).
- `BusinessVerified` / `BusinessRejected` → private `user.{owner}`,
  as `business.verified|rejected` — тост + звук у владельца через
  `useAppNotifications` и `useBusinessProfile` (+ `business:status` в sync).
- Уведомления именуют организации словом «Организация»
  (`UserNotification::subjectWord` по `is_organization` актора):
  заявки в район, дружба, жалобы, пины — и в пушах, и в тостах, и в ленте.

## Фронт

- Типы: `types/entities/Business.ts` (`BusinessProfile, BusinessDashboard…`).
- Сервис: `services/business.api.ts` (axios, `X-Socket-ID` из общего `api`).
- Стор: `stores/business.ts` (Pinia, правило №8) — `profile/dashboard`,
  `load/loadDashboard/save/submit`, подписка на `business.verified`.
- Карта: `useBusinessMarkers` (слой компаний: троттлинг 3с, особые метки
  с двойным пульсом, клик → `BusinessMapModal` со списком пинов и кнопкой
  «Профиль компании»); пины бизнеса в `useMap.renderPins` — ×1.45 больше,
  быстрый двойной пульс `bizRing`, индиго-свечение и постоянный тултип
  (promo или заголовок); promo-поле в `MapCreateDialog`/`PinDetailsCard`
  только для бизнеса.
- Логотип — «ULove Pro» (`ApplicationLogo`, `Welcome`, `GuestLayout`).
- Хуки (правило №1, №11):
  - `useAccountTypeChoice` — гейт персона/компания (localStorage + API).
  - `useBusinessProfile` — форма кабинета (vee-validate + zod).
  - `useBusinessDashboard` — дашборд (фасад над стором).
  - `useBusinessOnboarding` — 3 шага РБ: компания → реквизиты → точка.
- Схема: `validation/schemas/business.schema.ts` (УНП 9 цифр, юрадрес,
  телефон BY).
- Компоненты (только PrimeVue, правило №5):
  - `AccountTypeGateModal` — блюр-гейт первого визита.
  - `BusinessStatCard`, `BusinessVerificationBadge`.
- Лейаут: `Layouts/BusinessLayout.vue` — шапка с бейджем и дропдауном
  компании (Кабинет, Реквизиты, Настройки, Карта, Чаты, Выйти через
  `AppUserMenu`), десктоп-пилюли и мобильный bottom-nav
  (Дашборд, Карта, Чаты, Реквизиты, Настройки), тёмная тема (правило №14).
- Страницы: `Pages/Business/Index.vue` (официальный hero с логотипом +
  шаги проверки + статистика + продвижение + пины со ссылками
  `/map?pin=`), `Pages/Business/Pins.vue` (все пины с итогами),
  `Pages/Business/Onboarding.vue` (подстановка реквизитов с регистрации +
  «осталось дозаполнить» + часы работы + услуги),
  `Pages/Business/Settings.vue` (логотип, предпросмотр «Как видят клиенты»,
  фото, тариф, уведомления, вид, приложение — только бизнес-сущности).
- Профиль максимум: логотип (`POST /api/businesses/{id}/logo`),
  часы работы (редактор Пн–Вс), услуги, фото (до 10) — всё видно клиентам
  в `Business/Show` и тултипах карты.
- Бизнес-лок: свайпы и UFlow закрыты редиректом в кабинет (`PageController`),
  модалка ulove/upin не показывается бизнесу (`useDefaultMode`),
  топбар/нижнее меню/дропдаун прячут ULove и UFlow (`isBusiness`).
- Профиль в другом виде: свой `/profile` ведёт бизнес в кабинет
  (`ProfileController@dashboard`), чужие `/users/{slug}` компаний отдают
  `Business/Show` — карточку организации (контакты, часы, «Написать»)
  вместо анкеты персоны.
- Роуты: `/cabinet` (index), `/cabinet/onboarding`, `/cabinet/settings`
  (Ziggy `cabinet.*`; API осталось `/api/business/*` — внутреннее).

## Монетизация связка (см. docs/monetization.md)

Кабинет показывает `earn`-подсказки из `BusinessService::earnHints`:
verify → first_pin → push → coupon. Оплата — шторка `[За кредиты] [Pro]`
в местах упора (402), пуш-лимит N/сутки, цены — в конфиге.

## Чек-лист приёмки

- [ ] Гость видит блюр + модалку персона/компания, выбор ведёт в регистрацию.
- [ ] Регистрация компании → онбординг РБ (УНП 9 цифр, юрадрес).
- [ ] Кабинет: цифры, последние пины, earn-подсказки, тёмная тема + мобилка.
- [ ] Submit → админу прилетает `business.verification.submitted`.
- [ ] Verify → владельцу тост `business.verified` (socket + realtime-bus + пуш).
- [ ] `vue-tsc` зелёный, dev-лог обновлён.
