FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    nginx supervisor curl git unzip gettext-base \
    libzip-dev libpng-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite pdo_pgsql mbstring zip bcmath gd sockets pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

ENV NPM_CONFIG_minimum-release-age=0
ENV PNPM_CONFIG_minimum-release-age=0

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY .npmrc* package.json pnpm-lock.yaml* package-lock.json* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --config.minimum-release-age=0 --frozen-lockfile || pnpm install --config.minimum-release-age=0 --no-frozen-lockfile; else npm ci; fi

COPY . .

ARG VITE_REVERB_HOST
ARG VITE_REVERB_PORT
ARG VITE_REVERB_SCHEME
ARG VITE_REVERB_APP_KEY
ARG VITE_APP_NAME
ENV VITE_REVERB_HOST=${VITE_REVERB_HOST}
ENV VITE_REVERB_PORT=${VITE_REVERB_PORT}
ENV VITE_REVERB_SCHEME=${VITE_REVERB_SCHEME}
ENV VITE_REVERB_APP_KEY=${VITE_REVERB_APP_KEY}
ENV VITE_APP_NAME=${VITE_APP_NAME}

RUN composer dump-autoload --optimize \
    && if [ -f pnpm-lock.yaml ]; then pnpm --config.minimum-release-age=0 run build:ssr; else npm run build:ssr; fi \
    && test -f bootstrap/ssr/ssr.js \
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
