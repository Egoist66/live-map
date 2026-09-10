<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Services\ChatAttachment;
use Illuminate\Http\Request;

/**
 * Архив вложений пользователя: документы и фото из чатов.
 *
 * Показывает только отправленные текущим пользователем файлы.
 * Срок хранения — ChatAttachment::RETENTION_DAYS дней, дальше чистит планировщик.
 */
class ChatAttachmentController extends Controller
{
    /**
     * Список отправленных вложений с контекстом чата.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $me = $request->user()->id;
        $items = Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->with(['conversation.participants' => fn ($q) => $q->select('users.id', 'users.name')])
            ->latest('id')
            ->paginate(30);
        $items->getCollection()->transform(fn ($m) => $this->serialize($m, $me));

        return response()->json($items);
    }

    /**
     * Удаляет одно вложение: файл с диска и поля в БД.
     *
     * @param Request $request
     * @param Message $message сообщение с вложением
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, Message $message)
    {
        abort_unless($message->sender_id === $request->user()->id || $request->user()->isAdmin(), 403);
        abort_if(! $message->attachment_path, 404, 'Вложение уже удалено');
        ChatAttachment::delete($message->attachment_path);
        $message->update([
            'attachment_path' => null,
            'attachment_name' => null,
            'attachment_mime' => null,
            'attachment_size' => null,
            'attachment_kind' => null,
            'type' => 'text',
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * Удаляет все вложения пользователя из БД и с диска.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function clear(Request $request)
    {
        $me = $request->user()->id;
        $paths = Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->pluck('attachment_path');
        foreach ($paths as $path) {
            ChatAttachment::delete($path);
        }
        Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->update([
                'attachment_path' => null,
                'attachment_name' => null,
                'attachment_mime' => null,
                'attachment_size' => null,
                'attachment_kind' => null,
                'type' => 'text',
            ]);

        return response()->json(['ok' => true, 'deleted' => $paths->count()]);
    }

    /**
     * Сериализует вложение для списка архива.
     *
     * @param Message $message
     * @param int $me id текущего пользователя
     * @return array
     */
    private function serialize(Message $message, int $me): array
    {
        $other = $message->relationLoaded('conversation') && $message->conversation
            ? $message->conversation->participants->firstWhere('id', '!=', $me)
            : null;
        $created = $message->created_at;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'chat_with' => $other ? ['id' => $other->id, 'name' => $other->name] : null,
            'attachment' => $message->attachmentPayload(),
            'created_at' => $created?->toISOString(),
            'expires_at' => $created
                ? $created->copy()->addDays(ChatAttachment::RETENTION_DAYS)->toISOString()
                : null,
        ];
    }
}
