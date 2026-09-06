<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\ProfilePhotoLike;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\ContentModeration;
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
        return [
            'id' => $photo->id,
            'user_id' => $photo->user_id,
            'url' => $photo->url,
            'caption' => $photo->caption,
            'likes_count' => (int) $photo->likes_count,
            'comments_count' => (int) $photo->comments_count,
            'liked' => $viewer ? ProfilePhotoLike::where('photo_id', $photo->id)->where('user_id', $viewer->id)->exists() : false,
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
            'photo' => 'required|image|max:5120',
            'caption' => 'nullable|string|max:500',
        ]);
        $user = $request->user();
        abort_unless($user->canAddProfilePhoto(), 422, 'Лимит фото для тарифа ' . ($user->plan ?? 'free') . ': ' . $user->photoLimit());
        if ($request->filled('caption')) ContentModeration::assertClean($request->input('caption'));
        $path = $request->file('photo')->store('profile-photos', $this->disk());
        $photo = $user->profilePhotos()->create(['path' => $path, 'caption' => $request->input('caption')]);
        return response()->json($this->serialize($photo->refresh(), $user), 201);
    }

    public function update(Request $request, ProfilePhoto $photo)
    {
        abort_unless($request->user()->id === $photo->user_id || $request->user()->isAdmin(), 403);
        $request->validate([
            'caption' => 'nullable|string|max:500',
            'photo' => 'nullable|image|max:5120',
        ]);
        if ($request->filled('caption')) ContentModeration::assertClean($request->input('caption'));
        $data = [];
        if ($request->has('caption')) $data['caption'] = $request->input('caption') ?: null;
        if ($request->hasFile('photo')) {
            Storage::disk($this->disk())->delete($photo->path);
            $data['path'] = $request->file('photo')->store('profile-photos', $this->disk());
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
        $existing = ProfilePhotoLike::where('photo_id', $photo->id)->where('user_id', $viewer->id)->first();
        if ($existing) {
            $existing->delete();
            $photo->decrement('likes_count');
            return response()->json(['liked' => false, 'likes_count' => (int) $photo->refresh()->likes_count]);
        }
        ProfilePhotoLike::create(['photo_id' => $photo->id, 'user_id' => $viewer->id]);
        $photo->increment('likes_count');
        return response()->json(['liked' => true, 'likes_count' => (int) $photo->refresh()->likes_count]);
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
        PinActivityNotifier::photoComment($photo, $viewer, $comment);
        PinActivityNotifier::photoMentions($photo, $viewer, $comment, Mentions::extractIds($data['content'], $viewer->id));
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
