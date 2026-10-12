<?php

namespace App\Http\Requests\Ai;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Валидация запроса на разбор дейтинг-профиля.
 *
 * Тело пустое: разбирается профиль текущего пользователя,
 * частота ограничена часовым лимитом в AiTextService.
 */
class AiProfileAnalysisRequest extends FormRequest
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
     * Дополнительных полей нет.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
