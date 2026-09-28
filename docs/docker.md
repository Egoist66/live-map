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

Правило простое: **код правишь в dev-профиле** (там bind-mount + Vite HMR — изменения подхватываются мгновенно без пересборок), **прод-образ пересобираешь** одной командой выше, когда дело дошло до деплоя или поменялись зависимости.

- Сайт: **http://localhost:8000**
- WebSocket Reverb доступен через nginx-прокси `http://localhost:8000/app` — фронт собран с `VITE_REVERB_PORT=8000` через `build.args`, ничего дополнительно открывать не нужно
- Миграции (`migrate --force`), `storage:link`, `optimize` выполняются в `docker/entrypoint.sh` при каждом старте

Первый запуск долгий: ставятся composer- и pnpm-зависимости, гоняется `vue-tsc`, собирается фронт и SSR-бандл.

## Режим 2 — dev (хот-релоад, профиль `dev`)

Хост-код монтируется в контейнеры, фронт пересобирается на лету через Vite.

```powershell
docker compose --profile dev up -d app-dev vite
```

Повседневная команда — зависимости (`vendor`, `node_modules`) живут в volumes `dev-vendor`/`dev-node-modules` + кэш `dev-pnpm-store`, `composer/pnpm install` при рестарте пропускаются. `--build` только после изменений `docker/php-dev.Dockerfile`, `docker/vite.Dockerfile` или compose-файла. После ручного изменения `composer.json`/`package.json`: `docker compose exec app-dev composer install` / `docker compose exec vite pnpm install`.

- Сайт: **http://localhost:8001**
- Vite HMR: `localhost:5173` — URL подхватывается из `public/hot`, в браузере ничего прописывать не надо
- Reverb: `localhost:8080` (берётся из `VITE_REVERB_*` в `.env`)
- `app-dev` при старте делает `composer install`, `migrate --force`, поднимает `serve`, `reverb:start` и `queue:listen`
- SSR в dev выключен (`INERTIA_SSR_ENABLED=false`), рендеринг клиентский
- `mysql`/`redis` стартуют сами как зависимости

> `pnpm docker:dev` (`docker compose --profile dev up --build`) поднимает заодно и продовый `app` — порты не конфликтуют, но тяжелее. Для чистой dev-работы используй команду выше с явными `app-dev vite`.

## Повседневные команды

```powershell
docker compose ps                          # статусы, healthcheck
docker compose logs -f app                 # логи: nginx/php/reverb/queue/ssr/scheduler
docker compose logs -f app-dev vite        # логи dev-профиля
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
- `VITE_REVERB_*` для прод-образа запекаются **на этапе сборки** через `build.args` (иначе в бандл попадут пустые значения). После изменения этих `args` нужна пересборка: `docker compose build app`.
- `VITE_REVERB_*` для dev берутся из `.env` на хосте (`localhost:8080`) — пересборка не нужна, достаточно рестарта `vite`.

## Troubleshooting

| Симптом | Причина / лечение |
|---|---|
| `SQLSTATE[HY000] [2002]` или `Access denied` при старте | Старый volume с другой БД/схемой: `docker compose down -v` и поднять заново (данные удалятся) |
| Страница 500 после `up` | Смотреть `docker compose logs app`; чаще всего — незавершённые миграции или `APP_KEY` |
| WS не коннектится (прод) | Пересобери образ: `VITE_*` пекутся в build — `docker compose build app --no-cache` и проверь `args` в compose |
| WS не коннектится (dev) | `app-dev` должен слушать `8080` (`docker compose ps`), порт опубликован `8080:8080` |
| `Failed to fetch dynamically imported module` / 504 на ассетах (dev) | `vite` не поднят или hot-файл stale: `docker compose restart vite`, проверить `public/hot` |
| Порт уже занят (`3306`, `6379`, `8000`) | На хосте висит нативный MySQL/Redis/сервер — остановить его либо убрать блок `ports` у сервиса (связь между контейнерами идёт по внутренней сети и без публикации портов) |
| Изменения миграций не видны в `app` | Так и задумано: прод-образ содержит код на момент сборки — пересобери `docker compose build app` |
| `pnpm: command not found` в `vite` | Обнови образ: `docker compose --profile dev build vite` (pnpm ставится в `docker/vite.Dockerfile` через corepack) |

## Состав файлов

- `docker-compose.yml` — все сервисы, `build.args`, healthcheck-и, volumes
- `Dockerfile` — прод-образ: PHP 8.4 + nginx + supervisor + сборка фронта и SSR
- `docker/php-dev.Dockerfile` — лёгкий PHP для dev (расширения + composer, без nginx)
- `docker/vite.Dockerfile` — node 20 + pnpm, запускает только vite-сервер
- `docker/entrypoint.sh` — миграции, `storage:link`, `optimize`, запуск supervisord
- `docker/supervisord.conf` — nginx, `artisan serve`, reverb, SSR, queue, scheduler
- `docker/nginx*.conf` — reverse-proxy (Laravel на `127.0.0.1:8000`, Reverb на `/app` → `8080`), лимиты, anti-hotlink
