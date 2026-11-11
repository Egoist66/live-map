<?php

namespace App\Http\Controllers;

use App\Models\PipeFollow;
use App\Models\PipeThread;
use App\Models\User;
use App\Services\PipeService;
use Illuminate\Http\Request;

/**
 * API подписок Pipe: toggle подписки, статус автора, счётчики.
 */
class PipeFollowController extends Controller
{
    /**
     * Статус профиля автора для pipe-страницы: треды чьи, подписан ли.
     *
     * @param Request $request запрос
     * @param User $user автор
     */
    public function status(Request $request, User $user)
    {
        $viewer = $request->user();
        $isSelf = (int) $viewer->id === (int) $user->id;

        $isFollowing = false;

        if (! $isSelf) {
            $isFollowing = PipeFollow::existsBetween($viewer->id, (int) $user->id);
        }

        $threadsCount = (int) PipeThread::where('user_id', $user->id)->count();
        $followersCount = (int) PipeFollow::where('following_id', $user->id)->count();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'profile_slug' => $user->profile_slug,
            'avatar_url' => $user->avatar_url,
            'threads_count' => $threadsCount,
            'followers_count' => $followersCount,
            'is_self' => $isSelf,
            'is_following' => $isFollowing,
        ]);
    }

    /**
     * Подписаться / отписаться на автора.
     *
     * @param Request $request запрос
     * @param User $user автор
     */
    public function toggle(Request $request, User $user)
    {
        PipeService::abortIfBlocked($request->user(), $user);

        $result = PipeService::toggleFollow($request->user(), $user);

        return response()->json($result);
    }
}
