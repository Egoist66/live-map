<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinComment;
use App\Models\Reaction;
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
        $existing = Reaction::where('user_id', $request->user()->id)->where('reactable_type', $data['reactable_type'])->where('reactable_id', $data['reactable_id'])->where('type', $data['type'])->first();
        if ($existing) {
            $existing->delete();
            if ($data['reactable_type'] === 'pin') $model->decrement('reactions_count');
            return response()->json(['reacted' => false]);
        }
        Reaction::create(['user_id' => $request->user()->id, 'reactable_type' => $data['reactable_type'], 'reactable_id' => $data['reactable_id'], 'type' => $data['type']]);
        if ($data['reactable_type'] === 'pin') {
            $model->increment('reactions_count');
            $model->increment('likes_count');
            if ($model->reactions_count % 5 === 0 && $model->expires_at->diffInHours(now()) < 23) {
                $model->update(['expires_at' => $model->expires_at->addHour()]);
            }
        }
        return response()->json(['reacted' => true]);
    }
}
