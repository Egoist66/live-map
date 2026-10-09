<?php

namespace App\Http\Controllers;

use App\Models\UserDatabaseNotification;
use App\Services\AppModulesWelcomeNews;
use App\Services\NotificationModuleGate;
use App\Services\UserNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Единый inbox уведомлений (таблица notifications).
 *
 * Таб «Пины» — category=pin, таб «События» — category=event.
 * Новости приложения (app.published) здесь не отдаются и не считаются:
 * у них свой источник — /api/updates (колокольчик показывает их
 * табом «Новости»). Без этого одна новость давала бы сразу «2»
 * в бейдже и дублировалась в двух секциях модалки.
 * Строки выключенных разделов скрыты гейтом модулей: лента
 * и счётчики показывают только текущий набор пользователя.
 * Прочтение и удаление — только свои строки.
 */
class NotificationController extends Controller
{
    /**
     * Лента уведомлений (новые сверху).
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'category' => ['sometimes', 'in:pin,event'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);
        $query = UserDatabaseNotification::where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->where('type', '!=', 'app.published')
            ->latest('updated_at');
        $query = NotificationModuleGate::applyAllowedScope($query, $request->user());
        if (! empty($data['category'])) {
            $query->where('category', $data['category']);
        }
        $page = $query->paginate((int) ($data['per_page'] ?? 15));
        $page->getCollection()->transform(fn ($row) => UserNotifier::serialize($row));

        return $page;
    }

    /**
     * Счётчики непрочитанных: всего и по табам.
     */
    public function unreadCount(Request $request)
    {
        $base = UserDatabaseNotification::where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->where('type', '!=', 'app.published')
            ->whereNull('read_at');
        $base = NotificationModuleGate::applyAllowedScope($base, $request->user());
        $pins = (clone $base)->where('category', 'pin')->count();
        $events = (clone $base)->where('category', 'event')->count();

        return response()->json([
            'count' => $pins + $events,
            'pins' => $pins,
            'events' => $events,
        ]);
    }

    /**
     * Пометить прочитанными (по id строк или всё).
     */
    public function read(Request $request)
    {
        $data = $request->validate([
            'all' => ['sometimes', 'boolean'],
            'category' => ['sometimes', 'in:pin,event'],
            'ids' => ['sometimes', 'array'],
            'ids.*' => ['string'],
        ]);
        $query = UserDatabaseNotification::where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id)
            ->whereNull('read_at');
        if (! ($data['all'] ?? false)) {
            if (! empty($data['category'])) {
                $query->where('category', $data['category']);
            }
            if (empty($data['ids']) && empty($data['category'])) {
                return response()->json(['ok' => true, 'marked' => 0]);
            }
            if (! empty($data['ids'])) {
                $query->whereIn('id', $data['ids']);
            }
        }
        $marked = $query->update(['read_at' => now()]);

        Cache::forget("realtime:badges:{$request->user()->id}");

        if ($data['all'] ?? false) {
            AppModulesWelcomeNews::dismissFor($request->user());
        } elseif (! empty($data['ids'])) {
            AppModulesWelcomeNews::dismissIfGuideRead($request->user(), $data['ids']);
        }

        return response()->json(['ok' => true, 'marked' => $marked]);
    }

    /**
     * Удалить ленту навсегда (всю или по табу).
     */
    public function clear(Request $request)
    {
        $data = $request->validate([
            'category' => ['sometimes', 'in:pin,event'],
        ]);
        $query = UserDatabaseNotification::where('notifiable_type', $request->user()->getMorphClass())
            ->where('notifiable_id', $request->user()->id);
        if (! empty($data['category'])) {
            $query->where('category', $data['category']);
        }
        $hadGuide = ($data['category'] ?? null) !== 'pin'
            && AppModulesWelcomeNews::hasGuideRow($request->user());
        $deleted = $query->delete();

        Cache::forget("realtime:badges:{$request->user()->id}");

        if ($hadGuide) {
            AppModulesWelcomeNews::dismissFor($request->user());
        }

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }
}
