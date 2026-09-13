<?php

namespace App\Notifications;

/**
 * SOS-чат удалён после завершения пина.
 *
 * Причины: closed (создатель завершил), deleted (пин удалён),
 * expired (истёк срок). История сообщений сохранена в архив
 * каждого участника файлом, ссылка лежит в пейлоаде.
 */
class SosChatClosedNotification extends UserNotification
{
    public function __construct(
        private int $conversationId,
        private string $reason,
        private ?string $pinTitle = null,
        private ?string $archiveUrl = null,
        private ?string $archiveName = null,
        private ?int $archiveMessageId = null,
    ) {}

    public function type(): string { return 'sos.chat_closed'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'sos-chat-closed:'.$this->conversationId.':'.$this->reason; }

    public function payload(string $id): array
    {
        $reasonLabel = match ($this->reason) {
            'deleted' => 'пин удалён',
            'expired' => 'истёк срок пина',
            default => 'пин завершён',
        };

        return [
            'sos_chat_closed' => [
                'id' => $id,
                'conversation_id' => $this->conversationId,
                'reason' => $this->reason,
                'reason_label' => $reasonLabel,
                'pin_title' => $this->pinTitle,
                'archive_url' => $this->archiveUrl,
                'archive_name' => $this->archiveName,
                'archive_download_url' => $this->archiveMessageId
                    ? url('/api/chat/attachments/'.$this->archiveMessageId.'/download')
                    : null,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $reasonLabel = match ($this->reason) {
            'deleted' => 'пин удалён',
            'expired' => 'истёк срок пина',
            default => 'пин завершён',
        };

        $title = $this->pinTitle
            ? '🆘 SOS-чат закрыт: '.$this->pinTitle
            : '🆘 SOS-чат закрыт';

        return [
            'title' => $title,
            'body' => 'Чат удалён, так как '.$reasonLabel.'. История сохранена в архив.',
            'url' => '/chat',
            'tag' => 'sos-chat-closed-'.$this->conversationId,
            'avatar' => null,
        ];
    }
}
