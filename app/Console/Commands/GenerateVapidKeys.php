<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class GenerateVapidKeys extends Command
{
    protected $signature = 'pwa:vapid';
    protected $description = 'Сгенерировать VAPID-ключи для Web Push';

    public function handle(): int
    {
        if (! class_exists(\Minishlink\WebPush\VAPID::class)) {
            $this->error('Пакет minishlink/web-push не установлен: composer require minishlink/web-push');
            return 1;
        }

        $keys = \Minishlink\WebPush\VAPID::createVapidKeys();
        $this->info('VAPID_PUBLIC_KEY='.$keys['publicKey']);
        $this->info('VAPID_PRIVATE_KEY='.$keys['privateKey']);
        $this->line('Добавь их в .env, затем выполни: php artisan config:clear');

        return 0;
    }
}
