<?php

namespace App\Console\Commands;

use App\Models\ProfilePhoto;
use App\Services\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Догенерирует превью 480px для старых фото галереи.
 *
 * Превью появились позже оригиналов: сетка показывала полные файлы
 * 1200–1440px (Lighthouse `image-delivery-insight` −1МБ). Команда идёт
 * чанками, идемпотентна (фото с thumb_path пропускаются), диск берёт
 * как контроллер (s3 при настроенном бакете, иначе public).
 */
class BackfillPhotoThumbs extends Command
{
    protected $signature = 'photos:backfill-thumbs {--chunk=200 : Размер чанка} {--dry-run : Только посчитать без записи}';

    protected $description = 'Генерирует превью 480px для фото галереи без thumb_path';

    /**
     * Выполнить backfill превью.
     *
     * @return int
     */
    public function handle(): int
    {
        $chunk = max(50, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');
        $checked = 0;
        $created = 0;
        $skipped = 0;

        ProfilePhoto::whereNull('thumb_path')
            ->orderBy('id')
            ->chunk($chunk, function ($photos) use (&$checked, &$created, &$skipped, $dryRun): void {
                foreach ($photos as $photo) {
                    $checked++;
                    $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket')
                        ? 's3'
                        : 'public';

                    if (! Storage::disk($disk)->exists($photo->path)) {
                        $skipped++;
                        continue;
                    }

                    if ($dryRun) {
                        continue;
                    }

                    try {
                        $thumbPath = ImageOptimizer::storeThumbnail($photo->path, $disk);
                    } catch (\Throwable) {
                        $thumbPath = null;
                    }

                    if (is_string($thumbPath)) {
                        $photo->forceFill(['thumb_path' => $thumbPath])->save();
                        $created++;
                    } else {
                        $skipped++;
                    }
                }
            });

        $this->line("checked {$checked}, created {$created}, skipped {$skipped}");

        return self::SUCCESS;
    }
}
