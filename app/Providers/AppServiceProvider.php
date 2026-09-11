<?php

namespace App\Providers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Policies\CommentPolicy;
use App\Policies\PinPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        if (request()->header('X-Forwarded-Proto') === 'https') {
            URL::forceScheme('https');
        }
        Vite::prefetch(concurrency: 3);
        Gate::policy(Pin::class, PinPolicy::class);
        Gate::policy(PinComment::class, CommentPolicy::class);
        Gate::before(function ($user, $ability) {
            if ($user->isAdmin()) return true;
        });

        $byUser = fn (Request $r) => 'user:'.$r->user()?->getAuthIdentifier();
        $byIp = fn (Request $r) => 'ip:'.$r->ip();

        RateLimiter::for('auth-login', fn (Request $r) => Limit::perMinute(10)->by($byIp($r)));
        RateLimiter::for('auth-register', fn (Request $r) => Limit::perMinute(5)->by($byIp($r)));
        RateLimiter::for('auth-forgot', fn (Request $r) => Limit::perMinute(3)->by($byIp($r)));
        RateLimiter::for('auth-reset', fn (Request $r) => Limit::perMinute(6)->by($byIp($r)));
        RateLimiter::for('auth-confirm', fn (Request $r) => Limit::perMinute(10)->by($byUser($r)));

        RateLimiter::for('pins-write', fn (Request $r) => Limit::perMinute(20)->by($byUser($r)));
        RateLimiter::for('pins-index', fn (Request $r) => Limit::perMinute(120)->by($byUser($r)));
        RateLimiter::for('comments-write', fn (Request $r) => Limit::perMinute(60)->by($byUser($r)));
        RateLimiter::for('messages-write', fn (Request $r) => Limit::perMinute(60)->by($byUser($r)));
        RateLimiter::for('pin-toggle', fn (Request $r) => Limit::perMinute(60)->by($byUser($r)));
        RateLimiter::for('chat-signal', fn (Request $r) => Limit::perMinute(120)->by($byUser($r)));
        RateLimiter::for('realtime-sync', fn (Request $r) => Limit::perMinute(60)->by($byUser($r)));
        RateLimiter::for('reactions', fn (Request $r) => Limit::perMinute(120)->by($byUser($r)));
        RateLimiter::for('chat-search', fn (Request $r) => Limit::perMinute(30)->by($byUser($r)));
        RateLimiter::for('social-write', fn (Request $r) => Limit::perMinute(60)->by($byUser($r)));
        RateLimiter::for('screen-lock', fn (Request $r) => Limit::perMinute(30)->by($byUser($r)));
        RateLimiter::for('reports', fn (Request $r) => Limit::perMinute(10)->by($byUser($r)));
        RateLimiter::for('push-test', fn (Request $r) => Limit::perMinute(10)->by($byUser($r)));
        RateLimiter::for('profile-write', fn (Request $r) => Limit::perMinute(30)->by($byUser($r)));
    }
}
