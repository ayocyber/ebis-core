#!/bin/sh
# Runs on every container start (Render free instances restart after sleeping).
set -e

cd /var/www/html

# Apache's own config listens on Render's $PORT.
sed -i "s/^Listen 80$//" /etc/apache2/ports.conf

php artisan config:cache
php artisan route:cache
php artisan view:cache

php artisan migrate --force

# Load the demo company once (the seeder skips itself if it already exists).
if [ "${DEMO_SEED:-false}" = "true" ]; then
    php artisan db:seed --class=DemoSeeder --force
fi

# The caches above were written as root; Apache runs as www-data.
chown -R www-data:www-data storage bootstrap/cache

# Render's free plan has no cron jobs, so run the scheduler inside the
# container. It only runs while the instance is awake.
su -s /bin/sh www-data -c "php artisan schedule:work" > /proc/1/fd/1 2>&1 &

exec apache2-foreground
