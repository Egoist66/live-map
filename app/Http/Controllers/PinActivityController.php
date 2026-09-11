<?php

namespace App\Http\Controllers;

use App\Models\PinActivity;
use Illuminate\Http\Request;

class PinActivityController extends Controller
{
    public function index(Request $request)
    {
        return PinActivity::where('owner_id', $request->user()->id)
            ->with(['actor:id,name,avatar_path', 'pin:id,title,category', 'photo:id,user_id,caption', 'relatedUser:id,name,avatar_path', 'flowPost:id,user_id,body'])
            ->latest()
            ->paginate(15);
    }

    public function unreadCount(Request $request)
    {
        return response()->json([
            'count' => PinActivity::where('owner_id', $request->user()->id)->whereNull('read_at')->count(),
        ]);
    }

    public function read(Request $request)
    {
        $data = $request->validate([
            'all' => ['sometimes', 'boolean'],
            'ids' => ['sometimes', 'array'],
            'ids.*' => ['integer', 'exists:pin_activities,id'],
        ]);
        $q = PinActivity::where('owner_id', $request->user()->id)->whereNull('read_at');
        if (! ($data['all'] ?? false)) {
            if (empty($data['ids'])) {
                return response()->json(['ok' => true, 'marked' => 0]);
            }
            $q->whereIn('id', $data['ids']);
        }
        $marked = $q->update(['read_at' => now()]);
        return response()->json(['ok' => true, 'marked' => $marked]);
    }
}
