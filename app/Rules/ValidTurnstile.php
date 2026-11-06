<?php

namespace App\Rules;

use App\Services\TurnstileService;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Request;

/**
 * Валидация капчи Cloudflare Turnstile.
 *
 * Использование: `'captcha_token' => ValidTurnstile::rules($request)`
 * на гостевых POST (регистрация, forgot/reset пароля, заявки).
 *
 * Поведение зависит от настроеннности капчи:
 * - ключи не заданы (dev) — поле nullable и токен не проверяется,
 *   чтобы не блокировать разработку без Cloudflare и не показывать
 *   техническую «Поле captcha token обязательно...» живому человеку;
 * - ключи заданы — токен обязателен: пустое поле — сообщение
 *   «подтвердите, что вы не робот», чужой/протухший токен —
 *   обычный провал проверки у Cloudflare.
 */
class ValidTurnstile implements ValidationRule
{
    /**
     * @param Request|null $request текущий запрос (для привязки проверки к IP)
     */
    public function __construct(private readonly ?Request $request = null) {}

    /**
     * Набор правил для поля `captcha_token`.
     *
     * Токен нельзя просто сделать nullable: nullable пропускает пустую
     * строку для не-implicit правил, и в проде бот отправил бы форму
     * вовсе без токена. Поэтому при настроенной капче — required.
     *
     * @param Request|null $request текущий запрос (для привязки IP)
     * @return string[]|ValidationRule[] список правил валидации
     */
    public static function rules(?Request $request = null): array
    {
        $check = new self($request);

        return TurnstileService::isEnabled()
            ? ['required', $check]
            : ['nullable', $check];
    }

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
        $token = is_string($value) ? trim($value) : '';

        if (! TurnstileService::isEnabled()) {
            return;
        }

        if ($token === '') {
            $fail(self::emptyMessage());

            return;
        }

        $ok = TurnstileService::verify($token, $ip);

        if (! $ok) {
            $fail(self::emptyMessage());
        }
    }

    /**
     * Сообщение для пустого токена, когда капча настроена.
     *
     * @return string текст ошибки валидации
     */
    public static function emptyMessage(): string
    {
        return 'Подтвердите, что вы не робот, и попробуйте снова.';
    }
}
