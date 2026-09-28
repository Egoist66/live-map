<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailVerificationNotificationController extends Controller
{
    /**
     * Отправить ссылку подтверждения по явной кнопке пользователя.
     *
     * Автоматических отправок нет: письмо уходит только отсюда
     * (модалка подтверждения, раздел «Безопасность» в настройках).
     * Уже подтверждённым отвечает verified без отправки.
     * Для AJAX (фронтовый баннер «Отправить заново») отдаём JSON,
     * для Inertia-форм — как раньше редирект со статусом.
     */
    public function store(Request $request): RedirectResponse|\Illuminate\Http\JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            if ($request->wantsJson()) {
                return response()->json(['verified' => true]);
            }

            return redirect()->intended(route('dashboard', absolute: false));
        }

        $request->user()->sendEmailVerificationNotification();

        if ($request->wantsJson()) {
            return response()->json(['status' => 'verification-link-sent']);
        }

        return back()->with('status', 'verification-link-sent');
    }
}
