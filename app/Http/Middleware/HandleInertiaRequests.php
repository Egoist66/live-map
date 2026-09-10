<?php

namespace App\Http\Middleware;

use App\Services\AppVersionService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'impersonating' => session()->has('impersonator_id'),
                'impersonator_id' => session('impersonator_id'),
            ],
            'unreadCount' => $request->user() ? $request->user()->unreadMessagesCount() : 0,
            'appVersion' => AppVersionService::version(),
        ];
    }
}
