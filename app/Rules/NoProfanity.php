<?php

namespace App\Rules;

use App\Services\ContentModeration;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Правило «без мата и запретных тем» для FormRequest.
 *
 * Тонкая обёртка над ContentModeration (движок — Blasp + словари тем):
 * мат с обфускацией (х*й, п-и-з-д-а, ху0й, suka) и темы (политика,
 * наркотики, оружие) режутся одним правилом. Своё правило вместо
 * встроенного `blasp_check`: то покрывает только мат, а нам нужны
 * ещё темы + русское сообщение из ContentModeration.
 *
 * Режим — блокировка (fail): при нарушении валидация не проходит.
 * Для мягкого режима (замена на ***) используйте ContentModeration::mask().
 *
 * @example
 * use App\Rules\NoProfanity;
 *
 * public function rules(): array
 * {
 *     return [
 *         'comment_text' => ['required', 'string', 'min:5', 'max:500', new NoProfanity()],
 *     ];
 * }
 */
class NoProfanity implements ValidationRule
{
    /**
     * Проверить значение на мат и запретные темы.
     *
     * Персонал (`canModerate`) пропускается — как и в assertClean:
     * модераторам проверка нужна для работы с жалобами.
     *
     * @param string $attribute имя поля
     * @param mixed $value значение поля
     * @param Closure $fail callback ошибки валидации
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || trim($value) === '') {
            return;
        }

        try {
            if (auth()->user()?->canModerate()) {
                return;
            }
        } catch (\Throwable) {
        }

        $hit = ContentModeration::check($value);

        if ($hit !== null) {
            $fail($hit['message']);
        }
    }
}
