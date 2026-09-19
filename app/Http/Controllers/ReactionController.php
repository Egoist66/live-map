<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Models\Reaction;
use App\Services\ActivityRewards;
use App\Services\PinActivityNotifier;
use Illuminate\Http\Request;

class ReactionController extends Controller
{
    /**
     * Кто отреагировал на пин: открытый список для тултипа и модалки.
     *
     * @param Request $request запрос
     * @param Pin $pin пин
     * @return \Illuminate\Http\JsonResponse список реакций и общее число
     */
    public function likers(Request $request, Pin $pin)
    {
        abort_unless($pin->isVisibleForGender($request->user()), 403);

        $reactions = Reaction::where('reactable_type', 'pin')
            ->where('reactable_id', $pin->id)
            ->with('user:id,name,avatar_path')
            ->latest()
            ->limit(50)
            ->get();

        $list = $reactions->map(function ($reaction) {
            $user = $reaction->user;

            return [
                'user_id' => $user?->id ?? $reaction->user_id,
                'name' => $user?->name ?? 'Пользователь',
                'avatar_url' => $user?->avatar_url,
                'type' => $reaction->type,
                'created_at' => $reaction->created_at?->toISOString(),
            ];
        })->values();

        return response()->json([
            'likers' => $list,
            'total' => (int) $pin->reactions_count,
        ]);
    }

    public function toggle(Request $request)
    {
        $data = $request->validate([
            'reactable_type' => 'required|in:pin,comment',
            'reactable_id' => 'required|integer',
            'type' => 'required|in:like,fire,laugh,sad,angry,useful',
        ]);
        $model = $data['reactable_type'] === 'pin' ? Pin::findOrFail($data['reactable_id']) : PinComment::findOrFail($data['reactable_id']);
        if ($data['reactable_type'] === 'pin') {
            abort_unless($model->isVisibleForGender($request->user()), 403, 'Пин доступен только для другого пола');
        } else {
            abort_unless($model->pin->isVisibleForGender($request->user()), 403, 'Пин доступен только для другого пола');
        }
        $existingAny = Reaction::where('user_id', $request->user()->id)->where('reactable_type', $data['reactable_type'])->where('reactable_id', $data['reactable_id'])->first();
        if ($existingAny) {
            if ($existingAny->type === $data['type']) {
                $existingAny->delete();
                if ($data['reactable_type'] === 'pin') {
                    $model->decrement('reactions_count');
                    if ($data['type'] === 'like') $model->decrement('likes_count');
                    $model->refresh();
                    PinActivityNotifier::counters($model);
                    $model->refresh();
                }
                return response()->json(['reacted' => false, 'type' => null, 'reactions_count' => $model->reactions_count ?? 0, 'likes_count' => $model->likes_count ?? 0]);
            }
            $prev = $existingAny->type;
            $existingAny->update(['type' => $data['type']]);
            if ($data['reactable_type'] === 'pin') {
                if ($prev === 'like' && $data['type'] !== 'like') $model->decrement('likes_count');
                if ($prev !== 'like' && $data['type'] === 'like') $model->increment('likes_count');
                $model->refresh();
                PinActivityNotifier::reaction($model, $request->user(), $data['type']);
                $model->refresh();
            }
            return response()->json(['reacted' => true, 'type' => $data['type'], 'switched' => true, 'reactions_count' => $model->reactions_count ?? 0, 'likes_count' => $model->likes_count ?? 0]);
        }
        Reaction::create(['user_id' => $request->user()->id, 'reactable_type' => $data['reactable_type'], 'reactable_id' => $data['reactable_id'], 'type' => $data['type']]);
        if ($data['reactable_type'] === 'pin') {
            $model->increment('reactions_count');
            if ($data['type'] === 'like') $model->increment('likes_count');
            $model->refresh();
            if ($model->reactions_count % 5 === 0 && $model->expires_at && $model->expires_at->diffInHours(now()) < 23) {
                $model->update(['expires_at' => $model->expires_at->addHour()]);
            }
            PinActivityNotifier::reaction($model, $request->user(), $data['type']);
            $model->refresh();
        }
        $response = ['reacted' => true, 'type' => $data['type'], 'reactions_count' => $model->reactions_count ?? 0, 'likes_count' => $model->likes_count ?? 0];
        $ownerId = (int) ($model->user_id ?? 0);

        if ($ownerId !== (int) $request->user()->id) {
            $reward = ActivityRewards::award($request->user(), 'pin_reaction', $data['reactable_type'], (int) $data['reactable_id']);

            if ($reward !== null) {
                $response['reward'] = $reward;
            }
        }

        return response()->json($response);
    }
}
