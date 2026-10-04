<?php

namespace App\Console\Commands;

use App\Http\Controllers\SupportController;
use App\Mail\SupportRequestMail;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Mail;

/**
 * Почта сервиса: показ и смена адреса, куда уходят письма.
 *
 * Письма поддержки/сотрудничества/жалоб шлются админам
 * (все is_admin + ADMIN_EMAIL из .env с фолбэком razormad666@gmail.com).
 * Когда появится корпоративная почта — одна команда меняет её
 * без правок кода и деплоя.
 *
 * @example php artisan service:email --show
 * @example php artisan service:email help@company.by
 * @example php artisan service:email help@company.by --from --test
 */
class ServiceEmailCommand extends Command
{
    /**
     * @var string сигнатура: email опционален (без него — только показ)
     */
    protected $signature = 'service:email
        {email? : Новый адрес сервиса (пусто — только показать текущий)}
        {--show : Только показать текущие адреса, ничего не менять}
        {--from : Вместе с ADMIN_EMAIL сменить и MAIL_FROM_ADDRESS}
        {--test : После смены отправить тестовое письмо на новый адрес}';

    /**
     * @var string описание команды
     */
    protected $description = 'Показать/сменить почту сервиса (ADMIN_EMAIL): куда уходят письма поддержки';

    /**
     * Выполнить команду: показ текущего или запись нового адреса в .env.
     *
     * @return int self::SUCCESS | self::FAILURE
     */
    public function handle(): int
    {
        if ($this->option('show') || ! $this->argument('email')) {
            $this->showCurrent();

            return self::SUCCESS;
        }

        $email = mb_strtolower(trim((string) $this->argument('email')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error("Некорректный email: {$email}");

            return self::FAILURE;
        }

        if (! $this->confirm("Сменить почту сервиса на {$email}?", true)) {
            $this->line('Отменено.');

            return self::SUCCESS;
        }

        if (! $this->writeEnvValue('ADMIN_EMAIL', $email)) {
            return self::FAILURE;
        }

        $this->info("✓ ADMIN_EMAIL = {$email}");

        if ($this->option('from')) {
            if ($this->writeEnvValue('MAIL_FROM_ADDRESS', $email)) {
                $this->info("✓ MAIL_FROM_ADDRESS = {$email}");
            }
        }

        $this->refreshConfigCache();
        $this->line('Перезапусти RoadRunner/queue-воркеры, чтобы долгоживущие процессы подхватили новый .env.');

        if ($this->option('test')) {
            $this->sendTest($email);
        }

        $this->showCurrent();

        return self::SUCCESS;
    }

    /**
     * Показать таблицей, куда сейчас уходят письма сервиса.
     *
     * @return void
     */
    private function showCurrent(): void
    {
        try {
            $adminUsers = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('email')->filter()->values()->all();
        } catch (\Throwable) {
            $adminUsers = null;
        }

        try {
            $realRecipients = SupportController::adminEmails();
        } catch (\Throwable) {
            $realRecipients = [(string) (config('mail.admin_address') ?? config('seo.support_email') ?? config('mail.from.address'))];
        }

        $this->table(['Куда', 'Значение'], [
            ['ADMIN_EMAIL (.env)', env('ADMIN_EMAIL') ?: '— (фолбэк кода)'],
            ['mail.admin_address (эффект.)', config('mail.admin_address')],
            ['seo.support_email', config('seo.support_email')],
            ['mail.from', config('mail.from.address').' ('.config('mail.from.name').')'],
            ['Админы в БД', $adminUsers === null ? '— (нет доступа к БД)' : ($adminUsers === [] ? '—' : implode(', ', $adminUsers))],
            ['Письма реально уйдут', implode(', ', $realRecipients)],
        ]);
    }

    /**
     * Записать ключ в .env: заменить строку или дописать в конец.
     *
     * @param string $key имя переменной
     * @param string $value значение
     * @return bool true когда файл обновлён
     */
    private function writeEnvValue(string $key, string $value): bool
    {
        $envPath = base_path('.env');

        if (! is_file($envPath) || ! is_writable($envPath)) {
            $this->error('.env не найден или недоступен для записи.');

            return false;
        }

        $content = (string) file_get_contents($envPath);
        $line = $key.'='.$this->escapeEnvValue($value);
        $pattern = '/^'.preg_quote($key, '/').'=.*$/m';

        if (preg_match($pattern, $content) === 1) {
            $content = (string) preg_replace($pattern, $line, $content);
        } else {
            $content = rtrim($content).PHP_EOL.$line.PHP_EOL;
        }

        if (file_put_contents($envPath, $content) === false) {
            $this->error('Не получилось записать .env.');

            return false;
        }

        return true;
    }

    /**
     * Экранировать значение для .env (кавычки при пробелах/#).
     *
     * @param string $value сырое значение
     * @return string значение для строки KEY=...
     */
    private function escapeEnvValue(string $value): string
    {
        if (preg_match('/[\s#"\']/', $value) === 1) {
            return '"'.str_replace('"', '\"', $value).'"';
        }

        return $value;
    }

    /**
     * Пересобрать кэш конфига, если он включён, иначе .env подхватится сам.
     *
     * @return void
     */
    private function refreshConfigCache(): void
    {
        if (! app()->configurationIsCached()) {
            $this->line('Кэш конфига выключен — новый .env подхватится сам.');

            return;
        }

        Artisan::call('config:cache');
        $this->line('Кэш конфига пересобран (config:cache).');
    }

    /**
     * Отправить тестовое письмо на новый адрес для проверки SMTP.
     *
     * @param string $email адрес для теста
     * @return void
     */
    private function sendTest(string $email): void
    {
        try {
            Mail::to($email)->send(new SupportRequestMail(
                'Тестовое письмо сервиса',
                'Проверка почты сервиса из консоли. Если видишь это письмо — SMTP настроен и обращения из поддержки дойдут.',
                'Консоль',
                (string) config('mail.from.address'),
            ));
            $this->info("✓ Тестовое письмо отправлено на {$email} — проверь ящик.");
        } catch (\Throwable $e) {
            $this->error('Тестовое письмо не ушло: '.$e->getMessage());
            $this->line('Проверь MAIL_MAILER/MAIL_HOST/MAIL_PORT/MAIL_USERNAME/MAIL_PASSWORD в .env.');
        }
    }
}
