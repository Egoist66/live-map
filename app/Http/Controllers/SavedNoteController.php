<?php

namespace App\Http\Controllers;

use App\Events\SavedNotesChanged;
use App\Models\SavedNote;
use App\Services\SavedNotesService;
use Illuminate\Http\Request;

/**
 * «Избранное» — личные заметки, чат только для себя.
 *
 * Тела хранятся в БД сжатыми (gzip) и зашифрованными (AES-256-GCM),
 * чужое недоступно: каждая строка проверяется по user_id. После каждой
 * мутации шлём SavedNotesChanged в приват user.{id}, чтобы второе
 * устройство подтянуло список через сокет (realtime) без перезагрузки.
 */
class SavedNoteController extends Controller
{
    /**
     * Список заметок с поиском.
     *
     * @param Request $request q, kind=all|text|link, page, per_page
     * @param SavedNotesService $notes сервис
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request, SavedNotesService $notes)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:200',
            'kind' => 'nullable|in:all,text,link',
            'page' => 'nullable|integer|min:1|max:1000',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        $kind = (string) ($data['kind'] ?? 'all');
        $page = (int) ($data['page'] ?? 1);
        $perPage = (int) ($data['per_page'] ?? SavedNotesService::PER_PAGE);

        $paginator = $notes->list($request->user(), $data['q'] ?? null, $kind, $page, $perPage);

        return response()->json([
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'has_more' => $paginator->hasMorePages(),
        ]);
    }

    /**
     * Создать заметку.
     *
     * @param Request $request body (до 10000 символов)
     * @param SavedNotesService $notes сервис
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request, SavedNotesService $notes)
    {
        $data = $request->validate([
            'body' => 'required|string|min:1|max:10000',
        ]);

        $body = trim($data['body']);
        abort_if($body === '', 422, 'Пустую заметку сохранять нечего');

        $note = $notes->create($request->user(), $body);
        $this->notifyChanged((int) $request->user()->id, 'created');

        return response()->json($note->toPayload(), 201);
    }

    /**
     * Обновить заметку владельца.
     *
     * @param Request $request body
     * @param SavedNote $savedNote заметка (route-model binding)
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, SavedNote $savedNote)
    {
        abort_unless((int) $savedNote->user_id === (int) $request->user()->id, 403);

        $data = $request->validate([
            'body' => 'required|string|min:1|max:10000',
        ]);

        $body = trim($data['body']);
        abort_if($body === '', 422, 'Пустую заметку сохранять нечего');

        $savedNote->setPlainBody($body);
        $savedNote->save();
        $this->notifyChanged((int) $request->user()->id, 'updated');

        return response()->json($savedNote->refresh()->toPayload());
    }

    /**
     * Удалить заметку владельца.
     *
     * @param Request $request запрос
     * @param SavedNote $savedNote заметка
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, SavedNote $savedNote)
    {
        abort_unless((int) $savedNote->user_id === (int) $request->user()->id, 403);

        $savedNote->delete();
        $this->notifyChanged((int) $request->user()->id, 'deleted');

        return response()->json(['ok' => true]);
    }

    /**
     * Удалить все заметки владельца.
     *
     * @param Request $request запрос
     * @return \Illuminate\Http\JsonResponse
     */
    public function clear(Request $request)
    {
        $deleted = SavedNote::where('user_id', $request->user()->id)->delete();
        $this->notifyChanged((int) $request->user()->id, 'cleared');

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }

    /**
     * Режим хранения: server (синхронизация) или local (только устройство).
     *
     * @param Request $request запрос
     * @param SavedNotesService $notes сервис
     * @return \Illuminate\Http\JsonResponse
     */
    public function settings(Request $request, SavedNotesService $notes)
    {
        return response()->json(['storage' => $notes->storageMode($request->user())]);
    }

    /**
     * Переключить режим хранения.
     *
     * @param Request $request storage=server|local
     * @param SavedNotesService $notes сервис
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateSettings(Request $request, SavedNotesService $notes)
    {
        $data = $request->validate([
            'storage' => 'required|in:server,local',
        ]);

        $mode = $notes->setStorageMode($request->user(), $data['storage']);

        return response()->json(['storage' => $mode]);
    }

    /**
     * Оповестить другие устройства владельца через realtime.
     *
     * Ошибки broadcast глушим: заметка уже сохранена, сокет — best-effort.
     *
     * @param int $userId владелец
     * @param string $action created|updated|deleted|cleared
     * @return void
     */
    private function notifyChanged(int $userId, string $action): void
    {
        try {
            broadcast(new SavedNotesChanged($userId, $action))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
        }
    }
}
