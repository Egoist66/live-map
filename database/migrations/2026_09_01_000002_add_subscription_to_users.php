<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('plan', ['free','pro','business'])->default('free')->after('password');
            $table->timestamp('plan_expires_at')->nullable()->after('plan');
            $table->integer('pins_today_count')->default(0)->after('plan_expires_at');
            $table->date('pins_today_date')->nullable()->after('pins_today_count');
            $table->string('stripe_id')->nullable()->index()->after('pins_today_date');
            $table->string('pm_type')->nullable()->after('stripe_id');
            $table->string('pm_last_four', 4)->nullable()->after('pm_type');
            $table->timestamp('trial_ends_at')->nullable()->after('pm_last_four');
            $table->decimal('latitude', 10, 7)->nullable()->after('trial_ends_at');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('stripe_id')->unique();
            $table->string('stripe_status');
            $table->string('stripe_price')->nullable();
            $table->integer('quantity')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['plan','plan_expires_at','pins_today_count','pins_today_date','stripe_id','pm_type','pm_last_four','trial_ends_at','latitude','longitude']);
        });
    }
};
