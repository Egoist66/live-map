<?php

namespace App\Http\Controllers;

use App\Models\AppUpdate;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Новости приложения для пользователя (читаются из inbox-таблицы notifications).
 *
 * Контент новостей ведёт админка (app_updates), доставка — строки
 * type=app.published: прочтение и история живут только в inbox.
 */
class AppUpdateController extends Controller
{
    /**
     * @return array{id:int,title:string|null,body:string|null,version:string|null,published_at:string|null,created_at:string|null,is_read:bool}
     */
    private static function mapRow(DatabaseNotification $row): array
    {
        $update = $row->data['update'] ?? [];

        return [
            'id' => (int) ($update['id'] ?? 0),
            'title' => $update['title'] ?? null,
            'body' => $update['body'] ?? null,
            'version' => $update['version'] ?? null,
            'published_at' => $update['published_at'] ?? null,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
            'is_read' => $row->read_at !== null,
        ];
    }

    private function baseQuery(Request $request)
    {
        return DatabaseNotification::where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->where('type', 'app.published');
    }

    public function index(Request $request)
    {
        \App\Services\AppModulesWelcomeNews::ensureDelivered($request->user());

        $rows = $this->baseQuery($request)
            ->latest('updated_at')
            ->limit(20)
            ->get();

        return response()->json($rows->map(fn ($row) => self::mapRow($row))->values());
    }

    public function unread(Request $request)
    {
        \App\Services\AppModulesWelcomeNews::ensureDelivered($request->user());

        $total = (clone $this->baseQuery($request))->whereNull('read_at')->count();
        $rows = $this->baseQuery($request)
            ->whereNull('read_at')
            ->orderBy('updated_at')
            ->limit(5)
            ->get();
        $updates = $rows->map(fn ($row) => self::mapRow($row))->values();

        return response()->json([
            'count' => $total,
            'updates' => $updates,
            'latest' => $updates->last(),
        ]);
    }

    public function markRead(Request $request, AppUpdate $appUpdate)
    {
        abort_unless($appUpdate->is_published, 404);
        $query = $this->baseQuery($request)->whereNull('read_at');
        $updateId = (int) $appUpdate->id;
        $query->where(function ($inner) use ($updateId) {
            $inner->where('data->update_id', $updateId)
                ->orWhere('data->update->id', $updateId);
        })->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request)
    {
        $marked = $this->baseQuery($request)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true, 'count' => $marked]);
    }
}
