<?php

namespace App\Http\Requests\Ai;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация текста для AI-модерации.
 */
class AiModerateTextRequest extends FormRequest
{
    /**
     * Роуты уже за auth, отдельная политика не нужна.
     *
     * @return bool всегда true
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Правила валидации проверяемого текста.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'text' => ['required', 'string', 'min:1', 'max:2000'],
        ];
    }

    /**
     * Русские тексты ошибок валидации.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'text.required' => 'Передайте текст для проверки.',
            'text.max' => 'Текст длиннее 2000 символов не проверяем.',
        ];
    }
}
