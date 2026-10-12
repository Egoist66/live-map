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
 * Агент текстовой модерации (2-й слой после ContentModeration).
 *
 * Принимает спорный текст и возвращает строго типизированный вердикт:
 * токсичность, категория, уверенность и короткое обоснование.
 * Работает на бесплатной быстрой модели OpenRouter, ответ кэшируется в AiTextService.
 */
#[Provider(Lab::OpenRouter)]
#[Model('nvidia/nemotron-3.5-lightning:free')]
class TextSafetyAgent implements Agent, HasStructuredOutput
{
    use Promptable;

    /**
     * Системные инструкции для модели-модератора.
     *
     * @return Stringable|string инструкции на русском языке
     */
    public function instructions(): Stringable|string
    {
        return 'Ты — модератор русскоязычного социального приложения. '
            .'Оценивай ТОЛЬКО текст из запроса пользователя и отвечай строго по схеме. '
            .'Категории: insult — оскорбления и мат в адрес людей; hate — ненависть и экстремизм; '
            .'spam — спам, реклама, мошенничество; sexual — сексуальный контент и домогательства; '
            .'threat — угрозы и насилие; none — обычный безобидный текст. '
            .'Дружелюбный флирт и лёгкий юмор без унижения — это none. '
            .'Поле reason — одно короткое предложение на русском.';
    }

    /**
     * Схема структурированного ответа модератора.
     *
     * @param  JsonSchema  $schema  билдер JSON-схемы
     * @return array<string, mixed> поля вердикта
     */
    public function schema(JsonSchema $schema): array
    {
        $category = $schema->string();
        $category->enum(['insult', 'hate', 'spam', 'sexual', 'threat', 'none']);

        $confidence = $schema->string();
        $confidence->enum(['low', 'medium', 'high']);

        return [
            'is_toxic' => $schema->boolean()->required(),
            'category' => $category->required(),
            'confidence' => $confidence->required(),
            'reason' => $schema->string()->required(),
        ];
    }
}
