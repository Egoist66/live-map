# Лёгкий PHP-образ для dev-профиля: расширения + composer, без nginx/supervisor.
# Хост-код монтируется поверх, зависимости ставятся командой сервиса при старте.
FROM php:8.4-cli

RUN apt-get update && apt-get install -y \
    git unzip \
    libzip-dev libpng-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_sqlite pdo_pgsql mbstring zip bcmath gd sockets pcntl \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

EXPOSE 8000 8080

# --no-reload обязателен: без флага artisan serve режет окружение дочернего
# php -S до $passthroughVariables и контейнерные DB_HOST/REDIS_HOST теряются
# (см. command сервиса app-dev в docker-compose.yml).
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", "--no-reload"]
