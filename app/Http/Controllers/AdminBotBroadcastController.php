<?php

namespace App\Http\Controllers;

use App\Models\BotBroadcast;
use App\Models\BotBroadcastMessage;

/**
 * Статистика рассылок админа в Telegram-боте для админки.
 *
 * Публикации создаются мастером /publish прямо в боте, здесь —
 * только чтение итогов (доставка, голоса по вариантам) и удаление
 * истории. Живые обновления летят событием bot-broadcast.finished
 * в личку автора, фронт подхватывает с шины без рефреша.
 */
class AdminBotBroadcastController extends Controller
{
    /**
     * Список рассылок (сначала свежие) с итогами.
     *
     * @return \Illuminate\Http\JsonResponse пагинация + serialize() строки
     */
    public function index()
    {
        $broadcasts = BotBroadcast::with('author:id,name')->latest()->paginate(15);

        $broadcasts->getCollection()->transform(fn ($b) => self::serialize($b));

        return response()->json($broadcasts);
    }

    /**
     * Одна рассылка с разбивкой голосов по вариантам (опросы).
     *
     * @param BotBroadcast $botBroadcast рассылка
     * @return \Illuminate\Http\JsonResponse строка + breakdown
     */
    public function show(BotBroadcast $botBroadcast)
    {
        $botBroadcast->load('author:id,name');

        $data = self::serialize($botBroadcast);
        $data['breakdown'] = self::breakdown($botBroadcast);
        $data['recipients'] = self::recipients($botBroadcast);
        $data['recipients_total'] = BotBroadcastMessage::where('broadcast_id', $botBroadcast->id)->count();

        return response()->json($data);
    }

    /**
     * Удалить рассылку из истории (копии у пользователей не трогаем).
     *
     * Активную рассылку (sending) удалять нельзя — дождитесь финиша.
     *
     * @param BotBroadcast $botBroadcast рассылка
     * @return \Illuminate\Http\JsonResponse ok:true
     */
    public function destroy(BotBroadcast $botBroadcast)
    {
        abort_if($botBroadcast->status === 'sending', 422, 'Рассылка ещё идёт — удалите после финиша.');

        $botBroadcast->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Короткая строка рассылки для списка.
     *
     * @param BotBroadcast $broadcast рассылка
     * @return array<string, mixed>
     */
    private static function serialize(BotBroadcast $broadcast): array
    {
        $photoUrl = (string) ($broadcast->photo_url ?? '');

        return [
            'id' => (int) $broadcast->id,
            'type' => (string) $broadcast->type,
            'title' => (string) $broadcast->title,
            'body' => (string) ($broadcast->body ?? ''),
            'has_photo' => $photoUrl !== '',
            'poll_question' => (string) ($broadcast->poll_question ?? $broadcast->title),
            'poll_options' => $broadcast->pollOptions(),
            'poll_multiple' => (bool) $broadcast->poll_multiple,
            'status' => (string) $broadcast->status,
            'sent_count' => (int) $broadcast->sent_count,
            'failed_count' => (int) $broadcast->failed_count,
            'votes_count' => (int) $broadcast->votes_count,
            'options_count' => count($broadcast->pollOptions()),
            'author_name' => (string) ($broadcast->author->name ?? ''),
            'published_at' => $broadcast->published_at?->toISOString(),
            'created_at' => $broadcast->created_at?->toISOString(),
        ];
    }

    /**
     * Последние получатели: кому дошло + кто проголосовал.
     *
     * @param BotBroadcast $broadcast рассылка
     * @return array<int, array{name:string, voted:bool}>
     */
    private static function recipients(BotBroadcast $broadcast): array
    {
        $copies = BotBroadcastMessage::where('broadcast_id', $broadcast->id)
            ->with('user:id,name')
            ->latest()
            ->limit(20)
            ->get();

        $rows = [];

        foreach ($copies as $copy) {
            $voted = $copy->voted_option_ids;

            $rows[] = [
                'name' => (string) ($copy->user->name ?? '—'),
                'voted' => is_array($voted) && $voted !== [],
            ];
        }

        return $rows;
    }

    /**
     * Голоса по вариантам опроса.
     *
     * Для статей — пустой список. При множественном выборе один
     * человек засчитывается в каждый выбранный вариант.
     *
     * @param BotBroadcast $broadcast опрос
     * @return array<int, array{option:string, votes:int}>
     */
    private static function breakdown(BotBroadcast $broadcast): array
    {
        $options = $broadcast->pollOptions();
        $rows = [];

        foreach ($options as $option) {
            $rows[] = ['option' => $option, 'votes' => 0];
        }

        if ($rows === []) {
            return [];
        }

        $ballots = BotBroadcastMessage::where('broadcast_id', $broadcast->id)
            ->whereNotNull('voted_option_ids')
            ->pluck('voted_option_ids');

        foreach ($ballots as $ballot) {
            if (! is_array($ballot)) {
                continue;
            }

            foreach ($ballot as $optionId) {
                $index = (int) $optionId;

                if (isset($rows[$index])) {
                    $rows[$index]['votes']++;
                }
            }
        }

        return $rows;
    }
}
