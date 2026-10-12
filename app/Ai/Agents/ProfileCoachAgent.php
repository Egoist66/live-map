<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Provider;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

/**
 * Коуч дейтинг-профиля: оценивает анкету и даёт конкретные улучшения.
 *
 * Возвращает строго типизированный разбор: оценка 1–10, сильные стороны,
 * что исправить, готовые варианты описания и фразы для первого сообщения.
 * Вызывается только по кнопке, частота ограничена в AiTextService.
 */
#[Provider(Lab::OpenRouter)]
class ProfileCoachAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Системные инструкции коуча профиля.
     *
     * @return Stringable|string инструкции на русском языке
     */
    public function instructions(): Stringable|string
    {
        return 'Ты — коуч дейтинг-профиля в приложении ULove. '
            .'Разбери анкету из запроса: оценка score от 1 до 10, '
            .'strengths — 2–4 сильные стороны, fixes — 2–4 конкретных исправления, '
            .'bio_variants — 3 готовых варианта описания до 160 символов в разных тональностях, '
            .'icebreakers — 3 фразы для первого сообщения с опорой на интересы анкеты. '
            .'Тон — поддерживающий, без пошлости и оскорблений, всё по-русски.';
    }

    /**
     * Схема структурированного ответа коуча.
     *
     * @param  JsonSchema  $schema  билдер JSON-схемы
     * @return array<string, mixed> поля разбора анкеты
     */
    public function schema(JsonSchema $schema): array
    {
        $stringList = $schema->array()->items($schema->string());

        $score = $schema->integer();
        $score->min(1)->max(10);

        return [
            'score' => $score->required(),
            'strengths' => $stringList->required(),
            'fixes' => $schema->array()->items($schema->string())->required(),
            'bio_variants' => $schema->array()->items($schema->string())->required(),
            'icebreakers' => $schema->array()->items($schema->string())->required(),
        ];
    }
}
