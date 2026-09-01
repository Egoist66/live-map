<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@live-map.test');
        $password = env('ADMIN_PASSWORD', 'Admin123!');

        $admin = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Администратор Live Map',
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
                'is_anonymous_default' => false,
                'settings' => [
                    'is_super_admin' => true,
                    'bypass_limits' => true,
                    'can_view_real_coords' => true,
                    'can_moderate' => true,
                ],
            ]
        );

        $this->command->info("✓ Админ создан: {$admin->email} (ID: {$admin->id}, role: {$admin->role}, plan: {$admin->plan})");
        $this->command->info("  Пароль: {$password}");
        $this->command->warn("  Смените пароль после первого входа или задайте ADMIN_EMAIL/ADMIN_PASSWORD в .env");
    }
}
