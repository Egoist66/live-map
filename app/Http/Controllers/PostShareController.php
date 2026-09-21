<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Пересылка постов (UFlow / UDistrict) в личку как в соцсетях.
 *
 * Модалка «Отправить» выбирает одного или нескольких получателей,
 * каждому создаётся (или находится) direct-диалог и падает сообщение
 * типа post с живым превью. По клику получатель проваливается в пост.
 */
class PostShareController extends Controller
{
    /**
     * Поделиться постом с одним или несколькими пользователями.
     *
     * @param Request $request user_ids[], post_type flow|district, post_id, comment?
     * @return \Illuminate\Http\JsonResponse созданные сообщения и диалоги
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'user_ids' => 'required|array|min:1|max:10',
            'user_ids.*' => 'integer|exists:users,id',
            'post_type' => 'required|in:flow,district',
            'post_id' => 'required|integer|min:1',
            'comment' => 'nullable|string|max:500',
        ]);

        $me = $request->user();
        $comment = trim((string) ($data['comment'] ?? ''));

        try {
            \App\Services\ContentModeration::assertClean($comment !== '' ? $comment : null);
        } catch (\Throwable $e) {
            abort(422, $e->getMessage());
        }

        $messageController = app(MessageController::class);
        $shared = $messageController->resolveSharedPost($me, $data['post_type'], (int) $data['post_id']);

        $userIds = collect($data['user_ids'])
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn ($id) => $id === (int) $me->id)
            ->values();

        abort_if($userIds->isEmpty(), 422, 'Выберите получателя');

        $sent = [];
        $skipped = [];

        foreach ($userIds as $userId) {
            $other = User::find($userId);

            if (! $other) {
                $skipped[] = ['user_id' => $userId, 'reason' => 'Пользователь не найден'];

                continue;
            }

            if (! $other->isDiscoverableBy($me)) {
                $skipped[] = ['user_id' => $userId, 'reason' => 'Пользователь недоступен'];

                continue;
            }

            if ($reason = $me->messageBlockReason($other)) {
                $skipped[] = ['user_id' => $userId, 'reason' => $reason];

                continue;
            }

            if (! $me->canMessageUser($other)) {
                $skipped[] = ['user_id' => $userId, 'reason' => 'Нельзя написать этому пользователю. Проверьте настройки приватности или дружбу.'];

                continue;
            }

            $conversation = $this->findOrCreateDirect($me, $other);

            $payload = DB::transaction(function () use ($request, $messageController, $conversation, $me, $comment, $shared) {
                $response = $messageController->storeInline($request, $conversation, $me, $comment, null, null, null, $shared);
                $messagePayload = $response->getData(true);
                $conversation->refresh();

                return [
                    'conversation_id' => (int) $conversation->id,
                    'message' => $messagePayload,
                ];
            });

            $sent[] = $payload;
        }

        abort_if(empty($sent), 403, 'Не вышло отправить ни одному получателю');

        return response()->json([
            'sent' => $sent,
            'skipped' => $skipped,
        ], 201);
    }

    /**
     * Найти direct-диалог пары или создать новый.
     *
     * @param User $me отправитель
     * @param User $other получатель
     * @return Conversation
     */
    private function findOrCreateDirect(User $me, User $other): Conversation
    {
        $existing = Conversation::findDirect($me->id, $other->id);

        if ($existing) {
            $existing->participantRows()->where('user_id', $me->id)->update(['hidden_at' => null]);

            return $existing->refresh();
        }

        $hiddenExisting = Conversation::where('type', 'direct')
            ->whereHas('participantRows', fn ($q) => $q->where('user_id', $other->id))
            ->whereHas('participantRows', fn ($q) => $q->where('user_id', $me->id)->whereNotNull('hidden_at'), '=', 1)
            ->first();

        if ($hiddenExisting) {
            $hiddenExisting->participantRows()->where('user_id', $me->id)->update(['hidden_at' => null]);
            $hiddenExisting->update(['last_message_at' => now()]);

            return $hiddenExisting->refresh();
        }

        return DB::transaction(function () use ($me, $other) {
            app(\App\Services\DatingService::class)->tryConsumeRandomQuota($me->refresh(), $other);

            $conversation = Conversation::create([
                'type' => 'direct',
                'created_by' => $me->id,
                'last_message_at' => now(),
            ]);

            $conversation->participantRows()->createMany([
                ['user_id' => $me->id, 'joined_at' => now()],
                ['user_id' => $other->id, 'joined_at' => now()],
            ]);

            return $conversation->refresh();
        });
    }
}
