<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\MonitoringService;
use Illuminate\Http\Request;

/**
 * Виджет «Пользователи из Telegram» для панели модерации.
 *
 * Все, кто пришёл из Telegram (telegram_id привязан): никнеймы,
 * TG-id, онлайн-статус. Только чтение — действий над строкой нет.
 */
class AdminTelegramUserController extends Controller
{
    /**
     * Пагинированный список TG-пользователей, свежие сверху.
     *
     * @param Request $request запрос с q/per_page
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);

        $q = trim($data['q'] ?? '');

        $query = User::query()
            ->whereNotNull('telegram_id')
            ->orderByDesc('last_seen_at');

        if (strlen($q) >= 1) {
            $query->where(fn ($w) => $w
                ->where('name', 'like', "%$q%")
                ->orWhere('email', 'like', "%$q%")
                ->orWhere('telegram_username', 'like', "%$q%")
                ->orWhere('telegram_id', 'like', "%$q%"));
        }

        $threshold = now()->subMinutes(MonitoringService::ONLINE_MINUTES);

        $users = $query->select(
            'id',
            'name',
            'email',
            'avatar_path',
            'telegram_id',
            'telegram_username',
            'telegram_photo_url',
            'telegram_linked_at',
            'last_seen_at',
            'created_at'
        )->paginate((int) ($data['per_page'] ?? 20));

        $total = User::whereNotNull('telegram_id')->count();

        $users->getCollection()->transform(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'avatar_path' => $u->avatar_path,
            'avatar_url' => $u->avatar_url,
            'telegram_id' => $u->telegram_id !== null ? (string) $u->telegram_id : null,
            'telegram_username' => $u->telegram_username,
            'telegram_photo_url' => $u->telegram_photo_url,
            'telegram_linked_at' => $u->telegram_linked_at?->toISOString(),
            'is_online' => $u->last_seen_at && $u->last_seen_at->gte($threshold),
            'last_seen_at' => $u->last_seen_at?->toISOString(),
            'created_at' => $u->created_at?->toISOString(),
        ]);

        return response()->json(array_merge($users->toArray(), ['stats' => [
            'total' => $total,
        ]]));
    }
}
