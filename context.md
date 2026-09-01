# Упрощённый стек для Live Map (MVP) с MySQL

Для быстрого запуска и проверки идеи не нужно строить сложную инфраструктуру. Достаточно надёжного и знакомого стека, который позволит реализовать весь базовый функционал за 2–3 недели. Ниже — минимально необходимый набор технологий с обоснованием.

## Backend: Laravel + MySQL

**Laravel 13** — идеальный PHP-фреймворк для одиночной разработки:

- Быстрая аутентификация через Breeze (встроенная, с Vue).
- Eloquent ORM — удобная работа с MySQL.
- Очереди на database driver — не нужен Redis.
- Платежи через Cashier (Stripe) — подписки реализуются за вечер.
- Отличная документация, множество готовых решений.

**MySQL 8** — используем как основную БД:

- Хранение координат: `DECIMAL(10,7)` для широты и долготы.
- Поиск пинов в радиусе — вычисляем дистанцию через формулу гаверсинуса прямо в SQL или через WHERE с bounding box (быстрее).
- Полнотекстовый поиск по заголовкам/описаниям (MATCH AGAINST) — для MVP хватит.

**Ключевые пакеты Composer:**

- `laravel/breeze` — регистрация/вход.
- `laravel/cashier` — Stripe подписки и разовые платежи.
- `barryvdh/laravel-debugbar` — отладка (dev).
- `guzzlehttp/guzzle` — для внешних API (геокодинг, аналитика).

## Frontend: Vue 3 + Inertia.js + Tailwind CSS

**Inertia.js** связывает Laravel и Vue без необходимости писать API вручную:

- Серверный рендеринг для SEO (пины должны индексироваться).
- Реактивность Vue на клиенте.
- Меньше кода: контроллеры возвращают Inertia-ответы, а не JSON.

**Vue 3 (Composition API)** — для динамической карты и живых обновлений.
**Pinia** — лёгкое хранилище состояния (выбранный район, фильтры, текущий пользователь).

**Tailwind CSS** — быстрая адаптивная вёрстка без написания CSS.

**Библиотеки:**

- `maplibre-gl` — бесплатная карта (аналог Mapbox) на WebGL.
- `axios` — HTTP-запросы.
- `vue-toastification` — всплывающие уведомления.

## Гео-функции на MySQL (без PostGIS)

Для поиска пинов в радиусе используем два подхода:

1. **Быстрый отбор через bounding box** (прямоугольник вокруг точки):

```sql
SELECT * FROM pins
WHERE latitude BETWEEN ? - ? AND ? + ?
AND longitude BETWEEN ? - ? AND ? + ?
AND expires_at > NOW()
```

Индексы по `latitude` и `longitude` ускорят запрос.

1. **Точное расстояние** (если нужно сортировать) вычисляем в PHP после выборки, либо прямо в SQL через формулу гаверсинуса:

```sql
SELECT *, 
(6371 * acos(cos(radians(?)) * cos(radians(latitude)) 
* cos(radians(longitude) - radians(?)) + sin(radians(?)) 
* sin(radians(latitude)))) AS distance
FROM pins
HAVING distance < ?
ORDER BY distance
```

Для MVP это допустимо, при росте можно перейти на PostgreSQL + PostGIS.

## Real-time обновления: polling → потом Pusher

**Начните с простого polling** (AJAX каждые 20–30 секунд):

```js
setInterval(() => {
  axios.get('/api/pins', { params: { bounds: map.getBounds() } })
    .then(res => updatePins(res.data))
}, 30000)
```

Плюсы: ноль доп. инфраструктуры, работает сразу.
Минусы: задержка и лишние запросы, но для MVP терпимо.

**Когда понадобится мгновенность**, подключите **Laravel Echo + Pusher** (бесплатный тариф до 200k сообщений/день). Настройка займёт 30 минут, а код почти не изменится (события вместо интервалов).

## Очереди и уведомления — без Redis

Используйте драйвер `database`:

```env
QUEUE_CONNECTION=database
```

Создайте таблицу `jobs` (`php artisan queue:table`) и запускайте воркер через Supervisor. Для MVP этого достаточно. Redis понадобится, когда нагрузка вырастет.

## Поиск

Используйте встроенный FULLTEXT в MySQL:

```sql
ALTER TABLE pins ADD FULLTEXT(title, description);
SELECT * FROM pins WHERE MATCH(title, description) AGAINST('кофе' IN NATURAL LANGUAGE MODE);
```

Если понадобится более умный поиск (опечатки, склонения) — позже подключите Meilisearch.

## Платежи: Stripe + Laravel Cashier

Cashier упрощает подписки:

```php
$user->newSubscription('default', 'price_pro')->create($paymentMethod);
```

Для разовых платежей (бусты) — `$user->charge(100, $paymentMethod)`.

## Инфраструктура (простой VPS)

- **Nginx** + **PHP-FPM** (можно через Laravel Forge или вручную).
- **MySQL** на том же сервере.
- **Supervisor** для очередей.
- **Cloudflare** (бесплатный SSL и CDN).
- Хранение фото — локально (папка `storage/app/public`) или сразу S3-совместимое (DigitalOcean Spaces, $5/мес).

**Docker не обязателен** — классический LEMP стек проще для понимания и отладки.

## Стоимость на старте

- VPS (2 CPU, 4 GB RAM): $12–20/мес
- Домен: $1/мес
- Pusher (бесплатный тариф): $0
- Cloudflare: $0
- **Итого: ~$15–25/мес**

## Почему этот стек оптимален для MVP

1. **Вы уже знаете PHP + Vue** — не нужно тратить время на изучение новых языков.
2. **MySQL** — привычная БД, все гео-задачи решаются простыми запросами.
3. **Inertia** избавляет от написания отдельного API и рутинной синхронизации.
4. **Polling** позволяет отложить сложность WebSocket до этапа, когда продукт докажет жизнеспособность.
5. **Laravel Cashier** экономит недели на интеграции платежей.

Всё это позволяет сфокусироваться на главном — интерфейсе карты, создании пинов и привлечении первых пользователей. По мере роста вы сможете постепенно добавлять Redis, PostGIS, Meilisearch и WebSocket, не переписывая приложение с нуля.

# Таблицы базы данных для MVP Live Map (MySQL)

Ниже перечислены основные таблицы, необходимые для реализации функционала, описанного в бизнес-плане. Используем MySQL 8, Laravel 11, драйвер очередей — database. Все координаты храним как `DECIMAL(10,7)` (точность ~1 см). Для поиска рядом используем bounding box и формулу гаверсинуса (в коде).

## 1. `users` — пользователи

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| name | varchar(255) | Отображаемое имя |
| email | varchar(255) unique | |
| password | varchar(255) | |
| avatar_path | varchar(255) nullable | Путь к аватарке |
| home_lat | decimal(10,7) nullable | Домашняя широта (для уведомлений) |
| home_lng | decimal(10,7) nullable | Домашняя долгота |
| home_radius_km | smallint unsigned default 2 | Радиус интереса (км) |
| reputation_score | int unsigned default 0 | Очки репутации |
| level | enum('novice','local','guide') default 'novice' | Уровень |
| is_anonymous_default | boolean default false | Создавать пины анонимно по умолчанию? |
| settings | json nullable | Прочие настройки (интересы, типы уведомлений) |
| created_at, updated_at | timestamps | |

**Индексы:** уникальный по email, индекс по `home_lat`, `home_lng` (для поиска подписчиков зоны).

## 2. `pins` — пины (основная сущность)

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| user_id | bigint unsigned FK | Автор (может быть null, если аноним? Лучше всегда сохранять, но скрывать) |
| type | enum('question','alert','event','meetup','news','funny','help') | Тип пина |
| title | varchar(100) | Короткий заголовок |
| description | text nullable | Подробности |
| photo_path | varchar(255) nullable | Фото |
| lat | decimal(10,7) | Широта (размытая, если точность не точная) |
| lng | decimal(10,7) | Долгота (размытая) |
| real_lat | decimal(10,7) nullable | Точная широта (хранится отдельно, не отдаётся в API) |
| real_lng | decimal(10,7) nullable | Точная долгота |
| location_precision | enum('blur_200','exact','district') default 'blur_200' | Выбранная точность |
| visibility_radius_km | smallint unsigned default 1 | Видимость пина (км) |
| expires_at | datetime | Время истечения |
| status | enum('active','expired','archived','deleted') default 'active' | |
| priority | enum('normal','boosted','sponsored') default 'normal' | Приоритет |
| views_count | int unsigned default 0 | |
| reactions_count | int unsigned default 0 | Денормализованный счётчик |
| comments_count | int unsigned default 0 | |
| is_anonymous | boolean default false | Скрывать автора |
| city_id | int unsigned nullable | Ссылка на город (если есть справочник) |
| district_name | varchar(100) nullable | Район (текст) |
| created_at, updated_at | timestamps | |

**Индексы:**

- `idx_pins_active_location` (status, expires_at, lat, lng)
- `idx_pins_user` (user_id)
- `idx_pins_type` (type)
- `idx_pins_created` (created_at)
- FULLTEXT по (title, description) для поиска

**Примечание:** `real_lat`/`real_lng` нужны только для расчёта расстояния до других пинов и для уведомлений. В выдаче пользователям отдаём только `lat`/`lng`.

## 3. `pin_comments` — комментарии к пинам

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| pin_id | bigint unsigned FK | |
| user_id | bigint unsigned FK | |
| parent_id | bigint unsigned nullable FK | Для веток (ответ на комментарий) |
| content | text | |
| is_anonymous | boolean default false | |
| created_at, updated_at | timestamps | |
| deleted_at | timestamp nullable | Мягкое удаление |

**Индексы:** (pin_id, created_at), (user_id), (parent_id).

## 4. `reactions` — реакции (лайки и т.п.)

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| user_id | bigint unsigned FK | |
| reactable_type | varchar(255) | 'pin' или 'comment' |
| reactable_id | bigint unsigned | |
| type | enum('like','fire','laugh','sad','angry','useful') | |
| created_at | timestamp | |

**Уникальный индекс:** (user_id, reactable_type, reactable_id, type) — чтобы не дублировать реакции одного типа.

## 5. `zone_subscriptions` — подписки на зоны (для уведомлений)

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| user_id | bigint unsigned FK | |
| lat | decimal(10,7) | Центр зоны |
| lng | decimal(10,7) | |
| radius_km | smallint unsigned | |
| types | json nullable | Массив интересующих типов пинов, null = все |
| notify_via | enum('push','email','in_app') default 'in_app' | |
| created_at, updated_at | timestamps | |

**Индексы:** (user_id), (lat, lng).

## 6. `businesses` — бизнес-аккаунты

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| user_id | bigint unsigned FK | Владелец |
| name | varchar(255) | Название |
| category | varchar(100) | Категория |
| address | varchar(255) | |
| lat | decimal(10,7) | |
| lng | decimal(10,7) | |
| description | text nullable | |
| phone | varchar(20) nullable | |
| website | varchar(255) nullable | |
| working_hours | json nullable | |
| subscription_plan | enum('free','business','pro') default 'free' | |
| is_active | boolean default true | |
| created_at, updated_at | timestamps | |

## 7. `reports` — жалобы на контент

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| reporter_id | bigint unsigned FK | |
| target_type | enum('pin','comment','user') | |
| target_id | bigint unsigned | |
| reason | enum('spam','abuse','inappropriate','illegal','fake') | |
| description | text nullable | |
| status | enum('pending','resolved','dismissed') default 'pending' | |
| moderator_id | bigint unsigned nullable FK | |
| created_at, resolved_at | timestamps | |

**Индексы:** (target_type, target_id, status), (reporter_id).

## 8. `notifications` — уведомления (внутренние)

| Поле | Тип | Описание |
| ------ | ----- | ---------- |
| id | bigint unsigned PK | |
| user_id | bigint unsigned FK | Получатель |
| type | varchar(100) | Класс уведомления |
| data | json | Данные (текст, ссылка) |
| read_at | timestamp nullable | |
| created_at | timestamp | |

**Индексы:** (user_id, read_at).

## 9. Служебные таблицы Laravel

- `jobs` — очереди (database driver)
- `failed_jobs` — неудачные задачи
- `cache` — кэш (если драйвер database)
- `sessions` — сессии (если драйвер database)
- `password_reset_tokens`
- Таблицы Cashier: `subscriptions`, `subscription_items`, `customers` (для Stripe)

## 10. Дополнительно (опционально)

- `cities` — справочник городов (id, name, slug, lat, lng, polygon), если нужно. Для MVP можно хранить название города в пине или отдельной таблицей.
- `user_blocks` — блокировки пользователей (blocker_id, blocked_id, created_at).
- `boost_transactions` — история покупки бустов (user_id, pin_id, type, amount, created_at) — для аналитики и повторных покупок.

## Связи и логика

- `users` 1→N `pins`, `comments`, `reactions`, `zone_subscriptions`, `reports`, `notifications`.
- `pins` 1→N `comments`, `reactions`.
- `comments` 1→N `reactions`, самоссылка через `parent_id`.
- `businesses` 1→1 `users` (владелец), 1→N `pins` (если бизнес публикует пины от своего имени).

## Замечания по реализации приватности

- В `pins` всегда сохраняем `user_id` (даже анонимно), но при выдаче если `is_anonymous = true`, скрываем автора.
- `lat`/`lng` в выдаче — размытые (если `location_precision = 'blur_200'`, то реальные координаты заменены на случайные в радиусе 200 м при создании и сохранены в `real_lat`/`real_lng`).
- `visibility_radius_km` ограничивает круг пользователей, которые могут видеть пин (проверяем расстояние от `home_lat`/`home_lng` пользователя до `lat`/`lng` пина). Это также снижает спам.

## Миграции Laravel

Создать миграции командой `php artisan make:migration create_pins_table` и т.д., затем описать поля. Использовать `$table->decimal('lat', 10, 7)`, `$table->enum(...)`, `$table->foreignId('user_id')->constrained()->cascadeOnDelete()`.

Этот набор таблиц покрывает весь функционал MVP: регистрацию, создание и просмотр пинов, комментирование, реакции, уведомления по зонам, жалобы, бизнес-профили и платежи. По мере роста можно добавлять таблицы для подписок Cashier, городов, аналитики.
