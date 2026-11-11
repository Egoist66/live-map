<?php

namespace App\Http\Controllers;

use App\Models\PipeLike;
use App\Models\PipeThread;
use App\Services\PipeService;
use Illuminate\Http\Request;

/**
 * API тредов Pipe (pipe.ulove.by): лента, создание, удаление, лайки.
 *
 * Тонкий контроллер: вся логика в PipeService. Лента читается и
 * гостями, писать/лайкать — только авторизованным (auth:web,sanctum).
 */
class PipeThreadController extends Controller
{
    /**
     * Лента тредов: фильтры all|following|mine|saved, автор, поиск, страница.
     *
     * @param Request $request запрос
     */
    public function index(Request $request)
    {
        $data = $request->validate([
            'filter' => 'sometimes|in:all,following,mine,saved',
            'author_id' => 'sometimes|integer|exists:users,id',
            'thread_id' => 'sometimes|integer|exists:pipe_threads,id',
            'search' => 'sometimes|string|max:120',
        ]);

        $viewer = $request->user();

        $threads = PipeService::feed($viewer, [
            'filter' => $data['filter'] ?? 'all',
            'author_id' => isset($data['author_id']) ? (int) $data['author_id'] : null,
            'thread_id' => isset($data['thread_id']) ? (int) $data['thread_id'] : null,
            'search' => $data['search'] ?? null,
        ]);

        $likedIds = PipeService::likedThreadIds($threads->getCollection(), $viewer);
        $savedIds = PipeService::savedThreadIds($threads->getCollection(), $viewer);

        $threads->getCollection()->transform(function ($thread) use ($viewer, $likedIds, $savedIds) {
            return PipeService::serializeThread($thread, $viewer, [$thread->id => $likedIds[$thread->id] ?? false], [$thread->id => $savedIds[$thread->id] ?? false]);
        });

        return $threads;
    }

    /**
     * Создать тред.
     *
     * @param Request $request запрос
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'body' => 'nullable|required_without:images|string|max:'.config('pipe.thread_max_length'),
            'is_anonymous' => 'sometimes|boolean',
            'images' => 'nullable|array|max:3',
            'images.*' => 'required|image|max:10240',
        ]);

        $images = array_slice($request->file('images', []), 0, 3);

        $thread = PipeService::createThread($request->user(), $data, $images);

        return response()->json(PipeService::serializeThread($thread->refresh(), $request->user()), 201);
    }

    /**
     * Один тред (диплинк/живое обновление карточки).
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function show(Request $request, PipeThread $thread)
    {
        $thread->loadMissing('user:id,name,is_admin');
        PipeService::abortIfBlocked($request->user(), $thread->user);

        return response()->json(PipeService::serializeThread($thread, $request->user()));
    }

    /**
     * Редактировать свой тред: модерация + FloodGuard, как при создании.
     * Анонимность менять нельзя — она задаётся на создании.
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function update(Request $request, PipeThread $thread)
    {
        $user = $request->user();
        $isOwner = (int) $user->id === (int) $thread->user_id;

        abort_unless($isOwner || $user->isAdmin(), 403);

        $data = $request->validate([
            'body' => 'required|string|max:'.config('pipe.thread_max_length'),
        ]);

        $thread = PipeService::updateThread($thread, $user, $data);

        return response()->json(PipeService::serializeThread($thread->refresh(), $user));
    }

    /**
     * Удалить тред (владелец или админ): ответы уезжают каскадом.
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function destroy(Request $request, PipeThread $thread)
    {
        $user = $request->user();
        $isOwner = (int) $user->id === (int) $thread->user_id;

        abort_unless($isOwner || $user->isAdmin(), 403);

        $thread->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Лайк / анлайк треда.
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function toggleLike(Request $request, PipeThread $thread)
    {
        $thread->loadMissing('user:id,name,is_admin');

        if ((int) $request->user()->id !== (int) $thread->user_id) {
            PipeService::abortIfBlocked($request->user(), $thread->user);
        }

        return response()->json(PipeService::toggleLike($request->user(), $thread));
    }

    /**
     * Сохранить тред в избранное / убрать закладку (приватная сущность).
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function toggleSave(Request $request, PipeThread $thread)
    {
        $thread->loadMissing('user:id,name,is_admin');

        if ((int) $request->user()->id !== (int) $thread->user_id) {
            PipeService::abortIfBlocked($request->user(), $thread->user);
        }

        return response()->json(PipeService::toggleSave($request->user(), $thread));
    }

    /**
     * Кто лайкнул тред (для модалки лайков).
     *
     * @param Request $request запрос
     * @param PipeThread $thread тред
     */
    public function likers(Request $request, PipeThread $thread)
    {
        $thread->loadMissing('user:id,name,is_admin');

        if ((int) $request->user()->id !== (int) $thread->user_id) {
            PipeService::abortIfBlocked($request->user(), $thread->user);
        }

        $likes = PipeLike::where('thread_id', $thread->id)
            ->with('user:id,name,profile_slug,avatar_path')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $likers = $likes->map(function ($like) {
            $likeAuthor = $like->user;

            return [
                'user_id' => $likeAuthor?->id ?? $like->user_id,
                'name' => $likeAuthor?->name ?? 'Пользователь',
                'profile_slug' => $likeAuthor?->profile_slug,
                'avatar_url' => $likeAuthor?->avatar_url,
            ];
        })->values();

        return response()->json([
            'likers' => $likers,
            'total' => (int) $thread->likes_count,
        ]);
    }
}
