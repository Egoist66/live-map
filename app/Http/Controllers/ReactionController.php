<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Models\Reaction;
use App\Services\PinActivityNotifier;
use Illuminate\Http\Request;

class ReactionController extends Controller
{
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
        return response()->json(['reacted' => true, 'type' => $data['type'], 'reactions_count' => $model->reactions_count ?? 0, 'likes_count' => $model->likes_count ?? 0]);
    }
}
