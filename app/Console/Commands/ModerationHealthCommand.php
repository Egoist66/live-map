<?php

namespace App\Console\Commands;

use App\Services\PhotoModerationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Console\Command;

/**
 * Проверка работоспособности Sightengine-модерации фото.
 *
 * Дешёвый smoke-тест для прода и локали: проверяет доступность ключей
 * и, при заданном --url либо --file, отправляет картинку в Sightengine
 * и печатает вердикт. Без аргументов — только статус конфигурации.
 *
 * Выходной код: 0 — модерация настроена и проверка прошла; 1 — ключи
 * не заданы, API недоступен (fail-open) либо тест запрещён — по коду
 * легко поймать нерабочую конфигурацию в деплое.
 *
 * @example php artisan moderation:health
 * @example php artisan moderation:health --url=https://sightengine.com/assets/img/examples/example7.jpg
 * @example php artisan moderation:health --file=/path/to/photo.jpg
 */
class ModerationHealthCommand extends Command
{
    protected $signature = 'moderation:health
        {--url= : Публичный URL картинки для реальной проверки}
        {--file= : Локальный путь картинки для реальной проверки}';

    protected $description = 'Smoke-тест модерации фото (Sightengine): конфиг ключей и вердикт по картинке';

    /**
     * Выполнить проверку.
     *
     * @return int self::SUCCESS | self::FAILURE
     */
    public function handle(): int
    {
        $apiUser = trim((string) config('services.sightengine.api_user'));
        $apiKey = trim((string) config('services.sightengine.api_key'));
        $hasKeys = $apiUser !== '' && $apiKey !== '';

        $this->info('config: services.sightengine.api_user = '.($hasKeys ? $apiUser : '[не задан]'));
        $this->line('thresholds: '.json_encode(config('services.sightengine.thresholds')));

        if (! $hasKeys) {
            $this->error('Ключи Sightengine не заданы: SIGHTENGINE_API_USER / SIGHTENGINE_API_KEY. Модерация отключена (fail-open).');

            return self::FAILURE;
        }

        $url = trim((string) $this->option('url'));
        $file = trim((string) $this->option('file'));

        if ($url === '' && $file === '') {
            $this->line('Ключи на месте. Для проверки на пакете добавьте --url=<публичный URL картинки> или --file=<путь к файлу>.');

            return self::SUCCESS;
        }

        $verdict = $url !== ''
            ? PhotoModerationService::checkUrl($url)
            : $this->checkFile($file);

        if ($verdict === null) {
            $this->error('Файл не найден или не читается: '.$file);

            return self::FAILURE;
        }

        $skippedLesson = $verdict['skipped'] ? ' (skipped: API недоступен — fail-open)' : '';

        if ($verdict['allowed'] && ! $verdict['skipped']) {
            $this->info('OK: Sightengine доступен, картинка прошла модерацию'.$skippedLesson);

            return self::SUCCESS;
        }

        if ($verdict['skipped']) {
            $this->error('FAILOPEN: запрос к Sightengine не удался — картинка пропущена с логом. Смотрите storage/logs.');

            return self::FAILURE;
        }

        foreach ($verdict['reasons'] as $reason) {
            $this->line('blocked: '.$reason);
        }

        return self::FAILURE;
    }

    /**
     * Проверить локальный файл через тот же путь, что и загрузку.
     *
     * @param string $path путь к картинке
     * @return array{allowed: bool, reasons: list<string>, skipped: bool}|null
     */
    private function checkFile(string $path): ?array
    {
        if (! is_file($path) || ! is_readable($path)) {
            return null;
        }

        $file = new UploadedFile($path, basename($path), 'image/jpeg', null, true);

        return PhotoModerationService::check($file);
    }
}
