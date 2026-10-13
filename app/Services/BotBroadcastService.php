<?php

namespace App\Services;

use App\Jobs\BroadcastBotBroadcastTelegram;
use App\Models\BotBroadcast;
use App\Models\BotBroadcastMessage;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Рассылка админа всем пользователям Telegram-бота.
 *
 * Админ собирает пост в боте (/publish): статья уходит красиво
 * оформленным лонгридом, опрос — нативным sendPoll. Каждый
 * получатель видит копию у себя в чате с ботом, голоса опросов
 * стекаются сюда через poll_answer и видны в статистике.
 * Отписка — штатным тумблером новостей (/notify → ntg_news).
 */
class BotBroadcastService
{
    /**
     * TTL дедупа доставки одному человеку (месяц, как у новостей).
     */
    public const DEDUP_TTL_SECONDS = 30 * 86400;

    /**
     * Создать рассылку из черновика мастера /publish.
     *
     * Проверяем лимиты Bot API заранее, чтобы превью не обещало
     * того, что рассылка не сможет отправить.
     *
     * @param array<string, mixed> $draft черновик из TelegramPublishPanel
     * @param User $admin автор-админ
     * @return BotBroadcast созданная рассылка в статусе draft
     * @throws \RuntimeException с человеческой причиной отказа
     */
    public static function createFromDraft(array $draft, User $admin): BotBroadcast
    {
        $type = (string) ($draft['type'] ?? '');

        if ($type === 'poll') {
            return self::createPollFromDraft($draft, $admin);
        }

        if ($type === 'article') {
            return self::createArticleFromDraft($draft, $admin);
        }

        throw new \RuntimeException('Неизвестный тип публикации.');
    }

    /**
     * Поставить рассылку в очередь доставки всем.
     *
     * Статус сразу sending + published_at: повторный тап «Разослать»
     * упрётся в статус и второй веер не запустит.
     *
     * @param BotBroadcast $broadcast рассылка в статусе draft
     * @return void
     */
    public static function publish(BotBroadcast $broadcast): void
    {
        $fresh = $broadcast->fresh() ?? $broadcast;

        if ($fresh->status !== 'draft') {
            return;
        }

        $fresh->forceFill([
            'status' => 'sending',
            'published_at' => now(),
        ])->save();

        BroadcastBotBroadcastTelegram::dispatch((int) $fresh->id)->afterCommit();
    }

    /**
     * Разнести рассылку всем подписанным чанками по 200.
     *
     * Гейты (мастер, тумблер новостей, 403-блок) и дедуп — внутри
     * deliverTo, поэтому повторный прогон безопасен: уже получившие
     * отсеются по ключу tg:bb:{broadcast}:{user}.
     *
     * @param BotBroadcast $broadcast рассылка в статусе sending
     * @return int скольким доставлено этим прогоном
     */
    public static function broadcast(BotBroadcast $broadcast): int
    {
        $delivered = 0;

        if (! TelegramBotApi::configured()) {
            Log::warning('telegram broadcast skipped: no bot token', ['broadcast_id' => (int) $broadcast->id]);

            return 0;
        }

        try {
            User::whereNotNull('telegram_id')
                ->whereNull('telegram_blocked_at')
                ->where(function ($query) {
                    $query->whereNull('telegram_notify_enabled');
                    $query->orWhere('telegram_notify_enabled', true);
                })
                ->where(function ($query) {
                    $query->whereNull('telegram_notify_news');
                    $query->orWhere('telegram_notify_news', true);
                })
                ->orderBy('id')
                ->chunk(200, function ($users) use ($broadcast, &$delivered) {
                    foreach ($users as $user) {
                        try {
                            if (self::deliverTo($broadcast, $user)) {
                                $delivered++;
                            }
                        } catch (\Throwable $e) {
                            Log::warning('telegram broadcast failed', [
                                'user_id' => (int) $user->id,
                                'broadcast_id' => (int) $broadcast->id,
                                'error' => $e->getMessage(),
                            ]);
                        }
                    }
                });
        } catch (\Throwable $e) {
            Log::warning('telegram broadcast chunk failed', [
                'broadcast_id' => (int) $broadcast->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info('telegram broadcast done', ['broadcast_id' => (int) $broadcast->id, 'delivered' => $delivered]);

        return $delivered;
    }

    /**
     * Доставить копию одному получателю и записать статистику.
     *
     * @param BotBroadcast $broadcast рассылка
     * @param User $recipient получатель
     * @return bool true когда копия доставлена этим вызовом
     */
    public static function deliverTo(BotBroadcast $broadcast, User $recipient): bool
    {
        if (! TelegramNotifier::canNotify($recipient, 'news')) {
            return false;
        }

        $dedupKey = 'tg:bb:'.(int) $broadcast->id.':'.(int) $recipient->id;

        try {
            if (Cache::has($dedupKey)) {
                return false;
            }

            Cache::put($dedupKey, true, self::DEDUP_TTL_SECONDS);
        } catch (\Throwable) {
            return false;
        }

        $sent = $broadcast->isPoll()
            ? self::deliverPoll($broadcast, $recipient)
            : self::deliverArticle($broadcast, $recipient);

        if ($sent) {
            BotBroadcast::whereKey($broadcast->id)->increment('sent_count');
        } else {
            BotBroadcast::whereKey($broadcast->id)->increment('failed_count');
        }

        return $sent;
    }
    /**
     * Создать статью из черновика.
     *
     * @param array<string, mixed> $draft черновик
     * @param User $admin автор-админ
     * @return BotBroadcast
     * @throws \RuntimeException когда заголовок/текст не годятся
     */
    private static function createArticleFromDraft(array $draft, User $admin): BotBroadcast
    {
        $title = trim(mb_substr((string) ($draft['title'] ?? ''), 0, 200));
        $body = trim(mb_substr((string) ($draft['body'] ?? ''), 0, TelegramPublishPanel::BODY_LIMIT));

        if ($title === '') {
            throw new \RuntimeException('Заголовок пустой — пришлите его заново через /publish.');
        }

        if ($body === '') {
            throw new \RuntimeException('Текст пустой — пришлите его заново через /publish.');
        }

        $photoFileId = trim((string) ($draft['photo_file_id'] ?? ''));

        return BotBroadcast::create([
            'type' => 'article',
            'title' => $title,
            'body' => $body,
            'photo_url' => $photoFileId !== '' ? $photoFileId : null,
            'status' => 'draft',
            'created_by' => (int) $admin->id,
        ]);
    }

    /**
     * Создать опрос из черновика.
     *
     * @param array<string, mixed> $draft черновик
     * @param User $admin автор-админ
     * @return BotBroadcast
     * @throws \RuntimeException когда вопрос/варианты не годятся
     */
    private static function createPollFromDraft(array $draft, User $admin): BotBroadcast
    {
        $question = trim(mb_substr((string) ($draft['question'] ?? ''), 0, 300));
        $rawOptions = $draft['options'] ?? [];
        $options = [];

        if (is_array($rawOptions)) {
            foreach ($rawOptions as $option) {
                $clean = trim(mb_substr((string) $option, 0, 100));

                if ($clean === '') {
                    continue;
                }

                $options[] = $clean;
            }
        }

        $options = array_values($options);

        if ($question === '') {
            throw new \RuntimeException('Вопрос пустой — пришлите его заново через /publish.');
        }

        if (count($options) < 2) {
            throw new \RuntimeException('Нужно минимум 2 варианта — дополните через /publish.');
        }

        if (count($options) > 10) {
            throw new \RuntimeException('Вариантов максимум 10 — уберите лишние через /publish.');
        }

        return BotBroadcast::create([
            'type' => 'poll',
            'title' => $question,
            'poll_question' => $question,
            'poll_options' => $options,
            'poll_multiple' => (bool) ($draft['multiple'] ?? false),
            'status' => 'draft',
            'created_by' => (int) $admin->id,
        ]);
    }

    /**
     * Доставить статью: лонгрид + запись копии.
     *
     * @param BotBroadcast $broadcast рассылка-статья
     * @param User $recipient получатель
     * @return bool true когда первая часть доставлена
     */
    private static function deliverArticle(BotBroadcast $broadcast, User $recipient): bool
    {
        $chatId = (int) ($recipient->telegram_id ?? 0);

        if ($chatId <= 0) {
            return false;
        }

        $sent = TelegramBotApi::sendArticle(
            $chatId,
            (string) $broadcast->title,
            (string) ($broadcast->body ?? ''),
            $broadcast->photo_url
        );

        if (! $sent) {
            return false;
        }

        BotBroadcastMessage::updateOrCreate(
            [
                'broadcast_id' => (int) $broadcast->id,
                'user_id' => (int) $recipient->id,
            ],
            [
                'chat_id' => $chatId,
            ]
        );

        return true;
    }

    /**
     * Доставить опрос нативным sendPoll + запись poll_id копии.
     *
     * poll.id уникален на каждую копию — по нему poll_answer
     * сопоставляется с рассылкой в recordVote.
     *
     * @param BotBroadcast $broadcast рассылка-опрос
     * @param User $recipient получатель
     * @return bool true когда опрос доставлен
     */
    private static function deliverPoll(BotBroadcast $broadcast, User $recipient): bool
    {
        $chatId = (int) ($recipient->telegram_id ?? 0);

        if ($chatId <= 0) {
            return false;
        }

        $result = TelegramBotApi::sendPoll(
            $chatId,
            (string) ($broadcast->poll_question ?? $broadcast->title),
            $broadcast->pollOptions(),
            false,
            (bool) $broadcast->poll_multiple
        );

        if ($result === null) {
            return false;
        }

        $poll = $result['poll'] ?? null;
        $telegramPollId = is_array($poll) ? (string) ($poll['id'] ?? '') : null;

        BotBroadcastMessage::updateOrCreate(
            [
                'broadcast_id' => (int) $broadcast->id,
                'user_id' => (int) $recipient->id,
            ],
            [
                'chat_id' => $chatId,
                'message_id' => (int) ($result['message_id'] ?? 0) ?: null,
                'telegram_poll_id' => $telegramPollId !== '' ? $telegramPollId : null,
            ]
        );

        return true;
    }

    /**
     * Засчитать голос из апдейта poll_answer.
     *
     * В апдейте есть только poll.id без привязки к чату, поэтому
     * получателя находим через bot_broadcast_messages.telegram_poll_id.
     * Переголосование перезаписывает выбор, отмена всех вариантов
     * (пустой option_ids) голос не стирает из счётчика — снимаем
     * только привязку варианта у копии.
     *
     * @param string $telegramPollId poll.id из апдейта
     * @param int $voterTelegramId from.id проголосовавшего
     * @param array<int, int> $optionIds выбранные варианты
     * @return bool true когда голос привязан к рассылке
     */
    public static function recordVote(string $telegramPollId, int $voterTelegramId, array $optionIds): bool
    {
        if ($telegramPollId === '' || $voterTelegramId <= 0) {
            return false;
        }

        $copy = BotBroadcastMessage::where('telegram_poll_id', $telegramPollId)->first();

        if ($copy === null) {
            return false;
        }

        $voter = User::where('telegram_id', $voterTelegramId)->first();

        if ($voter === null || (int) $voter->id !== (int) $copy->user_id) {
            Log::warning('telegram poll vote skipped: voter mismatch', ['poll' => $telegramPollId]);

            return false;
        }

        $cleanIds = [];

        foreach ($optionIds as $optionId) {
            $cleanIds[] = (int) $optionId;
        }

        $cleanIds = array_values($cleanIds);
        $previous = $copy->voted_option_ids;
        $hadVote = is_array($previous) && $previous !== [];

        $copy->forceFill(['voted_option_ids' => $cleanIds])->saveQuietly();

        if ($cleanIds !== [] && ! $hadVote) {
            BotBroadcast::whereKey($copy->broadcast_id)->increment('votes_count');
        }

        return true;
    }
}
