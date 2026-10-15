<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'website' => ['nullable', 'string', 'max:255'],
            'captcha_token' => ['nullable', 'string', 'max:2048'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * Антибот-слой (поверх throttle и LoginShield):
     * - honeypot `website` заполнен → сразу generic-ошибка (100% бот);
     * - 2+ фейла подряд по email и капча настроена → токен обязателен
     *   (прогрессивный челлендж: первый вход без трения, брутфорс — с капчей);
     * - токен прислали при любом числе фейлов → проверяем (fail-closed).
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        if (\App\Services\TurnstileService::honeypotFilled($this->input('website'))) {
            \Illuminate\Support\Facades\Log::warning('bot blocked', [
                'reason' => 'honeypot',
                'ip' => $this->ip(),
                'path' => 'login',
                'ua' => mb_substr((string) $this->userAgent(), 0, 256),
            ]);

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        $this->ensureCaptchaWhenChallenged();

        $email = \App\Services\LoginShield::normalizeEmail($this->input('email'));
        $user = \App\Models\User::where('email', $email)->first();
        \App\Services\LoginShield::check($email, $user);

        // Долгая сессия (2 недели) выдаётся всем сразу, без «запомнить меня».
        if (! Auth::attempt($this->only('email', 'password'))) {
            RateLimiter::hit($this->throttleKey());

            $res = \App\Services\LoginShield::recordFail($email, $this->ip(), (string) $this->userAgent(), $user);
            if ($res['banned']) {
                throw ValidationException::withMessages([
                    'email' => 'Неверный логин или пароль. Аккаунт заблокирован навсегда за 4 неверные попытки — обратитесь к администратору.',
                ]);
            }
            if ($res['fails'] >= \App\Services\LoginShield::COOLDOWN_FAILS) {
                throw ValidationException::withMessages([
                    'email' => 'Неверный логин или пароль. Это 3-я неудачная попытка — вход заморожен на час.',
                ]);
            }

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
        \App\Services\LoginShield::recordSuccess($email, $this->ip(), (string) $this->userAgent(), Auth::id());
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Прогрессивная капча: после 2 фейлов подряд требовать токен.
     *
     * Порог 2 (а не 3 как заморозка LoginShield): бот уже на втором
     * круге упирается в виджет, человеку виджет показывается лишь
     * при повторной ошибке в пароле. Без настроенных ключей — пропуск.
     *
     * @throws ValidationException
     */
    public function ensureCaptchaWhenChallenged(): void
    {
        if (! \App\Services\TurnstileService::isEnabled()) {
            return;
        }

        $email = \App\Services\LoginShield::normalizeEmail($this->input('email'));
        $fails = \App\Services\LoginShield::consecutiveFails($email)['count'] ?? 0;

        $token = $this->input('captcha_token');
        $hasToken = is_string($token) && trim($token) !== '';

        if ($fails < 2 && ! $hasToken) {
            return;
        }

        $ok = \App\Services\TurnstileService::verify(
            is_string($token) ? $token : null,
            $this->ip()
        );

        if (! $ok) {
            throw ValidationException::withMessages([
                'captcha_token' => 'Подтвердите, что вы не робот, и попробуйте снова.',
            ]);
        }
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
