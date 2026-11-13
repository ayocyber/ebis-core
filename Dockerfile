# Production image for Render (free plan). Three stages:
#   1. vendor  - PHP dependencies (the frontend build needs vendor/tightenco/ziggy)
#   2. assets  - Vite build of the React frontend
#   3. app     - PHP 8.4 + Apache serving public/

# ---- 1. PHP dependencies -------------------------------------------------
FROM composer:2.8 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist \
    --no-interaction --ignore-platform-reqs

# ---- 2. Frontend assets --------------------------------------------------
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
COPY --from=vendor /app/vendor ./vendor
ARG VITE_APP_NAME="ProcurPilot"
ENV VITE_APP_NAME=${VITE_APP_NAME}
RUN npm run build

# ---- 3. Runtime ----------------------------------------------------------
FROM php:8.4-apache AS app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libzip-dev libicu-dev unzip \
    && docker-php-ext-install pdo_pgsql zip intl opcache bcmath \
    && rm -rf /var/lib/apt/lists/* \
    && a2enmod rewrite headers

COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
        storage/logs storage/app/private bootstrap/cache \
    && sed -i 's/\r$//' docker/entrypoint.sh \
    && composer dump-autoload --optimize --no-dev --classmap-authoritative \
    && php artisan package:discover --ansi \
    && rm -f public/hot \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod +x docker/entrypoint.sh

# Render sends traffic to $PORT (10000 by default).
ENV PORT=10000
EXPOSE 10000

ENTRYPOINT ["docker/entrypoint.sh"]
