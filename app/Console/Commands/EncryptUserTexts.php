<?php

namespace App\Console\Commands;

use App\Services\MessageCrypto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Шифрует legacy-plaintext пользовательских текстов в AES-256-GCM.
 *
 * Охват: 4 таблицы комментариев (content), 4 текстовые колонки users,
 * пейлоады notifications (конверт {"__enc"}; админские типы app.* пропускаются —
 * по ним есть JSON-запросы data->update_id). Посты и пины не трогает:
 * по их body/title идёт SQL LIKE-поиск ленты.
 *
 * Идемпотентно: уже зашифрованные пропускаются. Запускать после деплоя
 * кастов и миграции widen. Прямые DB-записи в обход кастов — без двойного шифрования.
 */
class EncryptUserTexts extends Command
{
    protected $signature = 'privacy:encrypt-texts {--chunk=500 : Размер чанка} {--dry-run : Только посчитать без записи}';

    protected $description = 'Шифрует открытые тексты комментариев, профиля и уведомлений (AES-256-GCM)';

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

        $textTargets = [
            ['flow_post_comments', 'content'],
            ['pin_comments', 'content'],
            ['district_post_comments', 'content'],
            ['profile_photo_comments', 'content'],
        ];

        foreach ($textTargets as [$table, $column]) {
            [$t, $e] = $this->encryptColumn($table, $column, $chunk, $dryRun);
            $total += $t;
            $encrypted += $e;
            $this->line("{$table}.{$column}: checked {$t}, encrypted {$e}");
        }

        [$t, $e] = $this->encryptUserColumns($chunk, $dryRun);
        $total += $t;
        $encrypted += $e;
        $this->line("users(bio,thought,dating_about,dating_custom_goal): checked {$t}, encrypted {$e}");

        [$t, $e] = $this->encryptNotifications($chunk, $dryRun);
        $total += $t;
        $encrypted += $e;
        $this->line("notifications.data: checked {$t}, encrypted {$e}");

        $this->info("Total checked {$total}, encrypted {$encrypted}".($dryRun ? ' (dry-run)' : ''));

        return 0;
    }

    /**
     * Зашифровать одну текстовую колонку таблицы построчно.
     *
     * @param string $table
     * @param string $column
     * @param int $chunk
     * @param bool $dryRun
     * @return array{int,int} [проверено, зашифровано]
     */
    private function encryptColumn(string $table, string $column, int $chunk, bool $dryRun): array
    {
        $total = 0;
        $encrypted = 0;

        DB::table($table)->select(['id', $column])->orderBy('id')->chunk($chunk, function ($rows) use ($table, $column, $dryRun, &$total, &$encrypted) {
            foreach ($rows as $row) {
                $total++;
                $raw = $row->{$column} ?? null;

                if ($raw === '' || $raw === null || MessageCrypto::isEncrypted((string) $raw)) {
                    continue;
                }

                $encrypted++;

                if ($dryRun) {
                    continue;
                }

                DB::table($table)->where('id', $row->id)->update([$column => MessageCrypto::encrypt((string) $raw)]);
            }
        });

        return [$total, $encrypted];
    }

    /**
     * Зашифровать текстовые колонки профиля построчно.
     *
     * @param int $chunk
     * @param bool $dryRun
     * @return array{int,int} [проверено, зашифровано]
     */
    private function encryptUserColumns(int $chunk, bool $dryRun): array
    {
        $columns = ['bio', 'thought', 'dating_about', 'dating_custom_goal'];
        $total = 0;
        $encrypted = 0;

        DB::table('users')->select(array_merge(['id'], $columns))->orderBy('id')->chunk($chunk, function ($rows) use ($columns, $dryRun, &$total, &$encrypted) {
            foreach ($rows as $row) {
                $total++;
                $dirty = [];

                foreach ($columns as $column) {
                    $raw = $row->{$column} ?? null;

                    if ($raw === '' || $raw === null || MessageCrypto::isEncrypted((string) $raw)) {
                        continue;
                    }

                    $dirty[$column] = MessageCrypto::encrypt((string) $raw);
                }

                if ($dirty === []) {
                    continue;
                }

                $encrypted++;

                if ($dryRun) {
                    continue;
                }

                DB::table('users')->where('id', $row->id)->update($dirty);
            }
        });

        return [$total, $encrypted];
    }

    /**
     * Упаковать пейлоады уведомлений в шифрованный конверт.
     *
     * Админские типы app.* пропускаются (JSON-запросы data->update_id).
     *
     * @param int $chunk
     * @param bool $dryRun
     * @return array{int,int} [проверено, зашифровано]
     */
    private function encryptNotifications(int $chunk, bool $dryRun): array
    {
        $total = 0;
        $encrypted = 0;

        DB::table('notifications')->select(['id', 'type', 'data'])->orderBy('id')->chunk($chunk, function ($rows) use ($dryRun, &$total, &$encrypted) {
            foreach ($rows as $row) {
                $total++;
                $raw = $row->data ?? null;

                if (! is_string($raw) || $raw === '' || str_starts_with((string) $row->type, 'app.')) {
                    continue;
                }

                $decoded = json_decode($raw, true);

                if (! is_array($decoded) || isset($decoded['__enc'])) {
                    continue;
                }

                $encrypted++;

                if ($dryRun) {
                    continue;
                }

                $envelope = json_encode(['__enc' => MessageCrypto::encrypt($raw)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                if (is_string($envelope)) {
                    DB::table('notifications')->where('id', $row->id)->update(['data' => $envelope]);
                }
            }
        });

        return [$total, $encrypted];
    }
}
