<?php

namespace App\Rules;

use App\Services\TurnstileService;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Request;

/**
 * Валидация капчи Cloudflare Turnstile.
 *
 * Использование: `'captcha_token' => ['required', new ValidTurnstile]`
 * на гостевых POST (регистрация, forgot/reset пароля, заявки).
 * Когда ключи не настроены (dev) — правило пропускает всех,
 * чтобы не блокировать разработку без Cloudflare.
 */
class ValidTurnstile implements ValidationRule
{
    /**
     * @param Request|null $request текущий запрос (для привязки проверки к IP)
     */
    public function __construct(private readonly ?Request $request = null) {}

    /**
     * Проверить токен капчи.
     *
     * @param string $attribute имя поля (captcha_token)
     * @param mixed $value токен виджета с фронта
     * @param Closure $fail callback ошибки валидации
     * @return void
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $ip = $this->request?->ip() ?? request()->ip();

        $ok = TurnstileService::verify(is_string($value) ? $value : null, $ip);

        if (! $ok) {
            $fail('Подтвердите, что вы не робот, и попробуйте снова.');
        }
    }
}
