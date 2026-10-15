<?php

namespace App\Http\Controllers;

use App\Mail\CooperationRequestMail;
use App\Models\User;
use App\Services\TurnstileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Заявки на сотрудничество с лендинга.
 *
 * Публичный эндпоинт (гость вводит email бизнеса в диалоге
 * «Писать нам»): название компании извлекается из email,
 * админы получают inbox-уведомление (тост + колокольчик + пуш)
 * и письмо на почту.
 */
class CooperationController extends Controller
{
    /**
     * Локальные части email, не несущие названия компании.
     *
     * Такие ящики (info@, sales@, ...) именуем по домену.
     *
     * @var string[]
     */
    private const GENERIC_LOCALS = [
        'info', 'support', 'hello', 'hi', 'sales', 'contact', 'contacts',
        'office', 'admin', 'administrator', 'mail', 'post', 'help',
        'team', 'business', 'partner', 'partners', 'cooperation',
        'marketing', 'pr', 'hr', 'job', 'jobs', 'career', 'careers',
        'feedback', 'noreply', 'no-reply', 'donotreply', 'robot',
        'service', 'services', 'order', 'orders', 'shop', 'store',
        'booking', 'welcome', 'general', 'main',
    ];

    /**
     * Хосты личной почты: название берём из локальной части,
     * а не из домена (иначе все были бы «Gmail»).
     *
     * @var string[]
     */
    private const FREEMAIL_HOSTS = [
        'gmail.com', 'googlemail.com', 'yandex.ru', 'yandex.by', 'yandex.com',
        'ya.ru', 'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru',
        'outlook.com', 'outlook.ru', 'hotmail.com', 'live.com', 'live.ru',
        'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com',
        'tut.by', 'onliner.by', 'rambler.ru',
    ];

    /**
     * Принять заявку на сотрудничество.
     *
     * @param Request $request email бизнеса + необязательное сообщение
     * @return JsonResponse ok + извлечённое название компании
     */
    public function store(Request $request): JsonResponse
    {
        $rawWebsite = $request->input('website');

        // Honeypot с фейковым 201: бот видит «успех» и не адаптируется,
        // админы не получают спам, письмо не уходит.
        if (TurnstileService::honeypotFilled($rawWebsite)) {
            Log::warning('bot blocked', [
                'reason' => 'honeypot',
                'ip' => $request->ip(),
                'path' => 'cooperation',
                'ua' => mb_substr((string) $request->userAgent(), 0, 256),
            ]);

            $email = mb_strtolower(trim((string) $request->input('email', 'bot@example.com')));
            $company = self::companyNameFromEmail($email);

            return response()->json(['ok' => true, 'company' => $company], 201);
        }

        $data = $request->validate([
            'email' => 'required|email:rfc|max:255',
            'message' => 'nullable|string|max:1000',
            'website' => 'nullable|string|max:255',
            'captcha_token' => ['required', new \App\Rules\ValidTurnstile($request)],
        ]);

        $email = mb_strtolower(trim($data['email']));
        $message = isset($data['message']) ? trim((string) $data['message']) : null;
        $message = $message !== '' ? $message : null;

        $company = self::companyNameFromEmail($email);

        static::notifyAdmins($email, $company, $message);

        return response()->json(['ok' => true, 'company' => $company], 201);
    }

    /**
     * Извлечь название компании из email отправителя.
     *
     * Правила: generic-ящик (info@, sales@, ...) или корпоративный
     * домен — именуем по домену (acme.by → «Acme»); личная почта
     * (gmail, yandex, ...) — по локальной части (ivan.petrov@ →
     * «Ivan Petrov»). Разделители [._-] становятся пробелами.
     *
     * @param string $email email отправителя
     * @return string название компании
     */
    public static function companyNameFromEmail(string $email): string
    {
        $email = mb_strtolower(trim($email));
        $parts = explode('@', $email);

        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return 'Компания';
        }

        [$local, $host] = $parts;

        $isGenericLocal = in_array($local, self::GENERIC_LOCALS, true);
        $isFreemail = in_array($host, self::FREEMAIL_HOSTS, true);

        if ($isFreemail || ! $isGenericLocal) {
            $name = self::prettify($local);

            if ($name !== '') {
                return $name;
            }
        }

        $labels = array_values(array_filter(explode('.', $host)));

        if ($labels === []) {
            return 'Компания';
        }

        return self::prettify($labels[0]) ?: 'Компания';
    }

    /**
     * Превратить slug в читаемое название.
     *
     * @param string $raw локальная часть или доменный лейбл
     * @return string «acme-corp» → «Acme Corp»
     */
    private static function prettify(string $raw): string
    {
        $words = preg_split('/[._\-+]+/u', $raw) ?: [];
        $words = array_values(array_filter(array_map(static fn ($w) => trim((string) $w), $words)));

        if ($words === []) {
            return '';
        }

        $titled = array_map(static function ($word): string {
            $lower = mb_strtolower($word);

            return mb_strtoupper(mb_substr($lower, 0, 1)).mb_substr($lower, 1);
        }, $words);

        return implode(' ', $titled);
    }

    /**
     * Адреса администраторов для писем (как в жалобах).
     *
     * @return string[]
     */
    private static function adminEmails(): array
    {
        $emails = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('email')->filter()->values()->all();
        $fallback = config('mail.admin_address') ?? config('seo.support_email') ?? config('mail.from.address');

        if ($fallback) {
            $emails[] = $fallback;
        }

        return array_values(array_unique($emails));
    }

    /**
     * Уведомить администраторов: inbox + письмо.
     *
     * @param string $email email бизнеса
     * @param string $company извлечённое название компании
     * @param string|null $message комментарий бизнеса
     * @return void
     */
    public static function notifyAdmins(string $email, string $company, ?string $message): void
    {
        $admins = User::where('is_admin', true)->orWhere('role', 'admin')->get();

        foreach ($admins as $admin) {
            \App\Services\UserNotifier::send($admin, new \App\Notifications\CooperationRequestNotification($email, $company, $message));
        }

        foreach (static::adminEmails() as $to) {
            try {
                Mail::to($to)->send(new CooperationRequestMail($email, $company, $message));
            } catch (\Throwable $e) {
                Log::warning('cooperation mail failed', ['email' => $email, 'to' => $to, 'error' => $e->getMessage()]);
            }
        }
    }
}
