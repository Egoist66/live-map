<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Services\ChatAttachment;
use Illuminate\Console\Command;

/**
 * Чистит вложения чатов старше срока хранения.
 *
 * Удаляет файлы с диска и поля в БД, сами сообщения остаются.
 * Срок: ChatAttachment::RETENTION_DAYS дней от создания сообщения.
 */
class PruneChatAttachments extends Command
{
    protected $signature = 'chat:prune-attachments';
    protected $description = 'Удаляет вложения чатов старше 15 дней (файлы и поля в БД)';

    public function handle(): int
    {
        $deadline = now()->subDays(ChatAttachment::RETENTION_DAYS);
        $paths = Message::whereNotNull('attachment_path')
            ->where('created_at', '<', $deadline)
            ->pluck('attachment_path');
        foreach ($paths as $path) {
            ChatAttachment::delete($path);
        }
        $count = Message::whereNotNull('attachment_path')
            ->where('created_at', '<', $deadline)
            ->update([
                'attachment_path' => null,
                'attachment_name' => null,
                'attachment_mime' => null,
                'attachment_size' => null,
                'attachment_kind' => null,
                'type' => 'text',
            ]);
        $this->info("Pruned $count attachments");

        return 0;
    }
}
