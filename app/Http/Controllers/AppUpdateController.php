<?php

namespace App\Http\Controllers;

use App\Events\NotificationInboxChanged;
use App\Models\AppUpdate;
use App\Services\AppModulesWelcomeNews;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

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
        AppModulesWelcomeNews::ensureDelivered($request->user());

        $rows = $this->baseQuery($request)
            ->latest('updated_at')
            ->limit(20)
            ->get();

        return response()->json($rows->map(fn ($row) => self::mapRow($row))->values());
    }

    public function unread(Request $request)
    {
        AppModulesWelcomeNews::ensureDelivered($request->user());

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

    /**
     * Пометить новость прочитанной.
     *
     * Идемпотентно и всегда успешно: inbox-строка может пережить саму новость
     * (снята с публикации, удалена из админки — как старый гид modules-guide-v1
     * после бампа версии на v2). Раньше такой вызов падал с 404, фронт глотал
     * ошибку, локально выкидывал новость, а следующий unread() возвращал её же —
     * модалка «Что нового» закрывалась и тут же открывалась бесконечно.
     *
     * @param  Request  $request  запрос с авторизованным пользователем
     * @param  string|int  $appUpdate  id новости из inbox-пейлоада (без implicit binding: записи может уже не быть)
     * @return JsonResponse всегда ok:true — строка погашена либо её уже нет
     */
    public function markRead(Request $request, $appUpdate)
    {
        $updateId = (int) $appUpdate;

        $rows = $this->baseQuery($request)
            ->whereNull('read_at')
            ->where(function ($inner) use ($updateId) {
                $inner->where('data->update_id', $updateId);
                $inner->orWhere('data->update->id', $updateId);
            })
            ->get();

        $guideVersion = $this->resolveGuideVersion($updateId, $rows);

        $rowIds = $rows->pluck('id')->all();

        $marked = 0;

        if ($rowIds !== []) {
            $marked = $this->baseQuery($request)
                ->whereNull('read_at')
                ->whereIn('id', $rowIds)
                ->update(['read_at' => now()]);
        }

        Cache::forget("realtime:badges:{$request->user()->id}");

        if ($marked > 0) {
            NotificationInboxChanged::dispatchFor((int) $request->user()->id, false);
        }

        if ($guideVersion !== null) {
            AppModulesWelcomeNews::dismissVersionFor($request->user(), $guideVersion);
        }

        return response()->json(['ok' => true, 'marked' => $marked]);
    }

    /**
     * Версия гида по разделам среди затронутых inbox-строк.
     *
     * Смотрим сначала пейлоады строк (переживают удаление записи),
     * затем саму запись (переживает ручную чистку ленты). Любая
     * версия с префиксом modules-guide-* считается гидом: старую
     * версию тоже надо гасить навсегда, а не только текущую.
     *
     * @param  int  $updateId  id новости из запроса
     * @param  Collection  $rows  затронутые inbox-строки
     * @return string|null версия гида либо null для обычных новостей
     */
    private function resolveGuideVersion(int $updateId, $rows): ?string
    {
        foreach ($rows as $row) {
            $data = $row->data;

            if (is_string($data)) {
                $decoded = json_decode($data, true);
                $data = is_array($decoded) ? $decoded : [];
            }

            $version = is_array($data) ? ($data['update']['version'] ?? null) : null;

            if (is_string($version) && str_starts_with($version, 'modules-guide')) {
                return $version;
            }
        }

        $update = AppUpdate::query()->find($updateId);

        if ($update === null) {
            return null;
        }

        $storedVersion = $update->version;

        if (is_string($storedVersion) && str_starts_with($storedVersion, 'modules-guide')) {
            return $storedVersion;
        }

        return null;
    }

    public function markAllRead(Request $request)
    {
        $marked = $this->baseQuery($request)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        Cache::forget("realtime:badges:{$request->user()->id}");
        AppModulesWelcomeNews::dismissFor($request->user());

        if ($marked > 0) {
            NotificationInboxChanged::dispatchFor((int) $request->user()->id, true);
        }

        return response()->json(['ok' => true, 'count' => $marked]);
    }
}
