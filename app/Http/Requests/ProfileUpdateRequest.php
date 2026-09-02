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
        if ($this->has('bio') && is_string($this->input('bio'))) {
            $this->merge(['bio' => $this->sanitizeBio($this->input('bio'))]);
        }
    }

    private function sanitizeBio(string $html): string
    {
        $allowed = '<p><br><b><strong><i><em><u><s><a><ul><ol><li><h2><h3><blockquote><code><pre><span><div>';
        $html = strip_tags($html, $allowed);
        $html = preg_replace('/\s*on\w+\s*=\s*"[^"]*"/i', '', $html);
        $html = preg_replace("/\s*on\w+\s*=\s*'[^']*'/i", '', $html);
        $html = preg_replace('/javascript:/i', '', $html);
        $html = preg_replace('/<a([^>]*?)href\s*=\s*["\'](?!https?:\/\/|\/|#|mailto:)[^"\']*["\']/i', '<a$1', $html);
        $html = trim($html);
        if (trim(strip_tags($html)) === '') return '';
        return $html;
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
