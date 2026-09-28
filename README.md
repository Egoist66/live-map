# UPin (live-map)

Vue 3 + Inertia v2 + Laravel 12 + Reverb (WebSocket) + MySQL + Redis. Всё поднимается через Docker — на хосте нужны только Docker и Git.

## Быстрый старт

```powershell
cp .env.example .env   # если .env ещё нет; APP_KEY сгенерируется сам при старте
docker compose up -d --build
```

Сайт: **http://localhost:8000**. Миграции, `storage:link`, очередь, шедулер, Reverb и SSR стартуют сами внутри контейнера `app`.

Проверка:

```powershell
docker compose ps              # все сервисы healthy/running
docker compose logs -f app     # логи бэк + reverb + очередь
curl http://localhost:8000     # 200
```

Остановка: `docker compose down` (данные MySQL сохраняются в volume `mysql`).

## Dev-режим (хот-релоад)

```powershell
docker compose --profile dev up -d --build app-dev vite
```

- Сайт: **http://localhost:8001**
- Vite HMR: `localhost:5173` (подхватывается через hot-файл автоматически)
- Reverb: `localhost:8080`, рядом работают `queue:listen` и миграции при старте
- `mysql`/`redis` подтянутся сами как зависимости

## Сервисы и порты

| Сервис      | Что внутри                                   | Хост               |
|-------------|----------------------------------------------|--------------------|
| `app`       | nginx + php serve + reverb + queue + SSR      | `8000`             |
| `app-dev`   | php serve + reverb + queue (dev-профиль)      | `8001`, `8080`     |
| `vite`      | vite dev-server (dev-профиль)                 | `5173`             |
| `mysql`     | MySQL 8, БД `live_map`, юзер `laravel`        | `3306`             |
| `redis`     | Redis 7                                       | `6379`             |
| `meilisearch` | зарезервирован, приложением пока не используется | `7700`          |

Креды БД в контейнерах задаёт `docker-compose.yml` (`live_map` / `laravel` / `secret`) и они имеют приоритет над `.env` — менять `.env` не нужно.

Подробности, команды и troubleshooting: [docs/docker.md](docs/docker.md).
Правила проекта: [AGENTS.md](AGENTS.md).
