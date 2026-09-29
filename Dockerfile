# Прод-образ: мультистейдж, в финале только рантайм.
# Было 2+ ГБ: полный node+npm+pnpm, devDeps в node_modules и pnpm-store
# оставались в финальном слое. Теперь фронт и vendor собираются отдельно,
# в рантайм едут только скомпилированные ассеты и готовый vendor.
# Node в финале — один бинарник из slim-образа (нужен только для Inertia SSR).

# ============ vendor: PHP-зависимости без dev-пакетов ============
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./
# --ignore-platform-reqs: в composer-образе нет PHP-расширений проекта
# (bcmath/gd/sockets ставятся в рантайм-стейдже ниже) — проверка платформы
# здесь бессмысленна, артефакт всё равно выполняется только в финале.
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs

# ============ frontend: Vite-билд + SSR-бандл ============
FROM node:20-slim AS frontend

RUN corepack enable \
    && corepack prepare pnpm@9 --activate \
    && pnpm --version

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

# `ziggy-js` заалиасен на vendor/tightenco/ziggy (tsconfig + vite.config),
# без PHP-vendor vue-tsc и vite-билд падают с TS2307.
COPY --from=vendor /app/vendor ./vendor

COPY . .

# VITE_* запекаются во фронтенд на этапе сборки.
ARG VITE_REVERB_HOST
ARG VITE_REVERB_PORT
ARG VITE_REVERB_SCHEME
ARG VITE_REVERB_APP_KEY
ARG VITE_APP_NAME
ENV VITE_REVERB_HOST=${VITE_REVERB_HOST} \
    VITE_REVERB_PORT=${VITE_REVERB_PORT} \
    VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME} \
    VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY} \
    VITE_APP_NAME=${VITE_APP_NAME}

RUN pnpm run build:ssr \
    && test -f bootstrap/ssr/ssr.js

# ============ runtime: PHP + nginx + supervisor + node-для-SSR ============
FROM php:8.4-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor curl gettext-base \
    libzip-dev libpng-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite pdo_pgsql mbstring zip bcmath gd sockets pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Node нужен в рантайме только для Inertia SSR (bootstrap/ssr/ssr.js):
# один бинарник из slim-образа вместо полного nodejs + npm + pnpm.
COPY --from=node:20-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
COPY --from=vendor /app/vendor ./vendor
COPY . .
COPY --from=frontend /app/public/build ./public/build
COPY --from=frontend /app/bootstrap/ssr ./bootstrap/ssr

RUN composer dump-autoload --optimize \
    && rm /usr/bin/composer \
    && mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache database \
    && touch database/database.sqlite \
    && chown -R www-data:www-data storage bootstrap/cache database \
    && chmod -R 775 storage bootstrap/cache

COPY docker/nginx.conf /etc/nginx/sites-enabled/default
# Шаблон держим ВНЕ sites-enabled, иначе nginx подхватит его как второй
# server-блок и упадёт с emerg на незаменённом ${PORT}.
COPY docker/nginx.conf.template /etc/nginx/default.template
COPY docker/nginx-limits.conf /etc/nginx/conf.d/limits.conf
COPY docker/php-uploads.ini /usr/local/etc/php/conf.d/uploads.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENV PORT=80

CMD ["/entrypoint.sh"]
