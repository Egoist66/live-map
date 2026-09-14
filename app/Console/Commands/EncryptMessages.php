<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Services\MessageCrypto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Шифрует legacy-plaintext строки messages.body в AES-256-GCM.
 *
 * Идемпотентно: уже зашифрованные (префикс gcm1:) пропускаются.
 * Запускать после деплоя каста и MESSAGE_CRYPTO_KEY на проде.
 */
class EncryptMessages extends Command
{
    protected $signature = 'chat:encrypt-messages {--chunk=500 : Размер чанка} {--dry-run : Только посчитать без записи}';

    protected $description = 'Шифрует открытые тела сообщений (AES-256-GCM)';

    /**
     * Выполнить backfill шифрования.
     *
     * @return int
     */
    public function handle(): int
    {
        $chunk = max(100, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $total = 0;
        $encrypted = 0;

        Message::query()->select(['id', 'body'])->orderBy('id')->chunk($chunk, function ($rows) use (&$total, &$encrypted, $dryRun) {
            foreach ($rows as $row) {
                $total++;
                $raw = $row->getRawOriginal('body');

                if ($raw === '' || $raw === null || MessageCrypto::isEncrypted($raw)) {
                    continue;
                }

                $encrypted++;

                if ($dryRun) {
                    continue;
                }

                $cipher = MessageCrypto::encrypt((string) $raw);
                DB::table('messages')->where('id', $row->id)->update(['body' => $cipher]);
            }
        });

        $this->info("Checked $total, encrypted $encrypted".($dryRun ? ' (dry-run)' : ''));

        return 0;
    }
}
