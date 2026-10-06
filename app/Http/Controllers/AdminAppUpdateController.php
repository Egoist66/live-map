<?php

namespace App\Http\Controllers;

use App\Jobs\BroadcastAppUpdateTelegram;
use App\Models\AppUpdate;
use Illuminate\Http\Request;

/**
 * CRUD новостей приложения для админки.
 *
 * Публикация (создание с is_published или переход черновик → опубликовано)
 * делает два веера: inbox всем пользователям (колокольчик + realtime + push
 * через UserNotifier) и — если send_telegram не выключен — рассылку в лички
 * Telegram-бота @U1ove_bot всем привязанным (даже онлайн: новость важно
 * увидеть, приложение могут не открыть). Рассылка в бота идёт фоновой
 * задачей BroadcastAppUpdateTelegram, ответ админке не висит.
 */
class AdminAppUpdateController extends Controller
{
    public function index()
    {
        $updates = AppUpdate::with('author:id,name')->latest()->paginate(20);
        $updates->getCollection()->transform(fn ($u) => array_merge($u->toArray(), [
            'reads_count' => $u->readsCount(),
        ]));
        return response()->json($updates);
    }

    /**
     * Создать новость (черновик или сразу публикация с веером).
     *
     * @param Request $request title, body, version?, is_published?, send_telegram?
     * @return \Illuminate\Http\JsonResponse созданная новость + флаг telegram_queued
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'body' => 'required|string|max:10000',
            'version' => 'nullable|string|max:50',
            'is_published' => 'nullable|boolean',
            'send_telegram' => 'nullable|boolean',
        ]);
        $published = (bool) ($data['is_published'] ?? false);
        $update = AppUpdate::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'version' => $data['version'] ?? null,
            'is_published' => $published,
            'published_at' => $published ? now() : null,
            'created_by' => $request->user()->id,
        ]);
        $telegramQueued = false;
        if ($published) {
            self::fanOut($update);
            $telegramQueued = self::fanOutTelegram($update, $request);
        }
        return response()->json(array_merge($update->toArray(), [
            'telegram_queued' => $telegramQueued,
        ]), 201);
    }

    /**
     * Обновить новость; переход в опубликованные запускает оба веера.
     *
     * @param Request $request частичные поля + send_telegram?
     * @param AppUpdate $appUpdate новость
     * @return \Illuminate\Http\JsonResponse обновлённая новость + флаг telegram_queued
     */
    public function update(Request $request, AppUpdate $appUpdate)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:200',
            'body' => 'sometimes|string|max:10000',
            'version' => 'nullable|string|max:50',
            'is_published' => 'sometimes|boolean',
            'send_telegram' => 'nullable|boolean',
        ]);
        $wasPublished = (bool) $appUpdate->is_published;
        if (array_key_exists('is_published', $data)) {
            $data['published_at'] = $data['is_published'] && ! $appUpdate->published_at ? now() : $appUpdate->published_at;
        }
        unset($data['send_telegram']);
        $appUpdate->update($data);
        $appUpdate = $appUpdate->fresh();
        $telegramQueued = false;
        if ($appUpdate && (bool) $appUpdate->is_published && ! $wasPublished) {
            self::fanOut($appUpdate);
            $telegramQueued = self::fanOutTelegram($appUpdate, $request);
        }
        return response()->json(array_merge($appUpdate->toArray(), [
            'telegram_queued' => $telegramQueued,
        ]));
    }

    public function destroy(AppUpdate $appUpdate)
    {
        $appUpdate->delete();
        return response()->json(['ok' => true]);
    }

    /**
     * Разослать новость в inbox всех пользователей (кроме админов).
     */
    private static function fanOut(AppUpdate $update): void
    {
        try {
            \App\Models\User::where('is_admin', false)
                ->where(function ($query) {
                    $query->whereNull('role')->orWhere('role', '!=', 'admin');
                })
                ->orderBy('id')
                ->chunk(500, function ($users) use ($update) {
                    foreach ($users as $user) {
                        \App\Services\UserNotifier::send($user, new \App\Notifications\AppPublishedNotification($update));
                    }
                });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('app update fanout failed', ['id' => $update->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Поставить рассылку новости в Telegram-бота (фон, всем привязанным).
     *
     * Чекбокс админки send_telegram=false рассылку пропускает (по умолчанию
     * true: toggle публикации без флага тоже шлёт в бота). Черновики не шлём.
     *
     * @param AppUpdate $update новость
     * @param Request $request запрос с флагом send_telegram
     * @return bool true когда задача поставлена в очередь
     */
    private static function fanOutTelegram(AppUpdate $update, Request $request): bool
    {
        try {
            $sendTelegram = $request->has('send_telegram')
                ? (bool) $request->boolean('send_telegram')
                : true;

            if (! $sendTelegram) {
                return false;
            }

            BroadcastAppUpdateTelegram::dispatch((int) $update->id)->afterCommit();

            \Illuminate\Support\Facades\Log::info('app update telegram queued', [
                'id' => $update->id,
                'queue' => (string) config('queue.default', 'database'),
            ]);

            return true;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('app update telegram fanout failed', [
                'id' => $update->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
