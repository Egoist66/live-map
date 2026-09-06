<?php

namespace App\Http\Controllers;

use App\Models\AppUpdate;
use App\Models\AppUpdateRead;
use Illuminate\Http\Request;

class AppUpdateController extends Controller
{
    public function index(Request $request)
    {
        $updates = AppUpdate::published()
            ->latest('published_at')
            ->latest('id')
            ->limit(20)
            ->get();

        $readIds = AppUpdateRead::where('user_id', $request->user()->id)
            ->whereIn('app_update_id', $updates->pluck('id'))
            ->pluck('app_update_id')
            ->flip();

        return response()->json($updates->map(fn ($u) => array_merge($u->only(['id', 'title', 'body', 'version', 'published_at', 'created_at']), [
            'is_read' => isset($readIds[$u->id]),
        ])));
    }

    public function unread(Request $request)
    {
        $readIds = AppUpdateRead::where('user_id', $request->user()->id)->pluck('app_update_id');

        $updates = AppUpdate::published()
            ->whereNotIn('id', $readIds)
            ->orderBy('published_at')
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->map(fn ($u) => $u->only(['id', 'title', 'body', 'version', 'published_at']));

        return response()->json([
            'count' => $updates->count(),
            'updates' => $updates->values(),
            'latest' => $updates->last(),
        ]);
    }

    public function markRead(Request $request, AppUpdate $appUpdate)
    {
        abort_unless($appUpdate->is_published, 404);
        AppUpdateRead::firstOrCreate(
            ['app_update_id' => $appUpdate->id, 'user_id' => $request->user()->id],
            ['read_at' => now()]
        );
        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request)
    {
        $readIds = AppUpdateRead::where('user_id', $request->user()->id)->pluck('app_update_id');
        $unreadIds = AppUpdate::published()->whereNotIn('id', $readIds)->pluck('id');
        foreach ($unreadIds as $id) {
            AppUpdateRead::firstOrCreate(
                ['app_update_id' => $id, 'user_id' => $request->user()->id],
                ['read_at' => now()]
            );
        }
        return response()->json(['ok' => true, 'count' => $unreadIds->count()]);
    }
}
