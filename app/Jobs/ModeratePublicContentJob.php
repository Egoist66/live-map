<?php

namespace App\Jobs;

use App\Models\Report;
use App\Models\User;
use App\Services\ContentModeration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Локальная проверка публичного контента вторым проходом (без ИИ и токенов).
 *
 * Синхронный слой (ContentModeration::assertClean) уже заблокировал явный
 * мат на создании (422). Эта задача — страховка на случай обхода синхронного
 * слоя (гонки, прямые вставки, новый сленг): перепроверяет текст тем же
 * локальным движком (Blasp + словари тем) и при срабатывании:
 * - создаёт жалобу Report для админов;
 * - пишет лог для realtime-мониторинга.
 *
 * Удаление/блюр уже опубликованного решает фронт по флагам `moderation`.
 * Задача никогда не трогает чаты: MessageController/ConversationController
 * не диспатчат её намеренно.
 */
class ModeratePublicContentJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * @param  string  $kind  flow_post|flow_comment|pin|pin_comment|district_post|district_comment|dating_review|business_ad|photo_caption|pipe_thread|pipe_reply
     * @param  int  $entityId  id сущности
     * @param  int  $authorId  id автора
     * @param  string  $text  склеенный текст для анализа (до 2000 символов)
     */
    public function __construct(
        public string $kind,
        public int $entityId,
        public int $authorId,
        public string $text,
    ) {}

    /**
     * Выполнить локальную проверку и завести Report при срабатывании.
     */
    public function handle(): void
    {
        $text = mb_substr(trim($this->text), 0, 2000);

        if ($text === '') {
            return;
        }

        try {
            $author = User::whereKey($this->authorId)->first(['id', 'role', 'is_admin']);

            if ($author && $author->canModerate()) {
                return;
            }
        } catch (\Throwable) {
        }

        $hit = ContentModeration::check($text);

        if ($hit === null) {
            return;
        }

        $category = (string) $hit['topic'];
        $reason = (string) $hit['message'];

        try {
            $isUserReport = $this->kind === 'dating_review';
            $isPipeTarget = in_array($this->kind, ['pipe_thread', 'pipe_reply'], true);

            if ($isUserReport) {
                // Отзывы и так проходят ручную модерацию в админке:
                // вторичный процесс снял текст с флагами — отзыв
                // отклоняем сразу, жалобу на автора не заводим.
                \App\Models\DatingReview::whereKey($this->entityId)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'rejected',
                        'moderated_at' => now(),
                    ]);
            } elseif ($isPipeTarget) {
                // Pipe-сущности заводят жалобу с их реальным target_type:
                // админка резолвит цель и удаляет контент по «Решено».
                Report::create([
                    'reporter_id' => $this->authorId,
                    'target_type' => $this->kind,
                    'target_id' => $this->entityId,
                    'reason' => 'abuse',
                    'description' => 'auto-moderation '.$this->kind.'#'.$this->entityId.' '.$category.': '.mb_substr($reason, 0, 200),
                    'status' => 'pending',
                ]);
            } else {
                Report::create([
                    'reporter_id' => $this->authorId,
                    'target_type' => 'comment',
                    'target_id' => $this->entityId,
                    'reason' => 'abuse',
                    'description' => 'auto-moderation '.$this->kind.'#'.$this->entityId.' '.$category.': '.mb_substr($reason, 0, 200),
                    'status' => 'pending',
                ]);
            }
        } catch (\Throwable $error) {
            Log::warning('moderate job report failed: '.$error->getMessage());
        }

        Log::warning('local moderation flagged public content', [
            'kind' => $this->kind,
            'id' => $this->entityId,
            'category' => $category,
        ]);
    }
}
