<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Сообщение чата: текст, вложения и голосовые.
 *
 * Голосовое — это вложение с kind=voice и длительностью
 * в attachment_duration (секунды, макс 60).
 *
 * @property int $id
 * @property int $conversation_id
 * @property int|null $reply_to_id
 * @property string|null $shared_post_type flow|district — тип пересланного поста
 * @property int|null $shared_post_id id пересланного поста
 * @property int $sender_id
 * @property string $body
 * @property string $type
 * @property string|null $attachment_path
 * @property string|null $attachment_name
 * @property string|null $attachment_mime
 * @property int|null $attachment_size
 * @property string|null $attachment_kind
 * @property int|null $attachment_duration
 */
class Message extends Model
{
    protected $fillable = ['conversation_id','reply_to_id','shared_post_type','shared_post_id','sender_id','body','type','read_at','delivered_at','edited_at','pinned_at','pinned_by','attachment_path','attachment_name','attachment_mime','attachment_size','attachment_kind','attachment_duration'];
    protected $casts = [
        'body' => \App\Casts\MessageBodyCast::class,
        'read_at' => 'datetime',
        'delivered_at' => 'datetime',
        'edited_at' => 'datetime',
        'pinned_at' => 'datetime',
    ];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class,'sender_id'); }

    /**
     * Сообщение, на которое дан ответ.
     */
    public function replyTo(): BelongsTo { return $this->belongsTo(Message::class,'reply_to_id'); }

    public function statusFor(?int $viewerId = null): string
    {
        if ($this->read_at) return 'read';
        if ($this->delivered_at) return 'delivered';
        return 'sent';
    }

    /**
     * Короткое представление цитируемого сообщения для ответа.
     *
     * У голосового без текста подставляется подпись с длительностью,
     * чтобы цитата не была пустой.
     */
    public function replyToPayload(): ?array
    {
        $orig = $this->relationLoaded('replyTo') ? $this->replyTo : $this->replyTo()->first();
        if (! $orig) return null;
        $sender = $orig->relationLoaded('sender') ? $orig->sender : $orig->sender()->first(['id', 'name']);
        $body = (string) $orig->body;
        if ($body === '' && $orig->attachment_kind === 'voice') {
            $body = '🎤 Голосовое сообщение';
            if ($orig->attachment_duration) {
                $body .= ' ('.$orig->attachment_duration.' c)';
            }
        }
        return [
            'id' => $orig->id,
            'body' => $body,
            'sender_id' => $orig->sender_id,
            'sender_name' => $sender?->name,
        ];
    }

    /**
     * Пейлоад вложения для фронта: url, имя, mime, размер, вид, длительность.
     *
     * @return array|null
     */
    public function attachmentPayload(): ?array
    {
        if (! $this->attachment_path) {
            return null;
        }

        return [
            'url' => \App\Services\ChatAttachment::url($this->attachment_path),
            'name' => $this->attachment_name,
            'mime' => $this->attachment_mime,
            'size' => $this->attachment_size !== null ? (int) $this->attachment_size : null,
            'kind' => $this->attachment_kind,
            'duration' => $this->attachment_duration !== null ? (int) $this->attachment_duration : null,
        ];
    }

    /**
     * Пейлоад пересланного поста для фронта: превью + диплинк.
     *
     * Пост подгружается живым (а не снапшотом), чтобы получатель видел
     * актуальный текст и мог провалиться в него по клику. Если пост удалён
     * или скрыт анонимностью/блоком — отдаём заглушку с флагом unavailable.
     *
     * @param \App\Models\User|null $viewer получатель для проверки видимости
     * @return array|null
     */
    public function sharedPostPayload($viewer = null): ?array
    {
        $type = (string) ($this->shared_post_type ?? '');
        $postId = (int) ($this->shared_post_id ?? 0);

        if (($type !== 'flow' && $type !== 'district') || $postId <= 0) {
            return null;
        }

        if ($type === 'flow') {
            $post = \App\Models\FlowPost::with(['user:id,name,profile_slug,avatar_path', 'media'])->find($postId);

            if (! $post) {
                return $this->sharedPostStub($type, $postId);
            }

            $isOwn = $viewer && (int) $viewer->id === (int) $post->user_id;
            $canSeeAuthor = ! $post->is_anonymous || $isOwn || ($viewer && $viewer->isAdmin());
            $author = $post->user;

            $firstPhoto = $post->media
                ->first(fn ($item) => $item->kind === 'photo' && $item->url);

            $excerpt = (string) ($post->title ? $post->title.' — ' : '').$post->body;
            $excerpt = trim(preg_replace('/\s+/u', ' ', $excerpt) ?? '');

            if (mb_strlen($excerpt) > 160) {
                $excerpt = mb_substr($excerpt, 0, 160).'…';
            }

            return [
                'type' => 'flow',
                'id' => (int) $post->id,
                'title' => $post->title,
                'excerpt' => $excerpt !== '' ? $excerpt : null,
                'image_url' => $firstPhoto?->url ?? $post->image_url,
                'author_name' => $canSeeAuthor && $author ? $author->name : 'Аноним',
                'url' => '/flow/post/'.$post->id,
            ];
        }

        $post = \App\Models\DistrictPost::with(['user:id,name,profile_slug,avatar_path', 'district:id,name'])->find($postId);

        if (! $post) {
            return $this->sharedPostStub($type, $postId);
        }

        $excerpt = (string) ($post->title ? $post->title.' — ' : '').$post->body;
        $excerpt = trim(preg_replace('/\s+/u', ' ', $excerpt) ?? '');

        if (mb_strlen($excerpt) > 160) {
            $excerpt = mb_substr($excerpt, 0, 160).'…';
        }

        return [
            'type' => 'district',
            'id' => (int) $post->id,
            'district_id' => (int) $post->district_id,
            'district_name' => $post->district?->name,
            'title' => $post->title,
            'excerpt' => $excerpt !== '' ? $excerpt : null,
            'image_url' => $post->image_url,
            'author_name' => $post->user?->name ?? 'Владелец',
            'url' => '/districts/'.(int) $post->district_id.'?post='.(int) $post->id,
        ];
    }

    /**
     * Заглушка удалённого/недоступного поста.
     *
     * @param string $type тип поста
     * @param int $postId id поста
     * @return array<string,mixed>
     */
    private function sharedPostStub(string $type, int $postId): array
    {
        return [
            'type' => $type,
            'id' => $postId,
            'title' => null,
            'excerpt' => null,
            'image_url' => null,
            'author_name' => null,
            'url' => $type === 'flow' ? '/flow/post/'.$postId : null,
            'unavailable' => true,
        ];
    }

    public function toArrayPayload(): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'reply_to_id' => $this->reply_to_id,
            'reply_to' => $this->reply_to_id ? $this->replyToPayload() : null,
            'shared_post' => $this->sharedPostPayload(),
            'sender_id' => $this->sender_id,
            'body' => $this->body,
            'type' => $this->type,
            'attachment' => $this->attachmentPayload(),
            'created_at' => $this->created_at?->toISOString(),
            'edited_at' => $this->edited_at?->toISOString(),
            'delivered_at' => $this->delivered_at?->toISOString(),
            'read_at' => $this->read_at?->toISOString(),
            'status' => $this->statusFor(),
            'is_edited' => $this->edited_at !== null,
            'is_pinned' => $this->pinned_at !== null,
            'pinned_at' => $this->pinned_at?->toISOString(),
            'pinned_by' => $this->pinned_by,
            'sender' => $this->relationLoaded('sender') ? [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_path' => $this->sender->avatar_path,
                'telegram_photo_url' => $this->sender->telegram_photo_url ?? null,
                'avatar_url' => $this->sender->avatar_url,
            ] : null,
        ];
    }
}
