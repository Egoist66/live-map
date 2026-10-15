<?php

namespace App\Http\Middleware;

use App\Services\TelegramOnboarding;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Жёсткий гейт анкеты-онбординга для Mini App сессий.
 *
 * Флаг `onboarding_only` ставит только Telegram-вход (Mini App):
 * браузерный логин его никогда не получает, поэтому обычные юзеры
 * (включая пол `other`) гейтом не задеваются. Требование — только для
 * новых аккаунтов (TelegramOnboarding::isRequired, grandfather-дата
 * `telegram.onboarding_required_since`): старые освобождены.
 * Пока флаг стоит и анкета обязана — закрыто всё, кроме самой анкеты,
 * входа/выхода и почты: ни почитать, ни полайкать, ни подёргать API
 * мимо формы нельзя.
 * Стафф (админы/модераторы) освобождён — им Mini App нужен для работы.
 *
 * Страницы уводим редиректом на `/onboarding`, API/JSON получают
 * 403 с флагом `onboarding_required` (фронт тоже уводит на форму).
 */
class EnsureOnboardingComplete
{
    /**
     * Пути, открытые даже под флагом (сама анкета, вход, почта, версия).
     *
     * @var string[]
     */
    private const EXEMPT = [
        'onboarding',
        'onboarding/*',
        'api/onboarding/*',
        'api/telegram/auth',
        'api/telegram/status',
        'api/version',
        'login',
        'register',
        'register/*',
        'forgot-password',
        'reset-password/*',
        'verify-email/*',
        'email/verification-notification',
        'email/verification-status',
        'confirm-password',
        'logout',
        'up',
    ];

    /**
     * Проверить флаг и completeness, заблокировать при нужде.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой
     * @return Response пропуск, редирект на анкету либо 403 JSON
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->isGated($request)) {
            return $next($request);
        }

        if ($request->is('api/*') || $request->expectsJson()) {
            return response()->json([
                'message' => 'Сначала заполните анкету — без неё приложение закрыто.',
                'onboarding_required' => true,
            ], 403);
        }

        return redirect('/onboarding');
    }

    /**
     * Нужна ли блокировка для этого запроса.
     *
     * @param Request $request текущий запрос
     * @return bool true — флаг стоит, юзер не стафф, анкета неполна
     */
    private function isGated(Request $request): bool
    {
        try {
            $flagged = (bool) $request->session()->get('onboarding_only', false);
        } catch (\Throwable) {
            return false;
        }

        if (! $flagged) {
            return false;
        }

        if ($request->is(...self::EXEMPT)) {
            return false;
        }

        try {
            $user = $request->user() ?? auth()->user();
        } catch (\Throwable) {
            return false;
        }

        if ($user === null) {
            return false;
        }

        try {
            if ($user->canModerate()) {
                return false;
            }

            $fresh = $user->fresh() ?? $user;

            if (! TelegramOnboarding::isRequired($fresh)) {
                $request->session()->forget('onboarding_only');

                return false;
            }
        } catch (\Throwable) {
            return false;
        }

        return true;
    }
}
