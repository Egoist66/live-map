<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AppModulesWelcomeNews;
use App\Services\TelegramInitDataValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Вход и привязка через Telegram Mini App (@U1ove_bot).
 *
 * Фронт присылает сырую строку `initData` из
 * `window.Telegram.WebApp.initData`. Подпись проверяем
 * через TelegramInitDataValidator (HMAC по токену бота).
 *
 * Сценарии:
 * - гость + валидный initData → ищем по telegram_id,
 *   нет — автосоздаём персона (если разрешено конфигом);
 * - залогиненный + initData → привязываем telegram_id к текущему юзеру.
 */
class TelegramAuthController extends Controller
{
    /**
     * @param TelegramInitDataValidator $validator проверка подписи initData
     */
    public function __construct(private readonly TelegramInitDataValidator $validator) {}

    /**
     * Войти или зарегистрироваться по Telegram initData.
     *
     * Ставит обычную web-сессию (Auth::login), дальше Inertia
     * работает как после стандартного логина.
     *
     * @param Request $request запрос с полем `initData`
     * @return JsonResponse {user, is_new} или 401 при плохой подписи
     */
    public function auth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'initData' => 'required|string|max:8192',
        ]);

        $initData = (string) $validated['initData'];

        if (! $this->validator->validate($initData)) {
            return response()->json(['message' => 'Неверная подпись Telegram. Откройте приложение через кнопку бота заново.'], 401);
        }

        $parsed = $this->validator->parsed();
        $tgUser = $parsed['user'] ?? [];
        $telegramId = (int) ($tgUser['id'] ?? 0);

        if ($telegramId <= 0) {
            return response()->json(['message' => 'Telegram не передал id пользователя.'], 422);
        }

        $currentUser = $request->user();

        if ($currentUser) {
            $this->linkToUser($currentUser, $tgUser, $telegramId);

            return response()->json([
                'user' => $currentUser->fresh(),
                'is_new' => false,
                'linked' => true,
            ]);
        }

        $existing = User::where('telegram_id', $telegramId)->first();

        if ($existing) {
            $this->refreshSnapshot($existing, $tgUser);
            Auth::login($existing, true);
            $request->session()->regenerate();
            \App\Services\LoginDeviceGuard::handleLogin($existing, $request, 'telegram');

            return response()->json([
                'user' => $existing->fresh(),
                'is_new' => false,
                'linked' => true,
            ]);
        }

        $autoRegister = (bool) config('telegram.auto_register', true);

        if (! $autoRegister) {
            return response()->json([
                'message' => 'Telegram не привязан. Войдите обычным способом и привяжите его в настройках.',
                'linked' => false,
            ], 404);
        }

        $user = $this->registerFromTelegram($tgUser, $telegramId);
        Auth::login($user, true);
        $request->session()->regenerate();
        \App\Services\LoginDeviceGuard::handleLogin($user, $request, 'telegram');

        return response()->json([
            'user' => $user->fresh(),
            'is_new' => true,
            'linked' => true,
        ], 201);
    }

    /**
     * Статус привязки для залогиненного пользователя.
     *
     * Отдаём и тумблеры TG-уведомлений + флаг can_notify, чтобы
     * настройки показывали честную подсказку («нажмите /start у бота»),
     * а не молчали, когда Bot API отвечает 403.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['linked' => false], 401);
        }

        return response()->json([
            'linked' => $user->telegram_id !== null,
            'telegram_id' => $user->telegram_id,
            'telegram_username' => $user->telegram_username,
            'telegram_photo_url' => $user->telegram_photo_url,
            'notify_messages' => (bool) ($user->telegram_notify_messages ?? true),
            'notify_likes' => (bool) ($user->telegram_notify_likes ?? true),
            'notify_matches' => (bool) ($user->telegram_notify_matches ?? true),
            'notify_comments' => (bool) ($user->telegram_notify_comments ?? true),
            'can_notify' => $user->telegram_id !== null && $user->telegram_blocked_at === null,
            'bot_username' => (string) config('telegram.bot_username', 'U1ove_bot'),
            'notify_enabled' => (bool) ($user->telegram_notify_enabled ?? true),
            'email_messages' => (bool) ($user->email_notify_messages ?? true),
            'email_likes' => (bool) ($user->email_notify_likes ?? true),
            'email_matches' => (bool) ($user->email_notify_matches ?? true),
            'email' => $user->email,
            'email_verified' => $user->hasVerifiedEmail(),
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'is_technical_email' => $user->hasTechnicalTelegramEmail(),
        ]);
    }

    /**
     * Указать основную почту из Mini App (панель опций бота).
     *
     * Технический `tg_{id}@telegram.local` — только логин, письма туда
     * не дойдут. Сохраняем реальную почту, сбрасываем подтверждение
     * и отправляем новую ссылку — без перехода по ней уведомления
     * на почту слаться не будут (см. DatingEmailNotifier::canNotify).
     *
     * @param Request $request запрос с полем `email`
     * @return JsonResponse свежий email-статус
     */
    public function updateEmail(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Не авторизован.'], 401);
        }

        $validated = $request->validate([
            'email' => 'required|email:rfc,dns|max:255',
        ]);

        $email = mb_strtolower(trim((string) $validated['email']));

        $taken = User::where('email', $email)
            ->where('id', '!=', $user->id)
            ->exists();

        if ($taken) {
            return response()->json(['message' => 'Эта почта уже занята другим аккаунтом.'], 422);
        }

        $fresh = $user->fresh() ?? $user;
        $oldEmail = mb_strtolower(trim((string) ($fresh->email ?? '')));

        if ($oldEmail === $email && ! $fresh->hasTechnicalTelegramEmail()) {
            return response()->json([
                'email' => $fresh->email,
                'email_verified' => $fresh->hasVerifiedEmail(),
                'email_verified_at' => $fresh->email_verified_at?->toISOString(),
                'is_technical_email' => $fresh->hasTechnicalTelegramEmail(),
            ]);
        }

        $fresh->forceFill([
            'email' => $email,
            'email_verified_at' => null,
        ])->save();

        try {
            $fresh->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('telegram email verification send failed', [
                'user_id' => $fresh->id,
                'error' => $e->getMessage(),
            ]);
        }

        $updated = $fresh->fresh() ?? $fresh;

        return response()->json([
            'email' => $updated->email,
            'email_verified' => $updated->hasVerifiedEmail(),
            'email_verified_at' => $updated->email_verified_at?->toISOString(),
            'is_technical_email' => $updated->hasTechnicalTelegramEmail(),
            'verification_sent' => true,
        ]);
    }

    /**
     * Сгенерировать код для переключения бота на этот аккаунт.
     *
     * Второй аккаунт (с сайта) генерирует 6 цифр здесь, затем владелец
     * присылает их боту (/switch или кнопка «Переключиться») — привязка
     * telegram_id переезжает сюда. Код одноразовый, живёт 10 минут.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse {code, expires_in}
     */
    public function switchCode(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Не авторизован.'], 401);
        }

        $code = \App\Services\TelegramAccountSwitch::makeCode($user);

        return response()->json([
            'code' => $code,
            'expires_in' => \App\Services\TelegramAccountSwitch::CODE_TTL_SECONDS,
        ]);
    }

    /**
     * Обновить тумблеры TG-уведомлений.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse свежие тумблеры
     */
    public function preferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Не авторизован.'], 401);
        }

        $validated = $request->validate([
            'notify_enabled' => 'sometimes|boolean',
            'notify_messages' => 'sometimes|boolean',
            'notify_likes' => 'sometimes|boolean',
            'notify_matches' => 'sometimes|boolean',
            'notify_comments' => 'sometimes|boolean',
            'email_messages' => 'sometimes|boolean',
            'email_likes' => 'sometimes|boolean',
            'email_matches' => 'sometimes|boolean',
        ]);

        $patch = [];

        if (array_key_exists('notify_enabled', $validated)) {
            $patch['telegram_notify_enabled'] = (bool) $validated['notify_enabled'];
        }

        foreach (['notify_messages', 'notify_likes', 'notify_matches', 'notify_comments'] as $key) {
            if (array_key_exists($key, $validated)) {
                $patch['telegram_'.$key] = (bool) $validated[$key];
            }
        }

        foreach (['email_messages', 'email_likes', 'email_matches'] as $key) {
            if (array_key_exists($key, $validated)) {
                $patch[$key] = (bool) $validated[$key];
            }
        }

        if ($patch !== []) {
            $user->forceFill($patch)->save();
        }

        $fresh = $user->fresh();

        return response()->json([
            'notify_enabled' => (bool) ($fresh->telegram_notify_enabled ?? true),
            'notify_messages' => (bool) ($fresh->telegram_notify_messages ?? true),
            'notify_likes' => (bool) ($fresh->telegram_notify_likes ?? true),
            'notify_matches' => (bool) ($fresh->telegram_notify_matches ?? true),
            'notify_comments' => (bool) ($fresh->telegram_notify_comments ?? true),
            'email_messages' => (bool) ($fresh->email_notify_messages ?? true),
            'email_likes' => (bool) ($fresh->email_notify_likes ?? true),
            'email_matches' => (bool) ($fresh->email_notify_matches ?? true),
        ]);
    }

    /**
     * Отвязать Telegram от текущего аккаунта.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function unlink(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Не авторизован.'], 401);
        }

        $user->forceFill([
            'telegram_id' => null,
            'telegram_username' => null,
            'telegram_photo_url' => null,
            'telegram_linked_at' => null,
        ])->save();

        return response()->json(['linked' => false]);
    }

    /**
     * Привязать telegram_id к уже залогиненному юзеру.
     *
     * Если этот telegram_id уже занят другим аккаунтом — 409,
     * молча отбирать чужую привязку нельзя.
     *
     * @param User $user текущий пользователь
     * @param array<string, mixed> $tgUser объект user из initData
     * @param int $telegramId id в Telegram
     * @return void
     */
    private function linkToUser(User $user, array $tgUser, int $telegramId): void
    {
        if ((int) $user->telegram_id === $telegramId) {
            $this->refreshSnapshot($user, $tgUser);

            return;
        }

        $taken = User::where('telegram_id', $telegramId)
            ->where('id', '!=', $user->id)
            ->exists();

        abort_if($taken, 409, 'Этот Telegram уже привязан к другому аккаунту.');

        $username = $this->cleanUsername((string) ($tgUser['username'] ?? ''));
        $photoUrl = $this->cleanPhotoUrl((string) ($tgUser['photo_url'] ?? ''));

        $user->forceFill([
            'telegram_id' => $telegramId,
            'telegram_username' => $username,
            'telegram_photo_url' => $photoUrl,
            'telegram_linked_at' => now(),
            'telegram_blocked_at' => null,
        ])->save();
    }

    /**
     * Освежить username/аватар из Telegram без смены привязки.
     *
     * @param User $user пользователь
     * @param array<string, mixed> $tgUser объект user из initData
     * @return void
     */
    private function refreshSnapshot(User $user, array $tgUser): void
    {
        $username = $this->cleanUsername((string) ($tgUser['username'] ?? ''));
        $photoUrl = $this->cleanPhotoUrl((string) ($tgUser['photo_url'] ?? ''));

        $patch = [
            'telegram_username' => $username !== '' ? $username : $user->telegram_username,
            'telegram_photo_url' => $photoUrl !== '' ? $photoUrl : $user->telegram_photo_url,
        ];

        if ($user->telegram_blocked_at !== null) {
            $patch['telegram_blocked_at'] = null;
        }

        $user->forceFill($patch)->saveQuietly();
    }

    /**
     * Создать персону из Telegram-профиля.
     *
     * Email генерим технический `tg_{id}@telegram.local` (уникальный,
     * почты у TG может не быть), пароль — случайный (вход только через TG).
     * Почту сразу помечаем подтверждённой: владелец TG-аккаунта доказан
     * подписью initData, гнать его за подтверждением письма — лишний friction.
     *
     * Модули: только `ulove`. Mini App запущен из @U1ove_bot (знакомства),
     * карта UPin и остальные разделы человек довключит сам через
     * Настройки → Приложение → «Разделы приложения».
     *
     * @param array<string, mixed> $tgUser объект user из initData
     * @param int $telegramId id в Telegram
     * @return User созданный пользователь
     */
    private function registerFromTelegram(array $tgUser, int $telegramId): User
    {
        $firstName = trim((string) ($tgUser['first_name'] ?? ''));
        $lastName = trim((string) ($tgUser['last_name'] ?? ''));
        $fullName = trim($firstName.' '.$lastName);

        if ($fullName === '') {
            $fullName = 'Гость TG';
        }

        $username = $this->cleanUsername((string) ($tgUser['username'] ?? ''));
        $photoUrl = $this->cleanPhotoUrl((string) ($tgUser['photo_url'] ?? ''));
        $email = 'tg_'.$telegramId.'@telegram.local';

        $user = User::create([
            'name' => mb_substr($fullName, 0, 255),
            'email' => $email,
            'password' => Hash::make(Str::random(40)),
            'gender' => 'other',
            'signup_goal' => 'chat',
            'default_mode' => 'ulove',
            'default_mode_set_at' => now(),
            'enabled_modules' => ['ulove'],
            'account_type' => 'person',
            'dating_enabled' => true,
            'telegram_id' => $telegramId,
            'telegram_username' => $username !== '' ? $username : null,
            'telegram_photo_url' => $photoUrl !== '' ? $photoUrl : null,
            'telegram_linked_at' => now(),
        ]);

        $user->forceFill(['email_verified_at' => now()])->saveQuietly();

        AppModulesWelcomeNews::ensureDelivered($user);

        return $user;
    }

    /**
     * Почистить username: без @, только допустимые символы.
     *
     * @param string $raw сырой username из initData
     * @return string
     */
    private function cleanUsername(string $raw): string
    {
        $clean = ltrim(trim($raw), '@');
        $clean = mb_substr($clean, 0, 64);

        if ($clean !== '' && ! preg_match('/^[A-Za-z0-9_]+$/', $clean)) {
            return '';
        }

        return $clean;
    }

    /**
     * Почистить photo_url: только https, режем длину.
     *
     * @param string $raw сырой photo_url из initData
     * @return string
     */
    private function cleanPhotoUrl(string $raw): string
    {
        $clean = trim($raw);

        if ($clean === '' || ! str_starts_with($clean, 'https://')) {
            return '';
        }

        return mb_substr($clean, 0, 512);
    }
}
