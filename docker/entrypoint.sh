#!/bin/sh
set -e
export PORT=${PORT:-80}
echo "Starting on PORT=$PORT"
envsubst '${PORT}' < /etc/nginx/default.template > /etc/nginx/sites-enabled/default
cat /etc/nginx/sites-enabled/default

mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache database
touch -a database/database.sqlite || true
chown -R www-data:www-data storage bootstrap/cache database 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

php artisan optimize:clear || true

if [ -z "$APP_KEY" ]; then
  echo "APP_KEY not set, generating..."
  php artisan key:generate --force || true
fi

if [ "$DB_CONNECTION" = "sqlite" ]; then
  echo "Using sqlite, ensuring file exists"
  touch database/database.sqlite || true
fi

if [ "$DB_CONNECTION" = "mysql" ]; then
  echo "Waiting for MySQL $DB_HOST:$DB_PORT..."
  for i in $(seq 1 30); do
    php artisan migrate:status >/dev/null 2>&1 && break
    echo "MySQL not ready, retry $i/30..."
    sleep 2
  done
fi

php artisan migrate --force || true
php artisan storage:link || true
php artisan optimize || true

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
