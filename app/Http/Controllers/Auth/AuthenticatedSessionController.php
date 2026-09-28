<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Единый экран входа и регистрации.
     *
     * Отдельной страницы регистрации больше нет: тоггл «Вход / Регистрация»
     * живёт на `Auth/Login`, начальный режим берётся из query `?mode=register`
     * (см. `useAuthMode` на фронте). Ссылки на `route('register')` ведут сюда
     * редиректом из `RegisteredUserController::create`.
     *
     * @param Request $request входящий запрос (читаем query `mode`)
     * @return Response страница `Auth/Login` с режимом тоггла
     */
    public function create(Request $request): Response
    {
        $mode = $request->query('mode') === 'register' ? 'register' : 'login';

        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'mode' => $mode,
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();

        $fallback = $user->landingPath();

        return redirect()->intended($fallback);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
