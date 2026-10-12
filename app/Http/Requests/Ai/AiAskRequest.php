<?php

namespace App\Http\Requests\Ai;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация вопроса гиду по приложению.
 */
class AiAskRequest extends FormRequest
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
     * Правила валидации вопроса и id диалога.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'question' => ['required', 'string', 'min:2', 'max:1000'],
            'conversation_id' => ['nullable', 'string', 'max:36'],
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
            'question.required' => 'Спросите что-нибудь о приложении.',
            'question.min' => 'Вопрос слишком короткий.',
            'question.max' => 'Вопрос длиннее 1000 символов задайте поддержке.',
        ];
    }
}
