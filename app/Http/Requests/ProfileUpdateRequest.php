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
            'email' => ['required','string','lowercase','email','max:255', Rule::unique(User::class)->ignore($this->user()->id)],
            'home_lat' => ['nullable','numeric','between:-90,90'],
            'home_lng' => ['nullable','numeric','between:-180,180'],
            'home_radius_km' => ['nullable','integer','min:1','max:50'],
            'bio' => ['nullable','string','max:10000'],
            'is_anonymous_default' => ['nullable','boolean'],
            'avatar_path' => ['nullable','string','max:255'],
            'plan' => ['nullable','in:free,pro,business'],
        ];
    }
}
