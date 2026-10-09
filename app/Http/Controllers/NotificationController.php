<?php

namespace App\Http\Controllers;

use App\Models\UserDatabaseNotification;
use App\Services\NotificationModuleGate;
use App\Services\UserNotifier;
use Illuminate\Http\Request;

/**
 * Единый inbox уведомлений (таблица notifications).
 *
 * Таб «Пины» — category=pin, таб «События» — category=event.
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
        $deleted = $query->delete();

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }
}
