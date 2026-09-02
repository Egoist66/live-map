# Live Map — Документация проекта

> **Live Map** — гиперлокальная социальная сеть вокруг карты. Пины (вопросы, события, помощь, объявления) видны в радиусе 1–5 км, живут 2–24 часа. Приватность по умолчанию: размытие 200 м, анонимность по желанию, блок в 1 клик.

---

## 1. Стек

| Слой | Технология | Версия | Назначение |
|------|------------|--------|------------|
| Backend | Laravel | 13.29 | API, SSR, очереди, платежи |
| DB | MySQL | 8 | координаты `DECIMAL(10,7)`, FullText, Haversine |
| Frontend | Vue 3 + Inertia 2 | 3.4 / 2.0 | SPA без REST-дубликатов, SSR |
| State | Pinia | 4 | `pins` store |
| Карта | MapLibre GL | 6.6 | Vector/Raster, WebGL |
| Стили | Tailwind | 3.2 | `ink/brand/accent/surface`, dark `class` |
| Build | Vite 8 + TS 5.6 | — | HMR, `vue-tsc` |
| Realtime | polling 30s → Pusher / Echo | — | `PinCreated/Deleted` |
| i18n | `lang/ru` | — | Валидация на русском, `APP_LOCALE=ru` |
| Auth | Breeze + Sanctum | — | session `database`, `auth` |

---

## 2. Быстрый старт

### 2.1 Через Docker (рекомендуется — 1 команда)

```bash
npm run docker:up      # прод-сборка как на Render: app http://localhost:8000 + mysql/redis/meilisearch
# или для разработки с HMR:
npm run docker:dev     # app-dev http://localhost:8001 + vite http://localhost:5173 + HMR
npm run docker:logs    # логи
npm run docker:down    # остановить
npm run docker:clean   # удалить volumes (сброс БД)
```

`docker-compose.yml` — 1 универсальный файл: `app` (Dockerfile + supervisor: nginx+laravel+reverb+queue) + `mysql:8` + `redis:7` + `meilisearch`. Профиль `dev` добавляет `vite` и `app-dev` с hot reload.

Переменные БД уже прокинуты (`DB_HOST=mysql`, `REDIS_HOST=redis`). Первый запуск делает `migrate --force` автоматически.

### 2.2 Локально без Docker

```bash
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=AdminSeeder   # admin@live-map.test / Admin123!
npm install && npm run build
php artisan storage:link
npm run dev  # php serve + reverb + vite concurrently → http://localhost:8000
```

`.env`: `APP_NAME="Live Map"`, `APP_LOCALE=ru`, `FILESYSTEM_DISK=public`

---

## 3. Структура проекта

```
app/
  Console/Commands/  MakeAdmin, PruneExpiredPins
  Events/            PinCreated, PinDeleted
  Http/
    Controllers/     Pin, PinComment, Reaction, Report, ZoneSubscription, Profile, Avatar, Auth/*
    Middleware/      HandleInertiaRequests, AdminMiddleware
    Requests/        ProfileUpdateRequest, Auth/LoginRequest
  Models/            User, Pin, PinComment, PinBoost, PinView, Reaction, Report, Business, ZoneSubscription, UserBlock
  Policies/          PinPolicy, CommentPolicy
  Providers/         AppServiceProvider (Gate::before admin)
bootstrap/app.php    → middleware aliases admin/moderator, redirectGuestsTo login
routes/              web.php, api.php, auth.php
database/
  migrations/        13 файлов (users, pins, comments, reactions, zones, businesses, reports, blocks, admin role)
  seeders/           DatabaseSeeder, AdminSeeder, PinSeeder
resources/
  css/app.css        → design-system, dark overrides, card-hover
  js/
    app.ts           → Inertia title `${title} — Live Map`, Pinia, Ziggy
    bootstrap.ts     → axios + CSRF
    echo.ts          → Pusher (коммент)
    composables/     useMap, usePins, usePinForm, usePinDetails, useGeolocation, useTheme
    stores/pins.ts   → Pinia
    Layouts/         AuthenticatedLayout, GuestLayout
    Components/      ThemeToggle, AvatarPreview, Modal, Dropdown*, InputError...
    Pages/           Welcome, Dashboard, Map/Index, Profile/Edit, Auth/*
  views/app.blade.php → анти-FOUC dark script, fonts, @vite
```

---

## 4. База данных

### 4.1 ER-схема

```
users 1──N pins 1──N pin_comments 1──N reactions
users 1──N reactions, zone_subscriptions, reports, user_blocks, businesses
pins 1──N pin_boosts, pin_views
```

### 4.2 Таблицы

**users** `id, name, email, password, avatar_path, email_verified_at, plan enum(free,pro,business) default free, plan_expires_at, pins_today_count, pins_today_date, stripe_id, latitude/longitude (deprecated), home_lat/home_lng decimal(10,7), home_radius_km smallint 2, reputation_score int 0, level enum(novice,local,guide) novice, role enum(user,moderator,admin) user, is_admin bool, is_anonymous_default bool, settings json, timestamps`

**pins** `id, user_id FK, title varchar 120, body text, photo_path, category enum(question,announcement,warning,event,offer,help), latitude/longitude decimal, real_lat/real_lng, location_precision enum(blur_200,exact,district), visibility_radius_km 1, status enum(active,expired,archived,deleted) active, priority enum(normal,boosted,sponsored) normal, radius_meters int 1000, expires_at timestamp, is_pinned/is_sponsored/is_boosted bool, boosted_until, views_count/likes_count/reactions_count/comments_count int, is_anonymous bool, district_name, meta json, timestamps` + indexes `status,expires_at,lat,lng`

**pin_comments** `id, pin_id FK, user_id FK, parent_id nullable, content text, is_anonymous bool, timestamps, deleted_at soft`

**reactions** `id, user_id FK, reactable_type/id morph, type enum(like,fire,laugh,sad,angry,useful), unique(user_id,reactable_type,reactable_id,type)`

**zone_subscriptions** `id, user_id FK, lat/lng decimal, radius_km smallint, types json, notify_via enum(push,email,in_app)`

**businesses** `id, user_id FK, name, category, address, lat/lng, description, phone, website, working_hours json, subscription_plan enum(free,business,pro), is_active`

**reports, notifications, user_blocks, jobs, cache, sessions, subscriptions** — стандартные.

Миграция `2026_09_01_000012_add_admin_role_to_users` добавляет `role` + `is_admin`.

---

## 5. Модели — назначение и API

### 5.1 `User` (`app/Models/User.php`)
**Fillable:** `name,email,password,plan,latitude,longitude,role,is_admin,avatar_path,home_lat,home_lng,home_radius_km,reputation_score,level,is_anonymous_default,settings,plan_expires_at,pins_today_count,pins_today_date,stripe_id,pm_type,pm_last_four,trial_ends_at`  
**Hidden:** `password, remember_token`  
**Casts:** `home_lat/ lng decimal:7, settings array, is_anonymous_default bool, is_admin bool, plan_expires_at datetime, pins_today_date date`  
Связи: `pins(), comments(), reactions(), zoneSubscriptions(), businesses(), reports(), blocks(), blockedBy()`  
Бизнес-логика:
- `isAdmin() / isModerator() / hasRole()` — роль
- `canCreatePin(): bool` — admin → true, pro/business → true, free → `pins_today_count <3` или новая дата
- `pinTtlHours(): int` — free 2, pro 24, admin 168 (7 дн)
- `pinRadius(): int` — free 1000, pro 5000, admin 50000 м
- `isPro(), canModerate(), canDeletePin(Pin), canManageBusiness()` — Gate helpers

### 5.2 `Pin`
Fillable все поля карты, casts `expires_at, boosted_until datetime, meta array, latitude decimal:7`  
Связи: `user BelongsTo, boosts, views, comments, reactions morphMany`  
Scopes:
- `scopeActive(q)` → `where expires_at > now()`
- `scopeNearby(q, lat,lng,radiusKm)` → Haversine `6371*acos(...) as distance having distance <= radius`
- `scopeBoostedFirst` → `order is_boosted, is_pinned, created_at`
Helpers:
- `blurCoords(lat,lng,200): [lat,lng]` — полярное смещение `r*sqrt(u), 2πv`
- `toPublicArray(viewerId)` — скрывает `user` если `is_anonymous && !isOwner`, отдаёт только `latitude/longitude` (размытые)
- `isExpired(), isVisibleForTier(plan)`

### 5.3 `PinComment` `PinBoost` `PinView` `Reaction` `Report` `ZoneSubscription` `Business` `UserBlock`
Аналогично — Fillable + casts + BelongsTo, `Reaction` morph, `PinBoost` `type enum(top,glow,notify,extend) price duration`, `Report` `reason enum(spam,abuse,inappropriate,illegal,fake) status pending/resolved`.

---

## 6. Контроллеры

| Контроллер | Методы | Валидация | Логика |
|------------|--------|-----------|--------|
| `PinController@index` | `GET /api/pins?lat&lng&radius` | — | `Pin::active()->where(status active)->nearby($lat,$lng,$radius)->boostedFirst()->with(user)->limit(100)` → `toPublicArray(auth.id)` |
| `PinController@store` | `POST /api/pins` | `title 100, body 1000, category, latitude/longitude numeric, location_precision, is_anonymous` | `abort_unless(canCreatePin,429)`, blur 200м → `real_lat/lng`, `radius_meters = pinRadius()`, `expires_at = now+pinTtlHours`, `increment pins_today` , `broadcast PinCreated` |
| `PinController@destroy` | `DELETE /api/pins/{pin}` | `authorize delete` | `PinPolicy::delete` |
| `PinController@boost` | `POST /api/pins/{pin}/boost` | `type in top,glow,notify,extend` | `prices [1,2,5,3]`, создаёт `PinBoost`, `is_boosted=true`, `expires_at +1дн` если extend |
| `PinCommentController` | `index/store/destroy` | `content 1000` | `increment comments_count` |
| `ReactionController@toggle` | `POST /api/reactions/toggle` | `reactable_type pin/comment, type` | upsert unique |
| `ZoneSubscriptionController` | `index/store/destroy` | `lat,lng,radius,notify_via` | CRUD подписок |
| `ReportController@store` | `POST /api/reports` | `target_type, reason` | модерация |
| `ProfileController` | `edit/update/destroy` | `ProfileUpdateRequest` | `isDirty email → email_verified_at null` |
| `AvatarController@store` | `POST /profile/avatar` | `avatar image max 2048` | `Storage public avatars`, удаляет старый, `update avatar_path` |
| `Auth/*` | Breeze | `email, password Rules::defaults()` | стандарт + `LoginRequest` throttle 5 |

---

## 7. Политики и Middleware

- `PinPolicy`: `delete/update/boost` → `canDeletePin` (admin || owner)
- `CommentPolicy`: `delete` → admin || owner
- `AdminMiddleware` → `handle($request,$next,$role)` проверяет `isAdmin()` / `canModerate()`, alias `admin`, `moderator`
- `HandleInertiaRequests` → `share auth.user` (весь User), version
- `bootstrap/app.php`: `redirectGuestsTo => route(login)`, `redirectUsersTo => dashboard`, `Gate::before` → admin все права

---

## 8. Запросы (FormRequest)

- `ProfileUpdateRequest`: `name required max255, email lowercase unique:ignore, home_lat -90..90, home_lng -180..180, home_radius_km 1..20, is_anonymous_default bool, avatar_path string`
- `LoginRequest`: `email required email, password required`, `authenticate()` + `RateLimiter 5`, `trans auth.failed/throttle` (ru)

---

## 9. События и команды

- `PinCreated / PinDeleted` → `broadcast channel map` (Echo+Pusher), `toOthers()`
- `PruneExpiredPins` — `php artisan pins:prune` (удаляет `expires_at < now`)
- `MakeAdmin` — `php artisan make:admin {email} --password --name` — повышает или создаёт `role admin, plan business, level guide, rep 99999`

---

## 10. Маршруты

**web.php**
```php
GET / → Welcome
GET /dashboard → auth,verified
GET /map → auth
GET/PATCH/DELETE /profile + POST /profile/avatar → auth
fallback → guest→login, auth→dashboard
+ auth.php (guest: register/login/forgot, auth: verify-email, confirm-password, logout)
```
**api.php** `middleware web,auth`:
```
GET/POST /pins, DELETE /pins/{pin}, POST /pins/{pin}/boost
GET/POST /pins/{pin}/comments, DELETE /comments/{comment}
POST /reactions/toggle, zone-subscriptions, POST /reports
```

---

## 11. Frontend-архитектура

### 11.1 Инициализация
- `app.ts`: `createInertiaApp title: (t)=> t.includes(appName)?t: t?`${t} — ${appName}`:appName, Pinia, Ziggy
- `bootstrap.ts`: axios CSRF, `HandleInertiaRequests`
- `app.blade.php`: анти-FOUC dark script `localStorage theme`, fonts Figtree/Inter, `@vite`, `@inertiaHead`

### 11.2 Design-system
- `tailwind.config.js`: `darkMode class`, `ink {950,900,800}, brand 500 #5B5BFF, accent teal/amber, surface #F8F7F3`, `rounded 2xl-5xl`, `shadow soft/card/float/glow`
- `app.css`: CSS vars `--bg --ink`, `html.dark` overrides, `.glass`, `.card`, `.btn-primary/brand/ghost`, `.input-premium`, `.card-hover` (translate + shadow), `.maplibregl` ctrl dark, глобальные `html.dark .bg-white → zinc-900` и т.д. для консистентности

### 11.3 Composables / Stores

| Файл | Экспорт | Назначение |
|------|---------|------------|
| `useMap` | `mapContainer, initMap, renderPins, addTempMarker/remove, startPolling, flyToMyLocation, loaded` | MapLibre init `demotiles/positron/OSM raster`, controls Navigation/Geolocate/Scale, fallback стилей, `moveend` debounce 550ms + dist 0.0005, маркеры `div bg-* ring-2` |
| `usePins` | `store, categories, selectedCategory, filteredPins, fetchNearby` | категории `question/announcement/warning/event/offer/help` |
| `stores/pins` | `pins, fetchNearby, createPin, addRealtime` | dedup `inflight` + throttle 900ms, `axios.get /api/pins` |
| `usePinForm` | `newPin, setCoords, submit` | `createPin`, reset title/body, redirect login если guest |
| `usePinDetails` | `selectedPin, comments, react, sendComment, report, boost` | `axios reactions/comments/reports/boosts` |
| `useGeolocation` | `coords, requestGeolocation` | `navigator.geolocation`, fallback 55.7558/37.6173 |
| `useTheme` | `theme light/dark/system, isDark computed, setTheme, toggle` | `localStorage theme`, `matchMedia`, `document.documentElement dark` |

### 11.4 Layouts & Components
- `AuthenticatedLayout`: sticky `glass` nav 64px, logo, pill-навигация Кабинет/Карта, `+ Создать пин`, `Dropdown` с аватаром (`/storage/avatar` или ui-avatars), mobile hamburger; `slot` main
- `GuestLayout`: split 48% `ink-900` promo + форма `rounded-[24px] shadow-float`
- `Components/*`: `ApplicationLogo` (◉), `Dropdown(Link)`, `NavLink`, `Primary/Secondary/DangerButton`, `TextInput`, `InputError` (красный `bg-red-50` + иконка `!`), `AvatarPreview` (fixed overlay `backdrop-blur`, zoom анимация, `Esc`)
- `ThemeToggle` — удалён из хедера, вынесен в Настройки

### 11.5 Страницы

| Страница | Head.title → `<title>` | Контент |
|----------|------------------------|---------|
| `Welcome` | `Твое окно во двор — Live Map` | hero 64px, LIVE бейдж, stats 500/2мин/200м, мокап карты, #how 3 `card-hover`, приватность, монетизация, CTA |
| `Map/Index` | `Карта — Live Map` | `h-[calc(100vh-64px)]` MapLibre `absolute inset-0`, топ фильтр-капсула `bg-white/95`, hint, `flyToMe`, `+` мобайл, модалка создания (center desktop / bottom-sheet mobile) с полями title/body/category/precision/anon, деталь пина `right-4 w-[380px]` slide-over, комменты |
| `Dashboard` | `Кабинет — Live Map` | `ink-900` hero, 4 метрики `card-hover`, быстрые действия 4, зона-форма, свежие 3 пина, приватность footer |
| `Profile/Edit` | `Настройки — Live Map` | хедер аватара с превью, `lg:grid 280+1fr`, sticky табы `Профиль/Приватность/Внешний вид/Безопасность`, подсайд подписка |
| `Auth/Login` | `Вход — Live Map` | GuestLayout, InputError |
| `Auth/Register` | `Регистрация — Live Map` |  |
| Остальные Auth | однотипно | |

Все `Head` семантичны, `app.ts` умный — не дублирует `Live Map`.

---

## 12. Бизнес-логика (выдержки `context.md` / `LM-plan.txt`)

| Сущность | Free | Pro $4.99/мес | Business $19.99 | Admin |
|----------|------|---------------|-----------------|-------|
| Пинов/день | 3 | ∞ | ∞ | ∞ |
| TTL | 2ч | 24ч | 24ч | 168ч |
| Радиус видимости | 1км | 5км | 5км | 50км |
| Бусты | $0.99 топ 1ч, $1.99 glow, $4.99 notify 1км, $2.99 +24ч | те же | + витрина | бесплатно |
| Уровень | novice → local → guide (репут.) |  |  | guide 99999 |

Приватность: `location_precision blur_200` → `Pin::blurCoords` в 200м, `real_lat/lng` хранится скрыто, `toPublicArray` скрывает автора если `is_anonymous`. Реакции `like/fire/useful` продлевают жизнь (не реализовано cron, но счётчик). Зоны: `radius_km 2 default`, `notify_via in_app/push/email`.

---

## 13. Валидация и ошибки

- `lang/ru/validation.php` — русские сообщения `Поле :attribute обязательно`, `attributes` → Имя/Email/Пароль...
- `lang/ru/auth.php` → `Неверный email или пароль.`
- `.env APP_LOCALE=ru` + `app.ts` title handler
- `InputError.vue` — `bg-red-50 dark:bg-red-950/30 border-red-200` + иконка, `Transition`
- `UpdatePasswordForm.vue` — `required minlength 8`, `canSubmit` computed, `disabled opacity-40`, красивые границы `border-red-300` при ошибке, `onError` focus

Баг пустой формы закрыт: клиенто `!canSubmit` early return с `setError`, сервер `required`.

---

## 14. Тёмная тема

- `tailwind darkMode class`, `app.blade.php` early script `localStorage theme || prefers-color-scheme`, `useTheme` `theme light/dark/system`, `html.dark` + `color-scheme`
- `app.css` глобальные оверрайды `bg-white → zinc-900`, `border-stone → zinc`, `text-ink → zinc-100` для ` /95` вариантов, инпуты, скролл
- Карта остаётся светлой (OSM) для видимости местности, UI вокруг тёмный
- Настройки → `Внешний вид` 3 кнопки светлая/тёмная/система

---

## 15. Безопасность

- `auth` middleware → `redirectGuestsTo login`, `fallback` → login/dashboard
- `AdminSeeder` + `make:admin` + `Gate::before admin => true`
- `PinPolicy` защита удаления чужих пинов
- `current_password` правило, `Password::defaults()`, `RateLimiter` 5 login
- `avatar` `image max 2048`, удаление старого

---

## 16. Известные ограничения и дорожная карта

- Поиск `MATCH AGAINST` не подключён → позже Meilisearch/Scout
- Realtime polling 30с + debounce moveend 550ms, `Echo` закомментирован → подключить Pusher
- Оплата `Cashier Stripe` миграции есть (`subscriptions`), но UI `boost` мокая (`prices [1,2,5,3]` без Stripe checkout) → подключить `cashier` webhook
- `PruneExpiredPins` не в cron → добавить `schedule`

---

## 17. Команды

```bash
# Docker (1 команда)
npm run docker:up      # прод: docker compose up --build → http://localhost:8000
npm run docker:dev     # дев:  docker compose --profile dev up --build → http://localhost:8001 + vite 5173
npm run docker:down    # остановить
npm run docker:logs    # логи -f
npm run docker:clean   # down -v (сброс БД)
npm run docker:build   # только build

# Локально
npm run dev            # php serve + reverb + vite
npm run dev:ssr        # + inertia SSR
npm run build          # vue-tsc && vite build (~260kB gzip)
npm run build:ssr

# Laravel
php artisan make:admin admin@live-map.test --password=Secret
php artisan pins:prune
php artisan migrate --force
```

## 18. Деплой на Render (автодеплой)

`render.yaml` (Blueprint) уже настроен: `web` (Docker) + `postgres free`.

```bash
git add . && git commit -m "deploy" && git push origin main
# Render → New → Blueprint → выбери репозиторий → Apply
```

После первого деплоя поправь в Render Dashboard → Environment: `APP_URL=https://xxx.onrender.com`, `VITE_REVERB_HOST=xxx.onrender.com`, `VITE_REVERB_PORT=443`, `VITE_REVERB_SCHEME=https`. Любой `git push` в `main` — автодеплой. `Dockerfile` уже поддерживает `$PORT` через `nginx.conf.template` + `envsubst`.

Локальный прод-образ: `docker build -t live-map . && docker run -p 8000:80 --env-file .env live-map`

---

*Документ сгенерирован по коду на 2026-09-01, отражает фактическую реализацию. Для обновлений держите синхронизированными `AGENTS.md` и `DOCUMENTATION.md`.*
