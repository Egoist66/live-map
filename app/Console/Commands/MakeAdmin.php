<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class MakeAdmin extends Command
{
    protected $signature = 'make:admin {email?} {--password=} {--name=Администратор}';
    protected $description = 'Создать/повысить администратора (все привилегии по бизнес-логике)';

    public function handle(): int
    {
        $email = $this->argument('email') ?? $this->ask('Email админа', 'admin@live-map.test');
        $password = $this->option('password') ?? $this->secret('Пароль (оставьте пустым для автогенерации)');
        $name = $this->option('name');

        if (!$password) {
            $password = 'Admin123!';
            $this->warn("Пароль не указан — используется по умолчанию: {$password}");
        }

        $user = User::where('email', $email)->first();

        if ($user) {
            $user->update([
                'role' => 'admin',
                'is_admin' => true,
                'plan' => 'business',
                'plan_expires_at' => now()->addYears(10),
                'level' => 'guide',
                'reputation_score' => max($user->reputation_score, 99999),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);
            if ($this->confirm('Сменить пароль для существующего пользователя?', true)) {
                $user->update(['password' => Hash::make($password)]);
            }
            $this->info("✓ Пользователь {$email} повышен до администратора (ID: {$user->id})");
        } else {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
                'plan' => 'business',
                'plan_expires_at' => now()->addYears(10),
                'role' => 'admin',
                'is_admin' => true,
                'level' => 'guide',
                'reputation_score' => 99999,
                'home_lat' => 55.7558,
                'home_lng' => 37.6173,
                'home_radius_km' => 50,
                'latitude' => 55.7558,
                'longitude' => 37.6173,
            ]);
            $this->info("✓ Админ создан: {$email} (ID: {$user->id})");
        }

        $this->table(['Поле','Значение'], [
            ['Email', $user->email],
            ['Пароль', $password],
            ['Role', $user->role],
            ['Plan', $user->plan . ' (до ' . $user->plan_expires_at . ')'],
            ['Level', $user->level],
            ['Reputation', $user->reputation_score],
            ['TTL пина', $user->pinTtlHours() === null ? '∞' : $user->pinTtlHours().'ч'],
            ['Радиус', ($user->pinRadius()/1000).'км'],
            ['Лимит пинов', '∞ (bypass)'],
            ['Модерация', 'да'],
            ['Real coords', 'доступны'],
        ]);

        return self::SUCCESS;
    }
}
