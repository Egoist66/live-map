<?php

namespace App\Http\Controllers;

use App\Models\PipeFollow;
use App\Models\PipeThread;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Страницы мини-сайта Pipe (pipe.ulove.by) — Inertia-рендер.
 *
 * Тонкие страницы: данные тянет фронт через api/pipe/* (композиции
 * usePipeFeed/usePipeThread), контроллер отдаёт только каркас.
 * Лента открыта и гостям как на Threads — писать могут только
 * авторизованные (api-роуты под auth).
 */
class PipePageController extends Controller
{
    /**
     * Лента Pipe (/) — фильтры, композер, карточки тредов.
     */
    public function index(): Response
    {
        return Inertia::render('Pipe/Index');
    }

    /**
     * Тред (/thread/{thread}) — карточка + ветка ответов.
     *
     * @param PipeThread $thread тред
     */
    public function show(Request $request, PipeThread $thread): Response
    {
        return Inertia::render('Pipe/Show', [
            'threadId' => (int) $thread->id,
        ]);
    }

    /**
     * Страница автора (/author/{user}) — его треды + кнопка подписки.
     *
     * @param User $user автор
     */
    public function profile(Request $request, User $user): Response
    {
        $viewer = $request->user();
        $isSelf = $viewer && (int) $viewer->id === (int) $user->id;

        $isFollowing = false;

        if ($viewer && ! $isSelf) {
            $isFollowing = PipeFollow::existsBetween($viewer->id, (int) $user->id);
        }

        $threadsCount = (int) PipeThread::where('user_id', $user->id)->count();

        return Inertia::render('Pipe/Profile', [
            'profile' => [
                'id' => $user->id,
                'name' => $user->name,
                'profile_slug' => $user->profile_slug,
                'avatar_url' => $user->avatar_url,
                'threads_count' => $threadsCount,
                'is_self' => $isSelf,
                'is_following' => $isFollowing,
            ],
        ]);
    }
}
