<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\UserDeletionService;
use Illuminate\Console\Command;

/**
 * Удобное удаление пользователя: id, email или profile_slug.
 *
 * Связи чистятся через `cascadeOnDelete`, токены и файлы —
 * через `UserDeletionService`. Ghost-юзер (ID 4) и админы
 * защищены от случайного сноса.
 */
class DeleteUser extends Command
{
    protected $signature = 'user:delete
        {identifier? : ID, email или profile_slug}
        {--force : пропустить подтверждение}
        {--with-admin : разрешить удаление администратора}';

    protected $description = 'Найти и удалить пользователя (id/email/slug) с токенами и файлами';

    /**
     * Найти пользователя и удалить через сервис.
     *
     * @param UserDeletionService $deletion сервис удаления
     * @return int 0 при успехе, 1 при отказе/ошибке
     */
    public function handle(UserDeletionService $deletion): int
    {
        $identifier = $this->argument('identifier');

        if ($identifier === null) {
            $identifier = $this->ask('ID, email или profile_slug пользователя');
        }

        $identifier = trim((string) $identifier);

        if ($identifier === '') {
            $this->error('Пустой идентификатор — некого удалять.');

            return self::FAILURE;
        }

        $user = $this->findUser($identifier);

        if ($user === null) {
            $this->error("Пользователь «{$identifier}» не найден.");

            return self::FAILURE;
        }

        if ((int) $user->id === User::GHOST_USER_ID) {
            $this->error('Ghost-юзера (ID 4) удалять нельзя — сломается скрытие из поиска.');

            return self::FAILURE;
        }

        $isAdmin = $user->isAdmin();

        if ($isAdmin && ! $this->option('with-admin')) {
            $this->error("Это админ (ID {$user->id}). Добавь --with-admin, если точно надо.");

            return self::FAILURE;
        }

        $this->showUserCard($user);

        $isForce = (bool) $this->option('force');

        if (! $isForce) {
            $confirmed = $this->confirm("Удалить {$user->email} (ID {$user->id}) навсегда?", false);

            if (! $confirmed) {
                $this->line('Отмена.');

                return self::SUCCESS;
            }
        }

        $deletion->delete($user);

        $this->info("✓ Пользователь ID {$user->id} удалён (токены и файлы зачищены).");

        return self::SUCCESS;
    }

    /**
     * Найти по ID, email или слагу.
     *
     * @param string $identifier ввод из CLI
     * @return User|null найденный пользователь
     */
    private function findUser(string $identifier): ?User
    {
        if (ctype_digit($identifier)) {
            $byId = User::find((int) $identifier);

            if ($byId !== null) {
                return $byId;
            }
        }

        if (str_contains($identifier, '@')) {
            $byEmail = User::where('email', $identifier)->first();

            if ($byEmail !== null) {
                return $byEmail;
            }
        }

        $bySlug = User::where('profile_slug', $identifier)->first();

        if ($bySlug !== null) {
            return $bySlug;
        }

        $byEmailFallback = User::where('email', $identifier)->first();

        return $byEmailFallback;
    }

    /**
     * Показать карточку перед удалением.
     *
     * @param User $user целевой пользователь
     * @return void
     */
    private function showUserCard(User $user): void
    {
        $created = $user->created_at?->format('Y-m-d H:i');

        $this->table(['Поле', 'Значение'], [
            ['ID', (string) $user->id],
            ['Name', (string) ($user->name ?? '—')],
            ['Email', (string) ($user->email ?? '—')],
            ['Slug', (string) ($user->profile_slug ?? '—')],
            ['Role', (string) ($user->role ?? '—') . ($user->is_admin ? ' + is_admin' : '')],
            ['Plan', (string) ($user->plan ?? 'free')],
            ['Created', (string) ($created ?? '—')],
        ]);
    }
}
