<?php

use App\Models\User;
use App\Services\ProfileSlugService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('profile_slug', 120)->nullable()->unique()->after('name');
        });

        $service = app(ProfileSlugService::class);

        User::whereNull('profile_slug')->chunkById(200, function ($users) use ($service) {
            foreach ($users as $user) {
                $slug = $service->uniqueSlug((string) $user->name, (int) $user->id);

                $user->forceFill(['profile_slug' => $slug])->saveQuietly();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('profile_slug');
        });
    }
};
