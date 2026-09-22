<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Новости компании в UFlow и районах.
 *
 * flow_posts.business_id — пост от бренда (всегда в топе ленты),
 * flow_posts.business_ad_id — связь 1-к-1 с рекламой кабинета
 * (правка/удаление рекламы синхронит пост).
 * district_posts.business_ad_id — размещение рекламы в районе
 * (квота 3 в неделю на бизнес, удаление рекламы чистит копии).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('flow_posts', function (Blueprint $table) {
            $table->foreignId('business_id')->nullable()->after('user_id')->constrained('businesses')->nullOnDelete();
            $table->foreignId('business_ad_id')->nullable()->after('business_id')->constrained('business_ads')->cascadeOnDelete();
            $table->index('business_id');
            $table->unique('business_ad_id');
        });

        Schema::table('district_posts', function (Blueprint $table) {
            $table->foreignId('business_ad_id')->nullable()->after('district_id')->constrained('business_ads')->cascadeOnDelete();
            $table->index('business_ad_id');
        });
    }

    public function down(): void
    {
        Schema::table('district_posts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('business_ad_id');
        });

        Schema::table('flow_posts', function (Blueprint $table) {
            $table->dropUnique(['business_ad_id']);
            $table->dropConstrainedForeignId('business_ad_id');
            $table->dropIndex(['business_id']);
            $table->dropConstrainedForeignId('business_id');
        });
    }
};
