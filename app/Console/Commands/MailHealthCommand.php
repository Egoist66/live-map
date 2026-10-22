<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Диагностика почты: какой драйвер, доступен ли, уходит ли тест.
 *
 * На Laravel Cloud исходящий SMTP (25/465/587) обычно заблокирован —
 * команда прямо говорит об этом и подсказывает перейти на API-драйвер
 * (resend через RESEND_API_KEY), а не крутить фаервол клиента.
 *
 * @example php artisan mail:health
 * @example php artisan mail:health --send=admin@example.com
 */
class MailHealthCommand extends Command
{
    /**
     * @var string сигнатура: опциональная отправка тестового письма
     */
    protected $signature = 'mail:health
        {--send= : Отправить тестовое письмо на адрес и показать результат}';

    /**
     * @var string описание команды
     */
    protected $description = 'Проверить почтовый драйвер (smtp/resend/log) и доступность отправки';

    /**
     * Проверить конфиг почты и при желании отправить тест.
     *
     * @return int self::SUCCESS | self::FAILURE
     */
    public function handle(): int
    {
        $mailer = (string) config('mail.default', 'log');
        $from = (string) config('mail.from.address');

        $this->table(['Ключ', 'Значение'], [
            ['MAIL_MAILER (эффект.)', $mailer],
            ['mail.from', $from],
            ['MAIL_HOST', (string) config('mail.mailers.smtp.host')],
            ['MAIL_PORT', (string) config('mail.mailers.smtp.port')],
            ['MAIL_USERNAME', (string) config('mail.mailers.smtp.username') ?: '—'],
            ['MAIL_ENCRYPTION/SCHEME', (string) (config('mail.mailers.smtp.scheme') ?? '') ?: '—'],
            ['RESEND_API_KEY', config('services.resend.key') ? 'задан (скрыт)' : '— пусто'],
            ['POSTMARK_API_KEY', config('services.postmark.key') ? 'задан (скрыт)' : '— пусто'],
            ['QUEUE_CONNECTION', (string) config('queue.default')],
        ]);

        if ($mailer === 'smtp') {
            $this->warn('Драйвер smtp: на Laravel Cloud / Docker-Паас исходящие порты 25/465/587 часто заблокированы.');
            $this->line('Проверка сокета до MAIL_HOST:MAIL_PORT (таймаут 5с)...');
            $reachable = $this->probeSmtp();
            if ($reachable) {
                $this->info('✓ TCP-соединение до SMTP-хоста установлено.');
            } else {
                $this->error('✗ SMTP-хост недоступен с этого хоста — письма будут падать с 500.');
                $this->line('Решение: composer require resend/resend-php, MAIL_MAILER=resend + RESEND_API_KEY (HTTP API, порты не нужны).');
            }
        }

        if ($mailer === 'resend' && ! config('services.resend.key')) {
            $this->error('✗ MAIL_MAILER=resend, но RESEND_API_KEY пуст — отправка упадёт.');
            $this->line('Задай RESEND_API_KEY в .env / секретах Laravel Cloud и перезапусти деплой.');

            return self::FAILURE;
        }

        if ($mailer === 'log' || $mailer === 'array') {
            $this->warn("Драйвер {$mailer}: письма никуда не уходят, только в лог/память. Для прода нужен resend/postmark/ses.");
        }

        if (! class_exists(\Resend\Client::class) && ! class_exists(\Resend::class) && $mailer === 'resend') {
            $this->error('✗ Пакет resend/resend-php не установлен: выполни composer require resend/resend-php');

            return self::FAILURE;
        }

        $sendTo = (string) ($this->option('send') ?? '');

        if ($sendTo === '') {
            return self::SUCCESS;
        }

        if (! filter_var($sendTo, FILTER_VALIDATE_EMAIL)) {
            $this->error("Некорректный email: {$sendTo}");

            return self::FAILURE;
        }

        try {
            Mail::raw('Проверка почты ULove: если видишь это письмо — драйвер настроен.', static function ($m) use ($sendTo): void {
                $m->to($sendTo)->subject('ULove mail:health — тест');
            });
        } catch (\Throwable $e) {
            $this->error('Тестовое письмо не ушло: '.get_class($e).': '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info("✓ Тестовое письмо отправлено на {$sendTo} — проверь ящик (и спам).");

        return self::SUCCESS;
    }

    /**
     * Проверить TCP-доступность SMTP-хоста без отправки письма.
     *
     * @return bool true когда сокет открылся за 5 секунд
     */
    private function probeSmtp(): bool
    {
        $host = (string) config('mail.mailers.smtp.host', '127.0.0.1');
        $port = (int) config('mail.mailers.smtp.port', 25);

        $errno = 0;
        $errstr = '';
        $fp = @stream_socket_client(
            "tcp://{$host}:{$port}",
            $errno,
            $errstr,
            5,
            STREAM_CLIENT_CONNECT
        );

        if (! is_resource($fp)) {
            return false;
        }

        fclose($fp);

        return true;
    }
}
