<?php

namespace App\Http\Requests\Ai;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация оценки ответа AI-гида.
 */
class AiFeedbackRequest extends FormRequest
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
     * Правила валидации оценки.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'conversation_id' => ['required', 'string', 'max:36'],
            'rating' => ['required', 'integer', 'in:-1,1'],
            'comment' => ['nullable', 'string', 'max:500'],
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
            'rating.in' => 'Оценка — только «помогло» или «не помогло».',
        ];
    }
}
