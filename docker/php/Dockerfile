# PHP-FPM pour le back Symfony (API + back-office).
FROM php:8.3-fpm-alpine

RUN apk add --no-cache icu-dev libzip-dev git unzip \
 && docker-php-ext-install pdo_mysql intl zip opcache

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/backend
