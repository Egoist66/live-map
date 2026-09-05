<?php

namespace App\Http\Requests;

use App\Models\User;
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
    }

    private function sanitizeBio(string $text): ?string
    {
        $text = strip_tags($text);
        $text = trim($text);
        $text = preg_replace("/\r\n?/", "\n", $text);
        if ($text === '' || $text === null) return null;
        return mb_substr($text, 0, 10000);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'gender' => ['nullable','in:male,female,other'],
            'email' => ['required','string','lowercase','email','max:255', Rule::unique(User::class)->ignore($this->user()->id), function ($attr, $value, $fail) {
                $user = $this->user();
                if (!$user || mb_strtolower((string) $value) === mb_strtolower((string) $user->email)) return;
                $isAdmin = (bool) ($user->is_admin || $user->role === 'admin');
                if ($isAdmin) return;
                if (($user->plan ?? 'free') !== 'business') {
                    $fail('Смена почты доступна на тарифе Business.');
                }
            }],
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
                $plan = $this->input('plan', $user?->plan ?? 'free');
                if (! in_array($plan, ['pro', 'business'])) {
                    $fail('Точное местоположение дома доступно на тарифе Pro/Business.');
                }
            }],
            'home_radius_km' => ['nullable','integer','min:1','max:500', function ($attr, $value, $fail) {
                if ($value === null || $value === '') return;
                $isAdmin = (bool) ($this->user()?->is_admin || $this->user()?->role === 'admin');
                if ($isAdmin) return;
                $plan = $this->input('plan', $this->user()?->plan ?? 'free');
                $max = $plan === 'business' ? 50 : ($plan === 'pro' ? 15 : 5);
                if ((int) $value > $max) {
                    $need = $max >= 50 ? 'Business' : ($max >= 15 ? 'Pro' : 'Free (5 км)');
                    $fail("Максимум {$max} км на твоём тарифе. Нужно: {$need} — радиус = зона видимости пина.");
                }
            }],
            'bio' => ['nullable','string','max:10000'],
            'is_anonymous_default' => ['nullable','boolean'],
            'default_location_precision' => ['nullable','in:blur_200,exact,district,custom'],
            'default_blur_meters' => ['nullable','integer','min:0','max:5000'],
            'avatar_path' => ['nullable','string','max:255'],
            'plan' => ['nullable','in:free,pro,business'],
        ];
    }
}
