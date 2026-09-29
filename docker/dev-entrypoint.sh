#!/bin/bash
# Entrypoint dev-контейнеров: быстрый старт с hot reload.
# Роль задаётся env DEV_ROLE: app (Octane) | reverb | queue.
set -e

cd /var/www/html
export PATH="$PWD/vendor/bin:$PATH"

# Зависимости — только если volume пуст (переживает рестарты).
# Все dev-сервисы делят volume dev-vendor и стартуют ПОСЛЕ app-dev
# (depends_on healthy), поэтому гонки composer install нет:
# ставит только app, остальные видят готовый vendor.
if [ "${DEV_ROLE:-app}" = "app" ] && [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

# Ждём готовности vendor (для reverb/queue, если app ещё ставит).
for i in $(seq 1 60); do
  if [ -f vendor/autoload.php ]; then
    break
  fi
  sleep 1
done

case "${DEV_ROLE:-app}" in
  reverb)
    exec php artisan reverb:start --host=0.0.0.0 --port=8080
    ;;
  queue)
    exec php artisan queue:listen --tries=3 --sleep=1 --timeout=60
    ;;
  app|*)
    php artisan migrate --force --no-interaction || true
    (php artisan storage:link || true)

    # Octane + RoadRunner: приложение живёт в памяти воркеров —
    # TTFB в разы ниже, чем у artisan serve (boot на каждый запрос).
    # --watch = hot reload бэкенда: правишь app/routes/config —
    # воркеры перезапускаются сами (~1-2 сек).
    # --poll обязателен: Windows bind-mount не пробрасывает inotify
    # в контейнер, без polling вотчер изменения молча не видит.
    if [ -f vendor/bin/rr ]; then
      exec php artisan octane:start \
        --server=roadrunner \
        --host=0.0.0.0 \
        --port=8000 \
        --watch \
        --poll \
        --workers=auto \
        --max-requests=500
    fi

    # Фолбэк, если rr-библиотека не поставилась.
    # --no-reload обязателен: без флага artisan serve режет окружение
    # дочернего php -S до $passthroughVariables и контейнерные
    # DB_HOST/REDIS_HOST теряются (падение на .env 127.0.0.1).
    exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
    ;;
esac
