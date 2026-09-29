# Лёгкий PHP-образ для dev-профиля: расширения + composer + opcache, без nginx/supervisor.
# Хост-код монтируется поверх, зависимости ставятся entrypoint при старте (только если volume пуст).
FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    git unzip nodejs npm \
    libzip-dev libpng-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install opcache pdo pdo_mysql pdo_sqlite pdo_pgsql mbstring zip bcmath gd sockets pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Octane --watch гоняет file-watcher.cjs через node + chokidar.
# Без node (new ExecutableFinder)->find('node') отдаёт null и Symfony Process
# падает с `ValueError: First element must contain a non-empty program name`
# сразу после `Server running…` — контейнер выходит в 1 и тянет за собой
# reverb/queue/vite по depends_on. chokidar ставим глобально: резолв из
# vendor/laravel/octane/bin через bind-mount с pnpm-раскладкой ненадёжен.
RUN npm install -g chokidar

# Node резолвит CJS-модули из NODE_PATH — так file-watcher.cjs находит
# глобальный chokidar без node_modules рядом с vendor.
ENV NODE_PATH=/usr/lib/node_modules

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Dev-настройки PHP: opcache с мгновенной ревалидацией + realpath-кэш
# (bind-mount на Windows без него тормозит каждый stat через VirtioFS).
COPY docker/php-dev.ini /usr/local/etc/php/conf.d/dev.ini
COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

WORKDIR /var/www/html

EXPOSE 8000 8080

ENTRYPOINT ["dev-entrypoint.sh"]
