<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Rules\NoContactInfo;
use App\Rules\NoProfanity;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('bio')) {
            $raw = $this->input('bio');
            if (is_string($raw)) {
                $sanitized = $this->sanitizeBio($raw);
                $this->merge(['bio' => $sanitized]);
            } elseif ($raw === null || $raw === '') {
                $this->merge(['bio' => null]);
            }
        }
        if ($this->has('thought')) {
            $raw = $this->input('thought');
            if (is_string($raw)) {
                $this->merge(['thought' => $this->sanitizeThought($raw)]);
            } elseif ($raw === null || $raw === '') {
                $this->merge(['thought' => null]);
            }
        }
    }

    private function sanitizeBio(string $text): ?string
    {
        $text = strip_tags($text);
        $text = trim($text);
        $text = preg_replace("/\r\n?/", "\n", $text);
        if ($text === '' || $text === null) return null;
        return mb_substr($text, 0, 10000);
    }

    private function sanitizeThought(string $text): ?string
    {
        $text = strip_tags($text);
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));
        if ($text === '') return null;
        return mb_substr($text, 0, 140);
    }

    /**
     * Лимит смены имени: один раз бесплатно, безлимит на Premium.
     *
     * Стафф (админ/модератор) и топ-тарифы не лимитируем —
     * смена считается только при реальном изменении значения.
     * Ошибка ложится на поле name и видна под инпутом.
     *
     * @param mixed $value новое имя из запроса
     * @param \Closure $fail callback ошибки валидации
     * @return void
     */
    private function assertNameChangeAllowed(mixed $value, \Closure $fail): void
    {
        if (! is_string($value)) {
            return;
        }

        $user = $this->user();

        if (! $user instanceof User) {
            return;
        }

        $nextName = trim($value);

        if ($nextName === trim((string) $user->name)) {
            return;
        }

        if ($user->canChangeName()) {
            return;
        }

        $fail('Смена имени уже использована (1 раз бесплатно). Безлимит — на тарифе Premium.');
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255', new NoProfanity(), new NoContactInfo(), function ($attr, $value, $fail) {
                $this->assertNameChangeAllowed($value, $fail);
            }],
            'gender' => ['nullable','in:male,female,other'],
            'birth_date' => ['nullable','date','before:today','after:1900-01-01'],
            'country' => ['nullable','string','max:120'],
            'country_code' => ['nullable','string','max:8'],
            'email' => ['required','string','lowercase','email','max:255', Rule::unique(User::class)->ignore($this->user()->id)],
            'home_lat' => ['nullable','numeric','between:-90,90'],
            'home_lng' => ['nullable','numeric','between:-180,180'],
            'home_city' => ['nullable','string','max:120'],
            'home_address' => ['nullable','string','max:255'],
            'home_visibility' => ['nullable','in:everyone,friends,none'],
            'home_show_exact' => ['nullable','boolean', function ($attr, $value, $fail) {
                if (! $value) return;
                $user = $this->user();
                $isAdmin = (bool) ($user?->is_admin || $user?->role === 'admin');
                if ($isAdmin) return;
                $plan = $user?->effectivePlan() ?? 'free';
                if (! in_array($plan, ['pro', 'premium', 'business'])) {
                    $fail('Точное местоположение дома доступно на тарифе Pro или Premium.');
                }
            }],
            'home_radius_km' => ['nullable','integer','min:1','max:500', function ($attr, $value, $fail) {
                if ($value === null || $value === '') return;
                $isAdmin = (bool) ($this->user()?->is_admin || $this->user()?->role === 'admin');
                if ($isAdmin) return;
                $plan = $this->user()?->effectivePlan() ?? 'free';
                $max = in_array($plan, ['premium', 'business'], true) ? 50 : ($plan === 'pro' ? 15 : 10);
                if ((int) $value > $max) {
                    $need = $max >= 50 ? 'Premium' : ($max >= 15 ? 'Pro' : 'Pro (Free — до 10 км)');
                    $fail("Максимум {$max} км на твоём тарифе. Нужно: {$need} — радиус = зона видимости пина.");
                }
            }],
            'bio' => ['nullable','string','max:10000', new NoContactInfo()],
            'thought' => ['nullable','string','max:140', new NoContactInfo()],
            'is_anonymous_default' => ['nullable','boolean'],
            'default_location_precision' => ['nullable','in:blur_200,exact,district,custom'],
            'default_blur_meters' => ['nullable','integer','min:0','max:5000'],
            'avatar_path' => ['nullable','string','max:255'],
            'photo_comments_privacy' => ['nullable','in:everyone,friends,none'],
            'flow_comments_privacy' => ['nullable','in:everyone,friends,none'],
        ];
    }
}
