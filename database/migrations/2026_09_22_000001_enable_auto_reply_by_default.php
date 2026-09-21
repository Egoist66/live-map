<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Автоответ «меня нет онлайн» включён по умолчанию:
        // новые пользователи получают true из дефолта колонки.
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `users` MODIFY `auto_reply_enabled` TINYINT(1) NOT NULL DEFAULT 1');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "users" ALTER COLUMN "auto_reply_enabled" SET DEFAULT true');
        } elseif ($driver === 'sqlite') {
            DB::statement('ALTER TABLE "users" ALTER COLUMN "auto_reply_enabled" SET DEFAULT 1');
        }

        // И включаем всем уже зарегистрированным.
        DB::table('users')->where('auto_reply_enabled', false)->update(['auto_reply_enabled' => true]);
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE `users` MODIFY `auto_reply_enabled` TINYINT(1) NOT NULL DEFAULT 0');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE "users" ALTER COLUMN "auto_reply_enabled" SET DEFAULT false');
        } elseif ($driver === 'sqlite') {
            DB::statement('ALTER TABLE "users" ALTER COLUMN "auto_reply_enabled" SET DEFAULT 0');
        }
    }
};
