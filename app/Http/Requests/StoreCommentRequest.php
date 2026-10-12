<?php

namespace App\Http\Requests;

use App\Rules\NoProfanity;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Пример: создание комментария с локальной модерацией без ИИ.
 *
 * Три слоя из ТЗ, каждый бьёт по-своему:
 * 1) throttle на роуте (routes/api.php: throttle:comments-write) — частота;
 * 2) NoProfanity здесь — мат через Blasp и запретные темы, 422 с русским текстом;
 * 3) FloodGuard в контроллере — дубликаты, темп, капс и ссылки.
 *
 * Подключите к своему контроллеру:
 *   Route::post('/comments', [CommentController::class, 'store'])
 *       ->middleware('throttle:comments-write');
 *
 * Режим «блокировать» (этот файл) или «заменять на ***» — на выбор:
 * для мягкого режима уберите NoProfanity и чистите текст на сохранении:
 *   'text' => ContentModeration::mask($request->string('comment_text')),
 */
class StoreCommentRequest extends FormRequest
{
    /**
     * Авторизация — на усмотрение контроллера, здесь открыта.
     *
     * @return bool всегда true
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Правила: текст обязателен, длина в рамках, мат запрещён.
     *
     * @return array<string, array<mixed>>
     */
    public function rules(): array
    {
        return [
            'comment_text' => [
                'required',
                'string',
                'min:5',
                'max:500',
                new NoProfanity,
            ],
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
            'comment_text.required' => 'Напишите текст комментария.',
            'comment_text.min' => 'Комментарий слишком короткий.',
            'comment_text.max' => 'Комментарий длиннее 500 символов.',
        ];
    }
}
