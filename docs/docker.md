# Docker — запуск всего проекта

Всё (фронт, бэк, realtime, БД) поднимается через Docker. На хосте не нужны PHP, Composer, Node и MySQL.

## Предусловия

- Docker Desktop (Engine 24+, Compose v2)
- Файл `.env` в корне (`cp .env.example .env`, если его нет). `APP_KEY` сгенерируется сам при первом старте контейнера.

## Режим 1 — прод-подобный (по умолчанию)

Фронтенд собран в образе (`vite build` + SSR внутри `Dockerfile`), бэк, Reverb, очередь, шедулер и SSR работают под supervisor в одном контейнере `app`.

```powershell
docker compose up -d
```

Повседневная команда — образ уже собран, всё поднимается за секунды. `down` перед этим не нужен: `up` сам пересоздаёт контейнеры, если что-то поменялось. Флаг `--build` нужен **только** после изменений `Dockerfile`, `docker/`, `composer.json`/`composer.lock`, `package.json`/`pnpm-lock.yaml` или `VITE_*` в `docker-compose.yml`:

```powershell
docker compose up -d --build
```

Правило простое: **код правишь в dev-профиле** (там bind-mount + Vite HMR + Octane `--watch` — изменения подхватываются мгновенно без пересборок), **прод-образ пересобираешь** одной командой выше, когда дело дошло до деплоя или поменялись зависимости.

- Сайт: **http://localhost:8000**
- WebSocket Reverb доступен через nginx-прокси `http://localhost:8000/app` — фронт собран с `VITE_REVERB_PORT=8000` через `build.args`, ничего дополнительно открывать не нужно
- Миграции (`migrate --force`), `storage:link`, `optimize` выполняются в `docker/entrypoint.sh` при каждом старте

Первый запуск долгий: ставятся composer- и pnpm-зависимости, гоняется `vue-tsc`, собирается фронт и SSR-бандл.

## Режим 2 — dev (хот-релоад всего, профиль `dev`)

Хост-код монтируется в контейнеры. Бэкенд крутится на **Octane + RoadRunner** (приложение в памяти воркеров — TTFB в разы ниже, чем у `artisan serve`), фронт — на **Vite HMR**. Правки PHP и Vue подхватываются сами, без рестарта контейнеров.

```powershell
pnpm docker:dev
```

Это повседневная команда: `docker compose --profile dev up -d` **без `--build`** + логи всех четырёх сервисов. Поднимает только dev-профиль (продовый `app` не трогает). Перестарты — за секунды: `vendor`/`node_modules` живут в volumes `dev-vendor`/`dev-node-modules` + кэш `dev-pnpm-store`, `composer/pnpm install` пропускаются, если volume не пуст.

| Сервис | Что делает | Порт |
|---|---|---|
| `app-dev` | Octane `--watch` (HTTP + миграции при старте) | сайт **http://localhost:8001** |
| `vite` | Vite HMR, URL из `public/hot` | `localhost:5173` |
| `reverb-dev` | WebSocket Reverb (`VITE_REVERB_*` из `.env`) | `localhost:8080` |
| `queue-dev` | `queue:listen` (события, уведомления, realtime-шина) | — |

Что где хот-релоадится:

- **Фронт** (`resources/js`, `*.vue`): Vite HMR — мгновенно в браузере, страницу не перезагружает.
- **Бэкенд** (`app/`, `routes/`, `config/`, `database/`): Octane `--watch` (polling mtime — работает и через Windows bind-mount) сам перезапускает воркеры за ~1–2 сек.
- **`.env`**: требует рестарта (`pnpm docker:dev:restart`), вотчер его не подхватит — значения едут из `environment` compose, а не из файла.
- SSR в dev выключен (`INERTIA_SSR_ENABLED=false`), рендеринг клиентский.
- `mysql`/`redis` стартуют сами как зависимости.

Только нужное (без realtime/очередей — легче, старт ещё быстрее):

```powershell
docker compose --profile dev up -d app-dev vite
```

После ручного изменения `composer.json`/`package.json`: `docker compose exec app-dev composer install` / `docker compose exec vite pnpm install --store-dir /pnpm/store`.

## Все dev-команды (`package.json`)

```powershell
pnpm docker:dev          # быстрый старт (без сборки) + логи app-dev/vite/reverb-dev/queue-dev
pnpm docker:dev:build    # первый запуск или после правок Dockerfile/compose — собрать и поднять
pnpm docker:dev:restart  # перезапустить dev-сервисы (например, после правки .env)
pnpm docker:dev:down     # остановить dev-сервисы, данные БД сохранить
pnpm docker:dev:fresh    # снести volumes (БД, vendor, node_modules) и поднять с нуля
```

## Повседневные команды

```powershell
docker compose ps                          # статусы, healthcheck
docker compose logs -f app                 # логи: nginx/php/reverb/queue/ssr/scheduler
docker compose --profile dev logs -f app-dev vite reverb-dev queue-dev  # логи dev-профиля
docker compose exec app php artisan tinker # artisan внутри app
docker compose exec app-dev php artisan migrate --force
docker compose exec mysql mysql -ularavel -psecret live_map
docker compose restart app                 # пересобрать конфиг/перезапустить процессы
docker compose down                        # остановить, данные БД сохранить
docker compose down -v                     # остановить И УДАЛИТЬ все данные (БД, редиc, storage)
```

## Переменные окружения: кто кого перекрывает

- `docker-compose.yml` → `env_file: .env` + блок `environment`. **`environment` всегда побеждает `env_file`.**
- Креды БД для контейнеров заданы в compose и совпадают с сервисом `mysql`: `DB_DATABASE=live_map`, `DB_USERNAME=laravel`, `DB_PASSWORD=secret`. Значения `DB_*` в `.env` (`live_map_app` / `root` / `root`) рассчитаны на нативный MySQL и внутри Docker не используются — менять их не нужно.
- Серверный broadcast в dev идёт на `REVERB_HOST=reverb` (контейнер `reverb-dev` по docker-сети), а не на `127.0.0.1` — там после сплита сервисов никого нет. Браузерный `VITE_REVERB_HOST=localhost:8080` не менялся.
- `VITE_REVERB_*` для прод-образа запекаются **на этапе сборки** через `build.args` (иначе в бандл попадут пустые значения). После изменения этих `args` нужна пересборка: `docker compose build app`.
- `VITE_REVERB_*` для dev берутся из `.env` на хосте (`localhost:8080`) — пересборка не нужна, достаточно рестарта `vite`.

## Troubleshooting

| Симптом | Причина / лечение |
|---|---|
| `SQLSTATE[HY000] [2002]` или `Access denied` при старте | Старый volume с другой БД/схемой: `docker compose down -v` и поднять заново (данные удалятся) |
| Страница 500 после `up` | Смотреть `docker compose logs app`; чаще всего — незавершённые миграции или `APP_KEY` |
| WS не коннектится (прод) | Пересобери образ: `VITE_*` пекутся в build — `docker compose build app --no-cache` и проверь `args` в compose |
| WS не коннектится (dev) | Должен быть поднят `reverb-dev` (`docker compose --profile dev ps`), порт `8080:8080` висит на нём, а не на `app-dev`. Полный старт: `pnpm docker:dev` |
| Нет realtime-событий/уведомлений (dev) | Не поднят `queue-dev`: `docker compose --profile dev up -d queue-dev` |
| `Failed to fetch dynamically imported module` / 504 на ассетах (dev) | `vite` не поднят или hot-файл stale: `docker compose --profile dev restart vite`, проверить `public/hot` |
| Правки PHP не применяются (dev) | Octane `--watch` рестартует воркеры сам; если завис — `docker compose --profile dev restart app-dev`. Проверь, что в логах `app-dev` именно `octane:start`, а не фолбэк `serve` (значит, нет `vendor/bin/rr` — прогнать `composer install`) |
| Порт уже занят (`3306`, `6379`, `8000`) | На хосте висит нативный MySQL/Redis/сервер. Для MySQL уже решено: Docker слушает `${MYSQL_PORT:-3307}` (см. `docker-compose.yml`), нативный остаётся на `3306`. В своём `.env` для доступа с хоста держи `DB_PORT=3307`; внутри контейнеров всегда `DB_PORT=3306` (задано в `environment`). Альтернатива — остановить нативный (`net stop MySQL`) и вернуть `MYSQL_PORT=3306` |
| Изменения миграций не видны в `app` | Так и задумано: прод-образ содержит код на момент сборки — пересобери `docker compose build app` |
| `pnpm: command not found` в `vite` | Обнови образ: `docker compose --profile dev build vite` (pnpm ставится в `docker/vite.Dockerfile` через corepack) |

## Состав файлов

- `docker-compose.yml` — все сервисы, `build.args`, healthcheck-и, volumes; dev-профиль: `app-dev` (Octane), `reverb-dev`, `queue-dev`, `vite`
- `Dockerfile` — прод-образ: PHP 8.4 + nginx + supervisor + сборка фронта и SSR
- `docker/php-dev.Dockerfile` — лёгкий PHP для dev (расширения + opcache + composer, без nginx)
- `docker/php-dev.ini` — dev-настройки PHP: opcache с мгновенной ревалидацией + realpath-кэш под Windows bind-mount
- `docker/dev-entrypoint.sh` — точка входа dev-контейнеров: роль `DEV_ROLE` (`app` → Octane `--watch`, `reverb`, `queue`), install только при пустом volume, миграции
- `docker/vite.Dockerfile` — node 20 + pnpm, запускает только vite-сервер (`--prefer-offline` для быстрого рестарта)
- `docker/entrypoint.sh` — миграции, `storage:link`, `optimize`, запуск supervisord
- `docker/supervisord.conf` — nginx, `artisan serve`, reverb, SSR, queue, scheduler
- `docker/nginx*.conf` — reverse-proxy (Laravel на `127.0.0.1:8000`, Reverb на `/app` → `8080`), лимиты, anti-hotlink
