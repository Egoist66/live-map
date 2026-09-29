# Лёгкий PHP-образ для dev-профиля: расширения + composer + opcache, без nginx/supervisor.
# Хост-код монтируется поверх, зависимости ставятся entrypoint при старте (только если volume пуст).

# Стейдж инструментов: chokidar ставим штатным npm из node-образа.
# Копировать сам npm в финал нельзя: лишний слой + кэш, а дергать его
# через COPY-сломанные симлинки — боль. Забираем только готовый артефакт.
FROM node:20-slim AS nodetools
RUN npm install -g chokidar

FROM php:8.4-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip \
    libzip-dev libpng-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install opcache pdo pdo_mysql pdo_sqlite pdo_pgsql mbstring zip bcmath gd sockets pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && rm -rf /tmp/pear ~/.pearrc \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Octane --watch гоняет file-watcher.cjs через node + chokidar.
# Без node (new ExecutableFinder)->find('node') отдаёт null и Symfony Process
# падает с `ValueError: First element must contain a non-empty program name`
# сразу после `Server running…` — контейнер выходит в 1 и тянет за собой
# reverb/queue/vite по depends_on.
# Берём бинарник node (обе базы — bookworm, glibc совпадает) и готовый
# chokidar из стейджа выше: chokidar резолвить из vendor/laravel/octane/bin
# через bind-mount с pnpm-раскладкой ненадёжен, а полный nodejs+npm из apt
# тянет ~800 МБ зависимостей.
# Node резолвит CJS-модули из NODE_PATH — так file-watcher.cjs находит
# глобальный chokidar без node_modules рядом с vendor.
# Объявлен ДО проверочного RUN: иначе require в том же слое его не видит.
ENV NODE_PATH=/usr/local/lib/node_modules
COPY --from=nodetools /usr/local/bin/node /usr/local/bin/node
COPY --from=nodetools /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && node -e "require('chokidar')" && node --version

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Dev-настройки PHP: opcache с мгновенной ревалидацией + realpath-кэш
# (bind-mount на Windows без него тормозит каждый stat через VirtioFS).
COPY docker/php-dev.ini /usr/local/etc/php/conf.d/dev.ini
COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

WORKDIR /var/www/html

EXPOSE 8000 8080

ENTRYPOINT ["dev-entrypoint.sh"]
