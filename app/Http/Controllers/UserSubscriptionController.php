<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserSubscription;
use Illuminate\Http\Request;

/**
 * Подписки на обновления пользователей (пины / фото / репутация и уровень).
 */
class UserSubscriptionController extends Controller
{
    /**
     * Список моих подписок.
     */
    public function index(Request $request)
    {
        $subs = UserSubscription::where('subscriber_id', $request->user()->id)
            ->with('target:id,name,avatar_path,level,reputation_score')
            ->latest()
            ->get();

        return response()->json($subs->map(fn ($s) => [
            'id' => $s->id,
            'target_id' => $s->target_id,
            'notify_pin' => (bool) $s->notify_pin,
            'notify_photo' => (bool) $s->notify_photo,
            'notify_level' => (bool) $s->notify_level,
            'target' => $s->target ? array_merge(
                $s->target->only(['id', 'name', 'level', 'reputation_score']),
                ['avatar_url' => $s->target->avatar_url]
            ) : null,
            'created_at' => $s->created_at?->toISOString(),
        ])->values());
    }

    /**
     * Статус подписки на пользователя.
     */
    public function status(Request $request, User $user)
    {
        $meId = (int) $request->user()->id;
        $isFriend = Friendship::areFriends($meId, (int) $user->id);
        $sub = UserSubscription::where('subscriber_id', $meId)
            ->where('target_id', $user->id)
            ->first();

        return response()->json([
            'subscribed' => $isFriend && (bool) $sub,
            'notify_pin' => (bool) ($sub->notify_pin ?? true),
            'notify_photo' => (bool) ($sub->notify_photo ?? true),
            'notify_level' => (bool) ($sub->notify_level ?? true),
            'is_friend' => $isFriend,
            'can_subscribe' => $isFriend,
        ]);
    }

    /**
     * Подписаться / обновить флаги.
     */
    public function store(Request $request, User $user)
    {
        $me = $request->user();
        abort_if($me->id === $user->id, 422, 'Нельзя подписаться на себя');

        $blocked = UserBlock::where(function ($q) use ($me, $user) {
            $q->where(fn ($x) => $x->where('blocker_id', $me->id)->where('blocked_id', $user->id))
                ->orWhere(fn ($x) => $x->where('blocker_id', $user->id)->where('blocked_id', $me->id));
        })->exists();
        abort_if($blocked, 403, 'Недоступно');
        abort_unless(Friendship::areFriends((int) $me->id, (int) $user->id), 403, 'Подписка на обновления доступна только для друзей');

        $data = $request->validate([
            'notify_pin' => 'sometimes|boolean',
            'notify_photo' => 'sometimes|boolean',
            'notify_level' => 'sometimes|boolean',
        ]);

        $sub = UserSubscription::updateOrCreate(
            ['subscriber_id' => $me->id, 'target_id' => $user->id],
            [
                'notify_pin' => array_key_exists('notify_pin', $data) ? (bool) $data['notify_pin'] : true,
                'notify_photo' => array_key_exists('notify_photo', $data) ? (bool) $data['notify_photo'] : true,
                'notify_level' => array_key_exists('notify_level', $data) ? (bool) $data['notify_level'] : true,
            ]
        );

        return response()->json([
            'subscribed' => true,
            'notify_pin' => (bool) $sub->notify_pin,
            'notify_photo' => (bool) $sub->notify_photo,
            'notify_level' => (bool) $sub->notify_level,
        ], 201);
    }

    /**
     * Отписаться.
     */
    public function destroy(Request $request, User $user)
    {
        UserSubscription::where('subscriber_id', $request->user()->id)
            ->where('target_id', $user->id)
            ->delete();

        return response()->json(['subscribed' => false]);
    }
}
