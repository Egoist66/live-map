<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\ProfilePhotoLike;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\ImageOptimizer;
use App\Services\Mentions;
use App\Services\PinActivityNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProfilePhotoController extends Controller
{
    private function disk(): string
    {
        return config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
    }

    private function abortIfBlocked(User $viewer, User $owner): void
    {
        if ($viewer->id === $owner->id || $viewer->isAdmin()) return;
        $blocked = UserBlock::where(function ($q) use ($viewer, $owner) {
            $q->where(fn ($x) => $x->where('blocker_id', $viewer->id)->where('blocked_id', $owner->id))
              ->orWhere(fn ($x) => $x->where('blocker_id', $owner->id)->where('blocked_id', $viewer->id));
        })->exists();
        abort_if($blocked, 403, 'Недоступно');
        abort_unless($owner->isDiscoverableBy($viewer), 404);
    }

    private function serialize(ProfilePhoto $photo, ?User $viewer): array
    {
        $photo->loadMissing('user:id,name,avatar_path');
        $myLike = $viewer ? ProfilePhotoLike::where('photo_id', $photo->id)->where('user_id', $viewer->id)->first() : null;
        return [
            'id' => $photo->id,
            'user_id' => $photo->user_id,
            'url' => $photo->url,
            'caption' => $photo->caption,
            'likes_count' => (int) $photo->likes_count,
            'comments_count' => (int) $photo->comments_count,
            'liked' => (bool) $myLike,
            'liked_incognito' => (bool) ($myLike?->is_incognito ?? false),
            'can_comment' => $viewer ? $viewer->canCommentProfilePhoto($photo->user ?? $photo->user()->first()) : false,
            'created_at' => $photo->created_at?->toISOString(),
        ];
    }

    public function index(Request $request, User $user)
    {
        $viewer = $request->user();
        if ($viewer->id !== $user->id) $this->abortIfBlocked($viewer, $user);
        $photos = $user->profilePhotos()->latest()->get();
        return response()->json([
            'photos' => $photos->map(fn ($p) => $this->serialize($p, $viewer))->values(),
            'limit' => $user->photoLimit(),
            'count' => $photos->count(),
            'can_add' => $viewer->id === $user->id ? $user->canAddProfilePhoto() : false,
            'photo_comments_privacy' => $user->photo_comments_privacy ?? 'everyone',
            'can_comment' => $viewer->canCommentProfilePhoto($user),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|max:10240',
            'caption' => 'nullable|string|max:500',
        ]);
        $user = $request->user();
        if ($request->filled('caption')) ContentModeration::assertClean($request->input('caption'));
        $path = ImageOptimizer::storeOptimized($request->file('photo'), 'profile-photos', $this->disk());
        try {
            $photo = \Illuminate\Support\Facades\DB::transaction(function () use ($user, $path, $request) {
                $locked = \App\Models\User::whereKey($user->id)->lockForUpdate()->first();
                abort_unless($locked->canAddProfilePhoto(), 422, 'Лимит фото для тарифа ' . $locked->effectivePlan() . ': ' . $locked->photoLimit());
                return $locked->profilePhotos()->create(['path' => $path, 'caption' => $request->input('caption')]);
            });
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Storage::disk($this->disk())->delete($path);
            throw $e;
        }
        $fresh = $photo->refresh();
        try {
            \App\Services\UserSubscriptionNotifier::photoCreated($fresh);
        } catch (\Throwable) {
        }
        $payload = $this->serialize($fresh, $user);
        $reward = ActivityRewards::award($user, 'photo_upload', 'profile_photo', (int) $photo->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    public function update(Request $request, ProfilePhoto $photo)
    {
        abort_unless($request->user()->id === $photo->user_id || $request->user()->isAdmin(), 403);
        $request->validate([
            'caption' => 'nullable|string|max:500',
            'photo' => 'nullable|image|max:10240',
        ]);
        if ($request->filled('caption')) ContentModeration::assertClean($request->input('caption'));
        $data = [];
        if ($request->has('caption')) $data['caption'] = $request->input('caption') ?: null;
        if ($request->hasFile('photo')) {
            Storage::disk($this->disk())->delete($photo->path);
            $data['path'] = ImageOptimizer::storeOptimized($request->file('photo'), 'profile-photos', $this->disk());
        }
        if ($data) $photo->update($data);
        return response()->json($this->serialize($photo->refresh(), $request->user()));
    }

    public function destroy(Request $request, ProfilePhoto $photo)
    {
        abort_unless($request->user()->id === $photo->user_id || $request->user()->isAdmin(), 403);
        Storage::disk($this->disk())->delete($photo->path);
        if ($this->disk() !== 'public') Storage::disk('public')->delete($photo->path);
        $photo->delete();
        return response()->json(['ok' => true]);
    }

    public function toggleLike(Request $request, ProfilePhoto $photo)
    {
        $viewer = $request->user();
        $owner = $photo->user;
        if ($viewer->id !== $owner->id) $this->abortIfBlocked($viewer, $owner);
        $data = $request->validate(['incognito' => 'sometimes|boolean']);
        $incognito = (bool) ($data['incognito'] ?? false);
        if ($incognito && ! $viewer->canUseIncognitoLike()) {
            return response()->json(['message' => 'Анонимный лайк — PRO-функция. Оформите PRO, чтобы скрывать себя.'], 402);
        }
        $existing = ProfilePhotoLike::where('photo_id', $photo->id)->where('user_id', $viewer->id)->first();
        if ($existing) {
            $existing->delete();
            $photo->decrement('likes_count');
            PinActivityNotifier::photoUnliked($photo, $viewer);
            return response()->json(['liked' => false, 'likes_count' => (int) $photo->refresh()->likes_count]);
        }
        ProfilePhotoLike::create(['photo_id' => $photo->id, 'user_id' => $viewer->id, 'is_incognito' => $incognito]);
        $photo->increment('likes_count');
        PinActivityNotifier::photoLiked($photo->refresh(), $viewer);

        $response = ['liked' => true, 'likes_count' => (int) $photo->refresh()->likes_count, 'is_incognito' => $incognito];
        $isSelfLike = (int) $viewer->id === (int) $photo->user_id;

        if (! $isSelfLike) {
            $reward = ActivityRewards::award($viewer, 'photo_like', 'profile_photo', $photo->id);

            if ($reward !== null) {
                $response['reward'] = $reward;
            }

            $owner = $photo->user;

            if ($owner && (int) $owner->id !== (int) $viewer->id) {
                ActivityRewards::award($owner, 'photo_liked', 'profile_photo', $photo->id, (string) $viewer->id);
            }
        }

        return response()->json($response);
    }

    /**
     * Кто лайкнул фото (как в инсте): открытый список.
     * Инкогнито (PRO) видно как «Тайный поклонник», id скрыт от чужих.
     */
    public function likers(Request $request, ProfilePhoto $photo)
    {
        $viewer = $request->user();
        if ($viewer->id !== $photo->user_id) $this->abortIfBlocked($viewer, $photo->user);
        $likes = ProfilePhotoLike::where('photo_id', $photo->id)->with('user:id,name,avatar_path,last_seen_at')->latest()->limit(50)->get();
        $isOwner = $viewer->id === $photo->user_id || $viewer->isAdmin();
        $list = $likes->map(function ($like) use ($isOwner) {
            $isIncognito = (bool) $like->is_incognito;
            if ($isIncognito && ! $isOwner) {
                return ['user_id' => null, 'name' => 'Тайный поклонник', 'avatar_url' => null, 'is_incognito' => true, 'created_at' => $like->created_at?->toISOString()];
            }
            $u = $like->user;
            return [
                'user_id' => $u?->id ?? $like->user_id,
                'name' => $isIncognito ? 'Тайный поклонник' : ($u?->name ?? 'Пользователь'),
                'avatar_url' => $isIncognito ? null : $u?->avatar_url,
                'is_incognito' => $isIncognito,
                'created_at' => $like->created_at?->toISOString(),
            ];
        })->values();
        return response()->json(['likers' => $list, 'total' => $photo->likes_count, 'incognito_count' => $likes->where('is_incognito', true)->count()]);
    }

    public function comments(Request $request, ProfilePhoto $photo)
    {
        $viewer = $request->user();
        if ($viewer->id !== $photo->user_id) $this->abortIfBlocked($viewer, $photo->user);
        $list = $photo->comments()->with('user:id,name,avatar_path')->oldest()->paginate(30);
        return response()->json($list);
    }

    public function storeComment(Request $request, ProfilePhoto $photo)
    {
        $viewer = $request->user();
        if ($viewer->id !== $photo->user_id) $this->abortIfBlocked($viewer, $photo->user);
        abort_unless($viewer->canCommentProfilePhoto($photo->user), 403, 'Автор запретил комментировать фото');
        $data = $request->validate(['content' => 'required|string|max:1000']);
        ContentModeration::assertClean($data['content']);
        $comment = $photo->comments()->create(['user_id' => $viewer->id, 'content' => $data['content']]);
        $photo->increment('comments_count');
        $mentionedIds = Mentions::extractIds($data['content'], $viewer->id);
        PinActivityNotifier::photoComment($photo, $viewer, $comment, $mentionedIds);
        PinActivityNotifier::photoMentions($photo, $viewer, $comment, $mentionedIds);
        $comment->load('user:id,name,avatar_path');
        return response()->json($comment, 201);
    }

    public function destroyComment(Request $request, ProfilePhotoComment $comment)
    {
        $viewer = $request->user();
        $isOwner = $viewer->id === $comment->user_id || $viewer->id === $comment->photo->user_id || $viewer->isAdmin();
        abort_unless($isOwner, 403);
        $photo = $comment->photo;
        $comment->delete();
        $photo->decrement('comments_count');
        return response()->json(['ok' => true]);
    }

    public function updatePrivacy(Request $request)
    {
        $request->validate(['photo_comments_privacy' => 'required|in:everyone,friends,none']);
        $request->user()->forceFill(['photo_comments_privacy' => $request->input('photo_comments_privacy')])->save();
        return response()->json(['photo_comments_privacy' => $request->user()->photo_comments_privacy]);
    }

    public static function isFriend(int $a, int $b): bool
    {
        return Friendship::areFriends($a, $b);
    }
}
