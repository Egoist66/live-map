<?php

namespace App\Http\Controllers;

use App\Events\DistrictUpdated;
use App\Models\District;
use App\Models\DistrictPost;
use App\Models\DistrictPostLike;
use App\Services\ActivityRewards;
use App\Services\ContentModeration;
use App\Services\DistrictNotifier;
use App\Services\ImageOptimizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Новости UDistrict: посты владельца района для жителей.
 *
 * Создаёт/правит/удаляет только владелец (или админ), читают все,
 * лайкают и комментируют жители. О новом посте и пине внутри
 * жители узнают уведомлением через DistrictNotifier.
 */
class DistrictPostController extends Controller
{
    /**
     * Диск картинок новостей: общий с обложками района.
     *
     * @return string имя диска
     */
    private function disk(): string
    {
        return District::coverDisk();
    }

    /**
     * Сериализация новости для ленты района.
     *
     * @param DistrictPost $post новость
     * @param \App\Models\User|null $viewer смотрящий
     * @return array<string,mixed>
     */
    private function serialize(DistrictPost $post, $viewer): array
    {
        $post->loadMissing('user:id,name,avatar_path');

        $author = $post->user;
        $viewerId = $viewer ? (int) $viewer->id : 0;

        $liked = $viewerId > 0
            ? DistrictPostLike::where('post_id', $post->id)->where('user_id', $viewerId)->exists()
            : false;

        $isOwner = $viewer && ((int) $viewer->id === (int) $post->user_id || $viewer->isAdmin());

        return [
            'id' => $post->id,
            'district_id' => $post->district_id,
            'title' => $post->title,
            'body' => $post->body,
            'image_url' => $post->image_url,
            'likes_count' => (int) $post->likes_count,
            'comments_count' => (int) $post->comments_count,
            'liked' => $liked,
            'can_edit' => (bool) $isOwner,
            'can_delete' => (bool) $isOwner,
            'created_at' => $post->created_at?->toISOString(),
            'updated_at' => $post->updated_at?->toISOString(),
            'author' => $author ? [
                'id' => $author->id,
                'name' => $author->name,
                'avatar_url' => $author->avatar_url,
            ] : [
                'id' => null,
                'name' => 'Владелец',
                'avatar_url' => null,
            ],
        ];
    }

    /**
     * Проверить, что автор — владелец района.
     *
     * @param \App\Models\User $user проверяемый
     * @param District $district район
     */
    private function assertDistrictOwner($user, District $district): void
    {
        abort_unless((int) $district->user_id === (int) $user->id || $user->isAdmin(), 403, 'Новости района публикует только его создатель.');
    }

    /**
     * Проверить, что пользователь — житель района.
     *
     * @param \App\Models\User $user проверяемый
     * @param District $district район
     */
    private function assertResident($user, District $district): void
    {
        abort_unless($district->isResident($user->id) || $user->isAdmin(), 403, 'Доступно только жителям района.');
    }

    /**
     * Найти пост внутри района (защита от подмены id).
     *
     * @param District $district район из роута
     * @param int $postId id новости
     * @return DistrictPost
     */
    private function findPost(District $district, int $postId): DistrictPost
    {
        return DistrictPost::where('district_id', $district->id)->findOrFail($postId);
    }

    /**
     * Лента новостей района: свежие сверху.
     *
     * @param Request $request запрос
     * @param District $district район
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request, District $district)
    {
        $viewer = $request->user();

        $posts = DistrictPost::where('district_id', $district->id)
            ->with('user:id,name,avatar_path')
            ->latest()
            ->paginate(20);

        $posts->getCollection()->transform(fn ($post) => $this->serialize($post, $viewer));

        return response()->json($posts);
    }

    /**
     * Опубликовать новость (только владелец).
     *
     * @param Request $request запрос
     * @param District $district район
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request, District $district)
    {
        $user = $request->user();
        $this->assertDistrictOwner($user, $district);

        $data = $request->validate([
            'title' => 'nullable|string|max:150',
            'body' => 'required|string|max:2000',
            'image' => 'nullable|image|max:10240',
        ]);

        ContentModeration::assertClean($data['title'] ?? null, $data['body'] ?? null);

        $imagePath = null;

        if ($request->hasFile('image')) {
            $imagePath = ImageOptimizer::storeOptimized($request->file('image'), 'district-posts', $this->disk());
        }

        $post = DistrictPost::create([
            'district_id' => $district->id,
            'user_id' => $user->id,
            'title' => isset($data['title']) && trim($data['title']) !== '' ? trim($data['title']) : null,
            'body' => trim($data['body']),
            'image_path' => $imagePath,
        ]);

        broadcast(new DistrictUpdated($district))->toOthers();

        try {
            DistrictNotifier::postPublished($post->refresh());
        } catch (\Throwable) {
        }

        $payload = $this->serialize($post->refresh(), $user);
        $reward = ActivityRewards::award($user, 'district_post', 'district_post', $post->id);

        if ($reward !== null) {
            $payload['reward'] = $reward;
        }

        return response()->json($payload, 201);
    }

    /**
     * Править новость (только владелец).
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, District $district, int $postId)
    {
        $user = $request->user();
        $this->assertDistrictOwner($user, $district);

        $post = $this->findPost($district, $postId);

        $data = $request->validate([
            'title' => 'nullable|string|max:150',
            'body' => 'sometimes|required|string|max:2000',
            'image' => 'nullable|image|max:10240',
            'remove_image' => 'sometimes|boolean',
        ]);

        ContentModeration::assertClean($data['title'] ?? null, $data['body'] ?? null);

        $dirty = false;

        if (array_key_exists('title', $data)) {
            $cleanTitle = trim((string) $data['title']);
            $post->title = $cleanTitle !== '' ? $cleanTitle : null;
            $dirty = true;
        }

        if (array_key_exists('body', $data)) {
            $post->body = trim($data['body']);
            $dirty = true;
        }

        if ($request->hasFile('image')) {
            $old = $post->image_path;
            $post->image_path = ImageOptimizer::storeOptimized($request->file('image'), 'district-posts', $this->disk());
            $dirty = true;

            if ($old) {
                try {
                    Storage::disk($this->disk())->delete($old);
                } catch (\Throwable) {
                }
            }
        } elseif (! empty($data['remove_image'])) {
            $old = $post->image_path;
            $post->image_path = null;
            $dirty = true;

            if ($old) {
                try {
                    Storage::disk($this->disk())->delete($old);
                } catch (\Throwable) {
                }
            }
        }

        if ($dirty) {
            $post->save();
        }

        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json($this->serialize($post->refresh(), $user));
    }

    /**
     * Удалить новость вместе с ветками (только владелец).
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, District $district, int $postId)
    {
        $user = $request->user();
        $this->assertDistrictOwner($user, $district);

        $post = $this->findPost($district, $postId);
        $imagePath = $post->image_path;
        $post->delete();

        if ($imagePath) {
            try {
                Storage::disk($this->disk())->delete($imagePath);
            } catch (\Throwable) {
            }
        }

        broadcast(new DistrictUpdated($district))->toOthers();

        return response()->json(['ok' => true]);
    }

    /**
     * Лайк/анлайк новости (только жители).
     *
     * @param Request $request запрос
     * @param District $district район
     * @param int $postId новость
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleLike(Request $request, District $district, int $postId)
    {
        $user = $request->user();
        $this->assertResident($user, $district);

        $post = $this->findPost($district, $postId);

        $existing = DistrictPostLike::where('post_id', $post->id)->where('user_id', $user->id)->first();

        if ($existing) {
            $existing->delete();
            $post->decrement('likes_count');
            DistrictNotifier::postUnliked($post->refresh(), $user);

            return response()->json(['liked' => false, 'likes_count' => (int) $post->refresh()->likes_count]);
        }

        DistrictPostLike::create(['post_id' => $post->id, 'user_id' => $user->id]);
        $post->increment('likes_count');
        DistrictNotifier::postLiked($post->refresh(), $user);

        $response = ['liked' => true, 'likes_count' => (int) $post->refresh()->likes_count];
        $isSelfLike = (int) $user->id === (int) $post->user_id;

        if (! $isSelfLike) {
            $reward = ActivityRewards::award($user, 'district_like', 'district_post', $post->id);

            if ($reward !== null) {
                $response['reward'] = $reward;
            }

            $author = $post->user;

            if ($author && (int) $author->id !== (int) $user->id) {
                ActivityRewards::award($author, 'district_liked', 'district_post', $post->id, (string) $user->id);
            }
        }

        return response()->json($response);
    }
}
