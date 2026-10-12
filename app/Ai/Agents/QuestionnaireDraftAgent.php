<?php

namespace App\Ai\Agents;

use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\Model;
use Laravel\Ai\Attributes\Provider;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;

/**
 * Генератор черновика дейтинг-анкеты по свободному промпту (Premium).
 *
 * Разбирает описание пользователя («я люблю походы, ищу девушку для
 * серьёзных отношений») и раскладывает по полям анкеты: цель, короткая
 * своя цель, развёрнутое «о себе» и список интересов. Работает на
 * бесплатной быстрой модели OpenRouter, частота ограничена в AiTextService.
 */
#[Provider(Lab::OpenRouter)]
#[Model('nvidia/nemotron-3.5-lightning:free')]
class QuestionnaireDraftAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Системные инструкции для модели-генератора.
     *
     * @return Stringable|string инструкции на русском языке
     */
    public function instructions(): Stringable|string
    {
        return 'Ты — помощник дейтинг-приложения ULove. '
            .'По свободному описанию пользователя собери черновик анкеты строго по схеме. '
            .'goal — одна из целей (love — отношения, flirt — флирт, friendship — дружба, chat — общение, interests — по интересам) '
            .'либо null, если цель не ясна. '
            .'custom_goal — короткая своя цель до 60 символов либо null. '
            .'about — живое описание «о себе» от первого лица до 600 символов: кто человек и кого ищет. '
            .'interests — до 10 коротких интересов строчными буквами без решётки. '
            .'Тон — дружелюбный, без пошлости, оскорблений и клише про «спортзал и путешествия», всё по-русски.';
    }

    /**
     * Схема структурированного черновика анкеты.
     *
     * @param  JsonSchema  $schema  билдер JSON-схемы
     * @return array<string, mixed> поля черновика
     */
    public function schema(JsonSchema $schema): array
    {
        $goal = $schema->string();
        $goal->enum(['love', 'flirt', 'friendship', 'chat', 'interests']);

        return [
            'goal' => $goal,
            'custom_goal' => $schema->string(),
            'about' => $schema->string()->required(),
            'interests' => $schema->array()->items($schema->string())->required(),
        ];
    }
}
