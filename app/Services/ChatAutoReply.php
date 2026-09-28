<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Mail\ChatMessagePingMail;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Автоответ «меня нет онлайн» + email-пинг владельцу.
 *
 * Срабатывает только для личных (direct) диалогов, когда получатель:
 * - включил автоответ,
 * - считается отошедшим (last_seen_at старше 3 минут),
 * - имеет email в аккаунте.
 *
 * Антиспам: не чаще одного автоответа в час на диалог.
 */
class ChatAutoReply
{
    /**
     * Кулдаун между автоответами в одном диалоге.
     */
    public const COOLDOWN_SECONDS = 3600;

    /**
     * Проверить получателей и при нужде отправить автоответ.
     *
     * Вызывается после создания обычного сообщения. Автоответные
     * сообщения сами триггером не являются (флаг $isAutoReply).
     *
     * @param Conversation $conversation диалог только что отправленного сообщения
     * @param User $sender автор исходного сообщения
     * @param Message $incoming только что созданное сообщение (для превью в письме)
     * @param bool $isAutoReply true если $incoming сам является автоответом
     * @return Message|null созданный автоответ либо null
     */
    public function maybeReply(
        Conversation $conversation,
        User $sender,
        Message $incoming,
        bool $isAutoReply = false,
    ): ?Message {
        if ($isAutoReply) {
            return null;
        }

        if ($conversation->type !== 'direct') {
            return null;
        }

        $recipientIds = $conversation
            ->participantRows()
            ->where('user_id', '!=', $sender->id)
            ->pluck('user_id');

        if ($recipientIds->isEmpty()) {
            return null;
        }

        $recipient = User::whereKey($recipientIds->first())
            ->first(['id', 'name', 'email', 'email_verified_at', 'last_seen_at', 'auto_reply_enabled', 'auto_reply_text']);

        if (! $recipient) {
            return null;
        }

        if (! (bool) $recipient->auto_reply_enabled) {
            return null;
        }

        if (! $recipient->isAway()) {
            return null;
        }

        $cooldownKey = $this->cooldownKey($conversation->id, $recipient->id);

        if (Cache::has($cooldownKey)) {
            return null;
        }

        $body = $recipient->autoReplyTextOrDefault();

        $reply = Message::create([
            'conversation_id' => $conversation->id,
            'reply_to_id' => null,
            'sender_id' => $recipient->id,
            'body' => $body,
            'type' => 'text',
        ]);

        $reply->load(['sender:id,name,avatar_path', 'conversation.participantRows']);

        $conversation->update(['last_message_at' => $reply->created_at]);

        $conversation
            ->participantRows()
            ->whereNotNull('hidden_at')
            ->update(['hidden_at' => null]);

        Cache::put($cooldownKey, true, self::COOLDOWN_SECONDS);

        try {
            broadcast(new MessageSent($reply))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('autoreply broadcast failed: '.$e->getMessage());
        }

        $this->pingByEmail($conversation, $sender, $recipient, $incoming);

        return $reply;
    }

    /**
     * Ключ кулдауна автоответа для диалога.
     *
     * @param int $conversationId диалог
     * @param int $recipientId владелец автоответа
     * @return string ключ кэша
     */
    private function cooldownKey(int $conversationId, int $recipientId): string
    {
        return "chat:auto_reply:{$conversationId}:{$recipientId}";
    }

    /**
     * Отправить email-пинг владельцу автоответа о новом сообщении.
     *
     * @param Conversation $conversation диалог
     * @param User $sender кто написал
     * @param User $recipient владелец автоответа (получатель письма)
     * @param Message $incoming исходное сообщение
     * @return void
     */
    private function pingByEmail(
        Conversation $conversation,
        User $sender,
        User $recipient,
        Message $incoming,
    ): void {
        $email = trim((string) ($recipient->email ?? ''));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        if (! $recipient->hasVerifiedEmail()) {
            return;
        }

        $preview = trim((string) $incoming->body);

        if ($preview === '' && $incoming->attachment_path) {
            $preview = '📎 Вложение';
        }

        $preview = mb_substr($preview, 0, 200);

        try {
            Mail::to($email)->queue(new ChatMessagePingMail($recipient, $sender, $conversation, $preview));
        } catch (\Throwable $e) {
            Log::warning('autoreply email failed: '.$e->getMessage());
        }
    }
}
