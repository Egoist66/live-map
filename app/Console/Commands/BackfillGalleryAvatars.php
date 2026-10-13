<?php

namespace App\Console\Commands;

use App\Services\UserAvatarService;
use Illuminate\Console\Command;

/**
 * Проставляет avatar_path первым фото галереи тем, у кого аватара нет.
 *
 * Убирает заглушку-человечка в чатах у людей с живой галереей (legacy-аккаунты,
 * удалённый аватар, вход через Telegram без фото). Идемпотентна: трогает только
 * avatar_path IS NULL + пустое telegram-фото, пользователи совсем без фото
 * не затрагиваются. На чтение тот же фолбэк даёт UserAvatarService
 * без записи в БД — команда чинит корень навсегда.
 */
class BackfillGalleryAvatars extends Command
{
    protected $signature = 'avatars:backfill-gallery {--chunk=200 : Размер чанка} {--dry-run : Только посчитать без записи}';

    protected $description = 'Проставляет avatar_path первым фото галереи тем, у кого аватара нет (убирает заглушку в чатах)';

    /**
     * Выполнить backfill аватаров из галереи.
     *
     * @return int
     */
    public function handle(): int
    {
        $chunk = max(50, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');

        $fixed = UserAvatarService::backfillEmptyAvatars($chunk, $dryRun);

        $suffix = $dryRun ? ' (dry-run, без записи)' : '';

        $this->line("users.avatar_path from gallery: {$fixed}{$suffix}");

        return 0;
    }
}
