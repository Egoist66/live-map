<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\HomeLocationService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Догружает координаты домашней точки по городу и стране.
 *
 * Нужен для пользователей, зарегистрированных до появления автогеокодинга:
 * у них есть `home_city`/`country`, но нет `home_lat`/`home_lng`, поэтому
 * свайпы не могут посчитать дистанцию. Команда идёт по Nominatim с паузой
 * между запросами, чтобы не нарушать лимит 1 запрос в секунду.
 */
class BackfillHomeLocations extends Command
{
    protected $signature = 'home-locations:backfill
        {--chunk=100 : Сколько пользователей брать за один проход}
        {--limit=0 : Максимум пользователей за запуск, 0 — без лимита}
        {--sleep=1100 : Пауза между запросами в миллисекундах}
        {--dry-run : Показать, кому нужны координаты, без записи в базу}';

    protected $description = 'Догружает home_lat/home_lng по городу и стране для legacy-пользователей';

    /**
     * Выполнить догрузку координат.
     *
     * @param HomeLocationService $locations геокодер домашней точки
     * @return int код завершения команды
     */
    public function handle(HomeLocationService $locations): int
    {
        $chunkSize = max(10, (int) $this->option('chunk'));
        $limit = max(0, (int) $this->option('limit'));
        $sleepMs = max(0, (int) $this->option('sleep'));
        $dryRun = (bool) $this->option('dry-run');

        $processed = 0;
        $located = 0;
        $failed = 0;

        $query = $this->pendingUsers();

        $query->chunkById($chunkSize, function ($users) use (
            $locations,
            $limit,
            $sleepMs,
            $dryRun,
            &$processed,
            &$located,
            &$failed,
        ): bool {
            foreach ($users as $user) {
                if ($limit > 0 && $processed >= $limit) {
                    return false;
                }

                $processed++;
                $place = $this->placeLabel($user);

                if ($dryRun) {
                    $this->line("#{$user->id} {$user->name}: {$place}");

                    continue;
                }

                $locations->ensureCoordinates($user);
                $user->refresh();

                if ($user->home_lat !== null && $user->home_lng !== null) {
                    $located++;
                    $this->line("#{$user->id} {$user->name}: {$place} → {$user->home_lat}, {$user->home_lng}");
                } else {
                    $failed++;
                    $this->warn("#{$user->id} {$user->name}: не удалось геокодировать «{$place}»");
                }

                if ($sleepMs > 0) {
                    usleep($sleepMs * 1000);
                }
            }

            return true;
        });

        $suffix = $dryRun ? ' (dry-run)' : '';
        $this->info("Обработано: {$processed}, координаты получены: {$located}, без координат: {$failed}{$suffix}");

        return self::SUCCESS;
    }

    /**
     * Пользователи без координат, но с городом или страной.
     *
     * @return Builder<User>
     */
    private function pendingUsers(): Builder
    {
        return User::query()
            ->whereNull('home_lat')
            ->whereNull('home_lng')
            ->where(function (Builder $query): void {
                $hasCity = fn (Builder $cityQuery) => $cityQuery
                    ->whereNotNull('home_city')
                    ->where('home_city', '!=', '');

                $hasCountry = fn (Builder $countryQuery) => $countryQuery
                    ->whereNotNull('country')
                    ->where('country', '!=', '');

                $query->where($hasCity)->orWhere($hasCountry);
            })
            ->orderBy('id');
    }

    /**
     * Человекочитаемое место для вывода в консоль.
     *
     * @param User $user пользователь с городом и страной
     * @return string город и страна через запятую
     */
    private function placeLabel(User $user): string
    {
        $parts = array_filter([
            trim((string) $user->home_city),
            trim((string) $user->country),
        ]);

        return $parts === [] ? 'без места' : implode(', ', $parts);
    }
}
