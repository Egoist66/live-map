<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@upin.test');
        $password = env('ADMIN_PASSWORD', 'Admin123!');

        $admin = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Администратор ULove',
                'password' => Hash::make($password),
                'email_verified_at' => now(),
                'plan' => 'premium',
                'plan_expires_at' => now()->addYears(10),
                'role' => 'admin',
                'is_admin' => true,
                'level' => 'guide',
                'reputation_score' => 99999,
                'home_radius_km' => 50,
                'is_anonymous_default' => false,
                'is_invisible' => true,
                'settings' => [
                    'is_super_admin' => true,
                    'bypass_limits' => true,
                    'can_view_real_coords' => true,
                    'can_moderate' => true,
                ],
            ]
        );

        // Дефолт ULove-фишек — ВКЛ, но только для свежесозданного админа.
        // Повторный сид не должен затирать явное ВЫКЛ существующего админа.
        if ($admin->wasRecentlyCreated) {
            $admin->update([
                'dating_match_only' => true,
                'dating_hide_name' => true,
                'dating_hide_age' => true,
                'dating_hide_distance' => true,
                'dating_hide_rating' => true,
            ]);
        }

        $this->command->info("✓ Админ создан: {$admin->email} (ID: {$admin->id}, role: {$admin->role}, plan: {$admin->plan})");
        $this->command->info("  Пароль: {$password}");
        $this->command->warn("  Смените пароль после первого входа или задайте ADMIN_EMAIL/ADMIN_PASSWORD в .env");
    }
}
