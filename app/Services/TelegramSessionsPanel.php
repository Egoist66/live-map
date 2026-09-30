<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Support\Facades\DB;

/**
 * Панель «Активные сеансы» прямо в Telegram (нативный UI бота).
 *
 * Почему панель в боте, а не кнопка в Mini App: web_app-кнопка
 * «Мои сеансы» вела на /settings/security#sessions, но Mini App
 * мог открыться не на том табе/без скролла — жалоба «клик не ведёт
 * в Безопасность». Теперь управление lives в самом чате с ботом:
 * список устройств + inline-кнопки «Завершить» / «В бан» под каждым.
 *
 * Формат callback_data (лимит Bot API — 64 байта):
 * - `sess` — показать/обновить список
 * - `skill:{deviceId}` — завершить сеанс устройства
 * - `sban:{deviceId}` — забанить устройство + завершить сеанс
 * - `sunban:{deviceId}` — разблокировать
 * - `strust:{deviceId}` — «это я» (доверенное)
 * - `skillall` — завершить все сеансы с живым session_id
 * - `xkill:{sessionId}` — завершить сиротскую web-сессию без устройства
 */
class TelegramSessionsPanel
{
    /**
     * Максимум устройств в одной панели (лимит кнопок Telegram).
     */
    public const LIMIT = 8;

    /**
     * Собрать текст и клавиатуру панели для пользователя.
     *
     * @param User $user владелец устройств
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $userId = (int) $user->id;

        $devices = UserDevice::where('user_id', $userId)
            ->orderByDesc('last_seen_at')
            ->limit(self::LIMIT)
            ->get();

        $aliveIds = self::aliveSessionIds($devices);

        $lines = ['📱 <b>Активные сеансы</b>'];
        $lines[] = 'Здесь — входы в ваш аккаунт. Чужой? Жмите «Завершить», спам-устройство — «В бан».';

        $keyboard = [];

        if ($devices->isEmpty()) {
            $lines[] = '';
            $lines[] = 'Устройств пока нет — войдите в Mini App хотя бы раз.';
        }

        foreach ($devices as $index => $device) {
            $number = $index + 1;
            $lines[] = '';
            $lines[] = self::deviceLine($number, $device, $aliveIds);

            $deviceButtons = self::deviceButtons($device, $aliveIds);

            foreach ($deviceButtons as $row) {
                $keyboard[] = $row;
            }
        }

        $orphans = self::orphanSessions($userId, $devices);

        if ($orphans !== []) {
            $lines[] = '';
            $lines[] = '🌐 <b>Сеансы без устройства:</b> '.count($orphans);

            foreach (array_slice($orphans, 0, 3) as $orphan) {
                $shortIp = trim((string) ($orphan->ip_address ?? ''));
                $label = $shortIp !== '' ? "IP <code>{$shortIp}</code>" : 'без IP';
                $lines[] = '• '.$label;

                $keyboard[] = [[
                    'text' => "❌ Закрыть {$label}",
                    'callback_data' => 'xkill:'.(string) $orphan->id,
                ]];
            }
        }

        $keyboard[] = [
            ['text' => '🔄 Обновить', 'callback_data' => 'sess'],
            self::openAppButton('🌐 Приложение'),
        ];

        if (count($aliveIds) > 0) {
            $keyboard[] = [
                ['text' => '❌ Завершить все сеансы', 'callback_data' => 'skillall'],
            ];
        }

        return [
            'text' => implode("\n", $lines),
            'keyboard' => $keyboard,
        ];
    }

    /**
     * Кнопка открытия Mini App (web_app требует https, иначе url).
     *
     * @param string $label подпись кнопки
     * @return array<string, mixed>
     */
    public static function openAppButton(string $label): array
    {
        $base = rtrim((string) config('app.url', ''), '/');
        $url = $base !== '' ? $base.'/?tgWebApp=1' : '';

        if ($url !== '' && str_starts_with($url, 'https://')) {
            return ['text' => $label, 'web_app' => ['url' => $url]];
        }

        if ($url !== '') {
            return ['text' => $label, 'url' => $url];
        }

        return ['text' => $label, 'callback_data' => 'sess'];
    }

    /**
     * Строка одного устройства: номер, статус, подпись, IP/гео, свежесть.
     *
     * @param int $number порядковый номер в панели
     * @param UserDevice $device устройство
     * @param array<int, string> $aliveIds живые session_id
     * @return string строка в HTML-разметке Telegram
     */
    private static function deviceLine(int $number, UserDevice $device, array $aliveIds): string
    {
        $esc = self::esc(...);

        $status = self::statusEmoji($device, $aliveIds);
        $label = $esc($device->label());

        $placeParts = array_filter([$device->city, $device->country]);
        $place = trim(implode(', ', $placeParts));

        $metaParts = [];

        if (trim((string) $device->ip) !== '') {
            $metaParts[] = 'IP <code>'.$esc((string) $device->ip).'</code>';
        }

        if ($place !== '') {
            $metaParts[] = $esc($place);
        }

        $seen = $device->last_seen_at?->diffForHumans() ?? 'давно';
        $metaParts[] = $esc($seen);

        $meta = implode(' · ', $metaParts);

        return "{$status} <b>{$number}. {$label}</b>\n{$meta}";
    }

    /**
     * Кнопки под устройством: завершить/бан или разбан + «это я».
     *
     * @param UserDevice $device устройство
     * @param array<int, string> $aliveIds живые session_id
     * @return array<int, array<int, array<int, array<string, mixed>>>>
     */
    private static function deviceButtons(UserDevice $device, array $aliveIds): array
    {
        $deviceId = (int) $device->id;
        $sessionId = (string) ($device->session_id ?? '');
        $hasSession = $sessionId !== '' && in_array($sessionId, $aliveIds, true);

        if ((bool) $device->blocked) {
            return [[[
                'text' => '✅ Разблокировать',
                'callback_data' => "sunban:{$deviceId}",
            ]]];
        }

        $row = [];

        if ($hasSession) {
            $row[] = [
                'text' => '❌ Завершить',
                'callback_data' => "skill:{$deviceId}",
            ];
        }

        $row[] = [
            'text' => '🚫 В бан',
            'callback_data' => "sban:{$deviceId}",
        ];

        $rows = [$row];

        if (! (bool) $device->trusted) {
            $rows[] = [[
                'text' => '👍 Это я',
                'callback_data' => "strust:{$deviceId}",
            ]];
        }

        return $rows;
    }

    /**
     * Статус-эмодзи устройства.
     *
     * @param UserDevice $device устройство
     * @param array<int, string> $aliveIds живые session_id
     * @return string
     */
    private static function statusEmoji(UserDevice $device, array $aliveIds): string
    {
        if ((bool) $device->blocked) {
            return '🚫';
        }

        $sessionId = (string) ($device->session_id ?? '');

        if ($sessionId !== '' && in_array($sessionId, $aliveIds, true)) {
            return '🟢';
        }

        return '⚪️';
    }

    /**
     * Живые session_id устройств (строки реально есть в sessions).
     *
     * @param \Illuminate\Support\Collection<int, UserDevice> $devices устройства
     * @return array<int, string>
     */
    private static function aliveSessionIds($devices): array
    {
        $ids = $devices
            ->map(fn (UserDevice $device): string => (string) ($device->session_id ?? ''))
            ->filter(fn (string $id): bool => $id !== '')
            ->values()
            ->all();

        if ($ids === []) {
            return [];
        }

        return DB::table('sessions')
            ->whereIn('id', $ids)
            ->pluck('id')
            ->map(fn ($id): string => (string) $id)
            ->all();
    }

    /**
     * Сиротские web-сессии без привязки к устройству.
     *
     * @param int $userId владелец
     * @param \Illuminate\Support\Collection<int, UserDevice> $devices известные устройства
     * @return array<int, object> строки sessions
     */
    private static function orphanSessions(int $userId, $devices): array
    {
        $known = $devices
            ->map(fn (UserDevice $device): string => (string) ($device->session_id ?? ''))
            ->filter(fn (string $id): bool => $id !== '')
            ->values()
            ->all();

        $query = DB::table('sessions')->where('user_id', $userId);

        if ($known !== []) {
            $query->whereNotIn('id', $known);
        }

        return $query
            ->orderByDesc('last_activity')
            ->limit(5)
            ->get()
            ->all();
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
