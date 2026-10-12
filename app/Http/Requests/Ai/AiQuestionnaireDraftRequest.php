<?php

namespace App\Http\Requests\Ai;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация промпта для AI-генерации черновика анкеты (Premium).
 */
class AiQuestionnaireDraftRequest extends FormRequest
{
    /**
     * Роуты уже за auth, тариф проверяет контроллер.
     *
     * @return bool всегда true
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Правила валидации промпта.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'prompt' => ['required', 'string', 'min:3', 'max:500'],
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
            'prompt.required' => 'Опишите, какую анкету хотите.',
            'prompt.min' => 'Опишите чуть подробнее — хотя бы пара слов.',
            'prompt.max' => 'Промпт длиннее 500 символов не разберём.',
        ];
    }
}
