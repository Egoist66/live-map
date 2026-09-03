<?php

namespace App\Providers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Policies\CommentPolicy;
use App\Policies\PinPolicy;
use Illuminate\Support\Facades\Gate;
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
    }
}
