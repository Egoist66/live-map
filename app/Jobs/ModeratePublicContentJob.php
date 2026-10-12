<?php

namespace App\Jobs;

use App\Models\Report;
use App\Services\AiTextService;
use App\Services\ContentModeration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * AI-доанализ публичного контента вторым слоем (после regex).
 *
 * Regex уже заблокировал явный мат на создании (422). Эта задача ловит
 * завуалированную токсичность (оскорбления, угрозы, спам без мата) и:
 * - создаёт жалобу Report для админов;
 * - пишет лог для realtime-мониторинга.
 *
 * Удаление/блюр уже опубликованного решает фронт по флагам `moderation`
 * и вердикту POST /api/ai/moderate. Задача никогда не трогает чаты:
 * MessageController/ConversationController не диспатчат её намеренно.
 */
class ModeratePublicContentJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param string $kind flow_post|flow_comment|pin|pin_comment|district_post|district_comment|dating_review|business_ad|photo_caption
     * @param int $entityId id сущности
     * @param int $authorId id автора
     * @param string $text склеенный текст для анализа (до 2000 символов)
     */
    public function __construct(
        public string $kind,
        public int $entityId,
        public int $authorId,
        public string $text,
    ) {
    }

    /**
     * Выполнить AI-проверку и завести Report при токсичности.
     *
     * @return void
     */
    public function handle(): void
    {
        $text = mb_substr(trim($this->text), 0, AiTextService::MAX_TEXT_LENGTH);

        if ($text === '') return;

        try {
            $author = \App\Models\User::whereKey($this->authorId)->first(['id', 'role', 'is_admin']);

            if ($author && $author->canModerate()) return;
        } catch (\Throwable) {
        }

        if (ContentModeration::check($text) !== null) return;

        try {
            $verdict = app(AiTextService::class)->moderate($text);
        } catch (\Throwable $error) {
            Log::warning('moderate job failed: '.$error->getMessage());

            return;
        }

        if (! ($verdict['is_toxic'] ?? false)) return;

        $category = (string) ($verdict['category'] ?? 'ai');
        $reason = (string) ($verdict['reason'] ?? 'AI-модерация: токсичный контент');

        try {
            $isUserReport = $this->kind === 'dating_review';

            Report::create([
                'reporter_id' => $this->authorId,
                'target_type' => $isUserReport ? 'user' : 'comment',
                'target_id' => $isUserReport ? $this->authorId : $this->entityId,
                'reason' => 'abuse',
                'description' => 'auto-moderation '.$this->kind.'#'.$this->entityId.' '.$category.': '.mb_substr($reason, 0, 200),
                'status' => 'pending',
            ]);
        } catch (\Throwable $error) {
            Log::warning('moderate job report failed: '.$error->getMessage());
        }

        Log::warning('ai moderation flagged public content', [
            'kind' => $this->kind,
            'id' => $this->entityId,
            'category' => $category,
        ]);
    }
}
