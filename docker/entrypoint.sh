#!/bin/sh
set -e
mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache database
touch -a database/database.sqlite || true
chown -R www-data:www-data storage bootstrap/cache database 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

php artisan config:clear || true

if [ -z "$APP_KEY" ]; then
  echo "APP_KEY not set, generating..."
  php artisan key:generate --force || true
fi

php artisan migrate --force || true
php artisan storage:link || true
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
