<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\RedirectResponse;

class VerifyEmailController extends Controller
{
    /**
     * Подтвердить почту по ссылке из письма.
     *
     * Верификация общеприложенческая, поэтому ведём в нейтральный
     * профиль (dashboard) с флагом ?verified=1: intended-URL при этом
     * уважается (вернём туда, откуда человека отправили подтверждаться).
     * Глобальный баннер показывает тост «Почта подтверждена»
     * на любой странице — привязки к свайпам нет.
     */
    public function __invoke(EmailVerificationRequest $request): RedirectResponse
    {
        $target = route('dashboard', absolute: false).'?verified=1';

        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->intended($target);
        }

        if ($request->user()->markEmailAsVerified()) {
            event(new Verified($request->user()));
        }

        return redirect()->intended($target)->with('status', 'email-verified');
    }
}
