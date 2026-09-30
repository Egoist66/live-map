<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountDeletionService;
use App\Services\ProfileVisibilityService;
use App\Services\TelegramBotApi;
use App\Services\TelegramDeletionFlow;
use App\Services\TelegramInsights;
use App\Services\TelegramMenu;
use App\Services\TelegramNotifyPanel;
use App\Services\TelegramProfilePanel;
use App\Services\TelegramSessionActions;
use App\Services\TelegramSessionsPanel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук Telegram-бота: мега-меню Mini App в чате.
 *
 * Команды (см. TelegramBotApi::setup):
 * - /start, /app, /help — вход и навигация;
 * - /profile, /hide, /show — видимость анкеты;
 * - /likes, /matches, /messages, /stats — живые инсайты;
 * - /notify — тумблеры уведомлений;
 * - /sessions — панель сеансов (kill/ban);
 * - /delete, /restore — отложенное удаление с приманкой (PRO-неделя + 14 дней grace).
 *
 * Колбэки короче 64 байт: sess*, prof_*, go_*, ntg_*, del_*.
 * Навигация: go_menu — главное меню, go_help — список всех команд,
 * остальные go_* — разделы без нового сообщения (перерисовка).
 * После каждого действия панель перерисовываем через
 * editMessageText, итог показываем тостом answerCallbackQuery.
 * Каждый экран внизу несёт ряд [◀️ Меню, 📋 Команды], поэтому из
 * глубины всегда есть кнопка назад, а поле ввода с командами (/…)
 * не нужно вспоминать — оно дублируется кнопкой.
 */
class TelegramWebhookController extends Controller
{
    /**
     * Принять апдейт от Telegram.
     *
     * Всегда отвечаем 200, иначе Telegram будет долбить ретраями.
     * Ошибки — только в лог, наружу ничего не течёт.
     *
     * @param Request $request сырой апдейт Bot API
     * @return Response всегда 200 OK
     */
    public function __invoke(Request $request): Response
    {
        if (! $this->checkSecret($request)) {
            return response('forbidden', 403);
        }

        $update = $request->json()->all();

        if (! is_array($update)) {
            return response('ok', 200);
        }

        try {
            $this->dispatch($update);
        } catch (\Throwable $e) {
            Log::warning('telegram webhook failed', ['error' => $e->getMessage()]);
        }

        return response('ok', 200);
    }

    /**
     * Разобрать апдейт: сообщение или нажатие кнопки.
     *
     * @param array<string, mixed> $update апдейт Bot API
     * @return void
     */
    private function dispatch(array $update): void
    {
        $callback = $update['callback_query'] ?? null;

        if (is_array($callback)) {
            $this->handleCallback($callback);

            return;
        }

        $message = $update['message'] ?? null;

        if (is_array($message)) {
            $this->handleMessage($message);
        }
    }

    /**
     * Входящее сообщение: команды, остальное — подсказка.
     *
     * @param array<string, mixed> $message объект message Bot API
     * @return void
     */
    private function handleMessage(array $message): void
    {
        $chatId = (int) ($message['chat']['id'] ?? 0);
        $fromId = (int) ($message['from']['id'] ?? $chatId);

        if ($chatId <= 0) {
            return;
        }

        $rawText = trim((string) ($message['text'] ?? ''));
        $command = mb_strtolower(explode(' ', $rawText)[0] ?? '');
        $command = explode('@', $command)[0];

        if ($command === '') {
            return;
        }

        if ($command !== '/start' && ! str_starts_with($command, '/')) {
            return;
        }

        $user = $this->findUser($fromId);

        if ($user === null) {
            $this->replyUnlinked($chatId, $command);

            return;
        }

        $this->clearBlockedFlag($user);

        match ($command) {
            '/start' => $this->replyStart($user, $chatId),
            '/app' => $this->replyApp($user, $chatId),
            '/help' => $this->replyHelp($chatId),
            '/profile' => $this->replyProfile($user, $chatId),
            '/hide' => $this->replyHide($user, $chatId),
            '/show' => $this->replyShow($user, $chatId),
            '/likes' => $this->replyLikes($user, $chatId),
            '/matches' => $this->replyMatches($user, $chatId),
            '/messages' => $this->replyMessages($user, $chatId),
            '/stats' => $this->replyStats($user, $chatId),
            '/notify' => $this->replyNotify($user, $chatId),
            '/sessions' => $this->replySessions($user, $chatId),
            '/delete' => $this->replyDeleteBait($user, $chatId),
            '/restore' => $this->replyRestore($user, $chatId),
            default => $this->replyUnknown($chatId),
        };
    }

    /**
     * Нажатие inline-кнопки.
     *
     * @param array<string, mixed> $callback объект callback_query Bot API
     * @return void
     */
    private function handleCallback(array $callback): void
    {
        $callbackId = (string) ($callback['id'] ?? '');
        $data = trim((string) ($callback['data'] ?? ''));
        $fromId = (int) ($callback['from']['id'] ?? 0);

        $message = $callback['message'] ?? null;
        $chatId = is_array($message) ? (int) ($message['chat']['id'] ?? 0) : 0;
        $messageId = is_array($message) ? (int) ($message['message_id'] ?? 0) : 0;

        if ($data === '' || $fromId <= 0) {
            return;
        }

        $user = $this->findUser($fromId);

        if ($user === null) {
            TelegramBotApi::answerCallback($callbackId, 'Сначала откройте Mini App и привяжите Telegram', true);

            return;
        }

        if ($chatId <= 0 || $messageId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Не вижу панель — нажмите /start заново');

            return;
        }

        $this->clearBlockedFlag($user);

        $handled = $this->runPanelCallback($user, $data, $chatId, $messageId, $callbackId);

        if ($handled) {
            return;
        }

        if (! $this->isSessionCallback($data)) {
            TelegramBotApi::answerCallback($callbackId, 'Неизвестное действие — жмите 📋 Команды');

            return;
        }

        $toast = $this->runAction($user, $data);
        $panel = TelegramSessionsPanel::build($user->fresh() ?? $user);

        TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
        TelegramBotApi::answerCallback($callbackId, $toast);
    }

    /**
     * Колбэки панелей бота (профиль, уведомления, удаление, инсайты).
     *
     * @param User $user владелец
     * @param string $data callback_data
     * @param int $chatId куда перерисовать
     * @param int $messageId что перерисовать
     * @param string $callbackId для тоста
     * @return bool true когда колбэк наш и обработан
     */
    private function runPanelCallback(User $user, string $data, int $chatId, int $messageId, string $callbackId): bool
    {
        $fresh = $user->fresh() ?? $user;

        if ($data === 'go_menu') {
            $menu = TelegramMenu::main($fresh);
            TelegramBotApi::editPanel($chatId, $messageId, $menu['text'], $menu['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Главное меню');

            return true;
        }

        if ($data === 'go_help') {
            $help = TelegramMenu::help();
            TelegramBotApi::editPanel($chatId, $messageId, $help['text'], $help['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Все команды бота');

            return true;
        }

        if ($data === 'go_sessions' || $data === 'sess') {
            $panel = TelegramSessionsPanel::build($fresh);
            TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Активные сеансы');

            return true;
        }

        if ($data === 'go_stats') {
            $this->editStats($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_messages') {
            $this->editMessages($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'prof_hide') {
            $updated = ProfileVisibilityService::hide($fresh);
            $panel = TelegramProfilePanel::build($updated);
            TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, '🙈 Анкета скрыта — вас никто не видит');

            return true;
        }

        if ($data === 'prof_show' || $data === 'prof_refresh') {
            $updated = ProfileVisibilityService::show($fresh);
            $panel = TelegramProfilePanel::build($updated);
            TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);

            $toast = $data === 'prof_show' ? '👀 Анкета снова видна' : 'Список обновлён';
            TelegramBotApi::answerCallback($callbackId, $toast);

            return true;
        }

        if ($data === 'go_likes') {
            $this->editLikes($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_matches') {
            $this->editMatches($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_notify') {
            $panel = TelegramNotifyPanel::build($fresh);
            TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Настройки уведомлений');

            return true;
        }

        if ($data === 'go_profile') {
            $panel = TelegramProfilePanel::build($fresh);
            TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Моя анкета');

            return true;
        }

        if ($data === 'ntg_msg' || $data === 'ntg_like' || $data === 'ntg_match' || $data === 'ntg_cmt') {
            $this->toggleNotify($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'del_ask') {
            $bait = TelegramDeletionFlow::bait($fresh);
            TelegramBotApi::editPanel($chatId, $messageId, $bait['text'], $bait['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Подумайте ещё секунду 💔');

            return true;
        }

        if ($data === 'del_yes') {
            $updated = AccountDeletionService::request($fresh);
            $done = TelegramDeletionFlow::scheduled($updated);
            TelegramBotApi::editPanel($chatId, $messageId, $done['text'], $done['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Анкета скрыта, PRO включён 🎁');

            return true;
        }

        if ($data === 'del_cancel') {
            $updated = AccountDeletionService::cancel($fresh);
            $done = TelegramDeletionFlow::restored();
            TelegramBotApi::editPanel($chatId, $messageId, $done['text'], $done['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Ура! Вы остались 💚');

            return true;
        }

        return false;
    }

    /**
     * Выполнить действие колбэка сеансов, вернуть текст тоста.
     *
     * @param User $user владелец
     * @param string $data callback_data
     * @return string текст тоста
     */
    private function runAction(User $user, string $data): string
    {
        if ($data === 'sess') {
            return 'Список обновлён';
        }

        if ($data === 'skillall') {
            $result = TelegramSessionActions::terminateAll($user);

            return (string) ($result['message'] ?? 'Готово');
        }

        $parts = explode(':', $data, 2);
        $action = $parts[0] ?? '';
        $argument = $parts[1] ?? '';

        if ($action === 'xkill') {
            $result = TelegramSessionActions::killOrphan($user, $argument);

            return (string) ($result['message'] ?? 'Готово');
        }

        $deviceId = (int) $argument;

        if ($deviceId <= 0) {
            return 'Неверная кнопка — обновите список';
        }

        $result = match ($action) {
            'skill' => TelegramSessionActions::terminate($user, $deviceId),
            'sban' => TelegramSessionActions::ban($user, $deviceId),
            'sunban' => TelegramSessionActions::unban($user, $deviceId),
            'strust' => TelegramSessionActions::trust($user, $deviceId),
            default => ['ok' => false, 'message' => 'Неизвестное действие'],
        };

        return (string) ($result['message'] ?? 'Готово');
    }

    /**
     * Это колбэк панели сеансов (а не навигации/профиля).
     *
     * Нужен в handleCallback: навигационные go_* обрабатывает
     * runPanelCallback, а сюда доходят только действия сеансов
     * (sess, skill, sban, sunban, strust, skillall и сироты xkill) —
     * всё остальное считаем неизвестным и панель сеансов поверх не рисуем.
     *
     * @param string $data callback_data
     * @return bool true когда действие относится к сеансам
     */
    private function isSessionCallback(string $data): bool
    {
        if ($data === 'sess' || $data === 'skillall') {
            return true;
        }

        $prefix = explode(':', $data, 2)[0] ?? '';

        return in_array($prefix, ['skill', 'sban', 'sunban', 'strust', 'xkill'], true);
    }

    /**
     * Приветствие /start: что умеет бот + главное меню.
     *
     * Текст и клавиатуру собирает TelegramMenu::main, здесь только
     * отправка новым сообщением (для перерисовки есть go_menu).
     *
     * @param User $user привязанный пользователь
     * @param int $chatId куда отвечать
     * @return void
     */
    private function replyStart(User $user, int $chatId): void
    {
        $menu = TelegramMenu::main($user);

        TelegramBotApi::sendMessage($chatId, $menu['text'], $menu['keyboard']);
    }

    /**
     * Кнопка входа в Mini App.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyApp(User $user, int $chatId): void
    {
        TelegramBotApi::sendMessage($chatId, '🌐 Открывайте приложение одной кнопкой:', TelegramMenu::withNav([
            [TelegramMenu::openAppButton('🌐 Открыть Mini App')],
        ]));
    }

    /**
     * Справка по всем возможностям.
     *
     * Текст единый с экраном go_help (TelegramMenu::help), здесь —
     * отправка новым сообщением для команды /help.
     *
     * @param int $chatId куда слать
     * @return void
     */
    private function replyHelp(int $chatId): void
    {
        $help = TelegramMenu::help();

        TelegramBotApi::sendMessage($chatId, $help['text'], $help['keyboard']);
    }

    /**
     * Карточка профиля новым сообщением.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyProfile(User $user, int $chatId): void
    {
        $panel = TelegramProfilePanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Скрыть анкету командой.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyHide(User $user, int $chatId): void
    {
        $fresh = $user->fresh() ?? $user;

        if ($fresh->isProfileHidden() || $fresh->isPendingDeletion()) {
            $panel = TelegramProfilePanel::build($fresh);
            TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);

            return;
        }

        $updated = ProfileVisibilityService::hide($fresh);
        $panel = TelegramProfilePanel::build($updated);

        TelegramBotApi::sendMessage($chatId, "🙈 Готово — вас никто не видит.\n\n".$panel['text'], $panel['keyboard']);
    }

    /**
     * Вернуть анкету командой.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyShow(User $user, int $chatId): void
    {
        $updated = ProfileVisibilityService::show($user->fresh() ?? $user);
        $panel = TelegramProfilePanel::build($updated);

        TelegramBotApi::sendMessage($chatId, "👀 Вы снова в поиске и ленте!\n\n".$panel['text'], $panel['keyboard']);
    }

    /**
     * Кто лайкнул анкету.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyLikes(User $user, int $chatId): void
    {
        $data = TelegramInsights::admirers($user);

        $total = (int) ($data['total'] ?? 0);
        $names = $data['names'] ?? [];

        if ($total === 0) {
            $text = "💞 Пока тихо — лайков ещё нет.\nЗаполните анкету и добавьте фото, и они прилетят. Я сразу напишу сюда!";
        } else {
            $text = "💞 Вашу анкету лайкнули: <b>{$total}</b>";

            if ($names !== []) {
                $escaped = array_map(fn (string $n): string => $this->esc($n), array_slice($names, 0, 3));
                $text .= "\nПоследние: ".implode(', ', $escaped);
            }

            $text .= "\n\nОткрывайте ленту и мэтчьтесь 👇";
        }

        TelegramBotApi::sendMessage($chatId, $text, TelegramMenu::withNav([
            [
                ['text' => '💞 Смотреть лайки', 'callback_data' => 'go_likes'],
                TelegramMenu::openAppButton('🌐 Открыть свайпы'),
            ],
        ]));
    }

    /**
     * Мои мэтчи.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyMatches(User $user, int $chatId): void
    {
        $data = TelegramInsights::matches($user);

        $total = (int) ($data['total'] ?? 0);
        $names = $data['names'] ?? [];

        if ($total === 0) {
            $text = "🎉 Мэтчей пока нет — но всё впереди!\nЛайкайте активнее, и я первым сообщу о взаимности.";
        } else {
            $text = "🎉 У вас мэтчей: <b>{$total}</b>";

            if ($names !== []) {
                $escaped = array_map(fn (string $n): string => $this->esc($n), array_slice($names, 0, 3));
                $text .= "\nПоследние: ".implode(', ', $escaped);
            }

            $text .= "\nЧаты уже открыты — пишите первым!";
        }

        TelegramBotApi::sendMessage($chatId, $text, TelegramMenu::withNav([
            [
                ['text' => '🎉 Мои мэтчи', 'callback_data' => 'go_matches'],
                TelegramMenu::openAppButton('🌐 Открыть чаты'),
            ],
        ]));
    }

    /**
     * Непрочитанные сообщения.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyMessages(User $user, int $chatId): void
    {
        $unread = TelegramInsights::unreadCount($user);

        if ($unread === 0) {
            $text = '💬 Всё прочитано — вы молодец! Новых сообщений нет.';
        } else {
            $text = "💬 У вас <b>{$unread}</b> непрочитанных. Загляните — там вас ждут!";
        }

        TelegramBotApi::sendMessage($chatId, $text, TelegramMenu::withNav([
            [TelegramMenu::openAppButton('🌐 Открыть чаты')],
        ]));
    }

    /**
     * Статистика аккаунта.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyStats(User $user, int $chatId): void
    {
        TelegramBotApi::sendMessage($chatId, TelegramInsights::statsText($user), TelegramMenu::withNav([
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                TelegramMenu::openAppButton('🌐 Приложение'),
            ],
        ]));
    }

    /**
     * Панель уведомлений.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyNotify(User $user, int $chatId): void
    {
        $panel = TelegramNotifyPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Ответить панелью сеансов новым сообщением.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replySessions(User $user, int $chatId): void
    {
        $panel = TelegramSessionsPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Приманка удаления: нам плохо без вас + неделя PRO.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyDeleteBait(User $user, int $chatId): void
    {
        $fresh = $user->fresh() ?? $user;

        if ($fresh->isPendingDeletion()) {
            $done = TelegramDeletionFlow::scheduled($fresh);
            TelegramBotApi::sendMessage($chatId, $done['text'], $done['keyboard']);

            return;
        }

        $bait = TelegramDeletionFlow::bait($fresh);

        TelegramBotApi::sendMessage($chatId, $bait['text'], $bait['keyboard']);
    }

    /**
     * Вернуть профиль из удаления (grace 14 дней).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyRestore(User $user, int $chatId): void
    {
        $fresh = $user->fresh() ?? $user;

        if (! $fresh->isPendingDeletion()) {
            TelegramBotApi::sendMessage($chatId, '💚 Удаление не запущено — ваш профиль в порядке. Так держать!', TelegramMenu::withNav([
                [
                    ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                ],
            ]));

            return;
        }

        AccountDeletionService::cancel($fresh);
        $done = TelegramDeletionFlow::restored();

        TelegramBotApi::sendMessage($chatId, $done['text'], $done['keyboard']);
    }

    /**
     * Неизвестная команда — мягко ведём в /help.
     *
     * @param int $chatId куда слать
     * @return void
     */
    private function replyUnknown(int $chatId): void
    {
        TelegramBotApi::sendMessage($chatId, 'Не понял команду 🤔 Жмите /help — там все мои суперспособности.', TelegramMenu::withNav([
            [
                ['text' => '📋 Все команды', 'callback_data' => 'go_help'],
            ],
        ]));
    }

    /**
     * Ответить непривязанному: сначала открыть Mini App.
     *
     * @param int $chatId куда слать
     * @param string $command какая команда пришла
     * @return void
     */
    private function replyUnlinked(int $chatId, string $command): void
    {
        $hint = $command === '/start'
            ? 'Чтобы я узнавал вас, откройте приложение через кнопку ниже хотя бы раз — Telegram привяжется автоматически.'
            : 'Чтобы пользоваться командами, сначала привяжите Telegram: откройте приложение через кнопку ниже — привязка произойдёт автоматически.';

        TelegramBotApi::sendMessage($chatId, $hint, [
            [TelegramMenu::openAppButton('🌐 Открыть приложение')],
        ]);
    }

    /**
     * Перерисовать панель лайков по колбэку.
     *
     * @param User $user владелец
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function editLikes(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $data = TelegramInsights::admirers($user);

        $total = (int) ($data['total'] ?? 0);
        $names = $data['names'] ?? [];

        if ($total === 0) {
            $text = "💞 Пока тихо — лайков ещё нет.\nЯ напишу сюда первым, как только прилетят!";
        } else {
            $text = "💞 Вашу анкету лайкнули: <b>{$total}</b>";

            if ($names !== []) {
                $escaped = array_map(fn (string $n): string => $this->esc($n), array_slice($names, 0, 3));
                $text .= "\nПоследние: ".implode(', ', $escaped);
            }
        }

        TelegramBotApi::editPanel($chatId, $messageId, $text, TelegramMenu::withNav([
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                TelegramMenu::openAppButton('🌐 Смотреть в приложении'),
            ],
        ]));

        TelegramBotApi::answerCallback($callbackId, 'Лайки обновлены');
    }

    /**
     * Перерисовать панель мэтчей по колбэку.
     *
     * @param User $user владелец
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function editMatches(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $data = TelegramInsights::matches($user);

        $total = (int) ($data['total'] ?? 0);
        $names = $data['names'] ?? [];

        if ($total === 0) {
            $text = '🎉 Мэтчей пока нет — лайкайте, и я сообщу первым!';
        } else {
            $text = "🎉 У вас мэтчей: <b>{$total}</b>";

            if ($names !== []) {
                $escaped = array_map(fn (string $n): string => $this->esc($n), array_slice($names, 0, 3));
                $text .= "\nПоследние: ".implode(', ', $escaped);
            }
        }

        TelegramBotApi::editPanel($chatId, $messageId, $text, TelegramMenu::withNav([
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                TelegramMenu::openAppButton('🌐 Открыть чаты'),
            ],
        ]));

        TelegramBotApi::answerCallback($callbackId, 'Мэтчи обновлены');
    }

    /**
     * Перерисовать статистику по колбэку go_stats.
     *
     * @param User $user владелец
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function editStats(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $text = TelegramInsights::statsText($user);

        $keyboard = TelegramMenu::withNav([
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                TelegramMenu::openAppButton('🌐 Приложение'),
            ],
        ]);

        TelegramBotApi::editPanel($chatId, $messageId, $text, $keyboard);
        TelegramBotApi::answerCallback($callbackId, 'Статистика обновлена');
    }

    /**
     * Перерисовать сообщения по колбэку go_messages.
     *
     * @param User $user владелец
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function editMessages(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $unread = TelegramInsights::unreadCount($user);

        if ($unread === 0) {
            $text = '💬 Всё прочитано — вы молодец! Новых сообщений нет.';
        } else {
            $text = "💬 У вас <b>{$unread}</b> непрочитанных. Загляните — там вас ждут!";
        }

        $keyboard = TelegramMenu::withNav([
            [TelegramMenu::openAppButton('🌐 Открыть чаты')],
        ]);

        TelegramBotApi::editPanel($chatId, $messageId, $text, $keyboard);
        TelegramBotApi::answerCallback($callbackId, 'Сообщения обновлены');
    }

    /**
     * Переключить тумблер уведомлений и перерисовать панель.
     *
     * @param User $user владелец
     * @param string $data какой тумблер
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function toggleNotify(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $column = match ($data) {
            'ntg_msg' => 'telegram_notify_messages',
            'ntg_like' => 'telegram_notify_likes',
            'ntg_match' => 'telegram_notify_matches',
            'ntg_cmt' => 'telegram_notify_comments',
            default => null,
        };

        if ($column === null) {
            TelegramBotApi::answerCallback($callbackId, 'Неизвестный тумблер');

            return;
        }

        $next = ! (bool) ($user->{$column} ?? true);

        $user->forceFill([$column => $next])->save();

        $panel = TelegramNotifyPanel::build($user->fresh() ?? $user);

        TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);

        $state = $next ? 'включены ✅' : 'выключены ❌';
        TelegramBotApi::answerCallback($callbackId, "Уведомления {$state}");
    }

    /**
     * Снять флаг 403-блока: пользователь явно пишет боту — значит живой.
     *
     * @param User $user владелец
     * @return void
     */
    private function clearBlockedFlag(User $user): void
    {
        if ($user->telegram_blocked_at === null) {
            return;
        }

        try {
            $user->forceFill(['telegram_blocked_at' => null])->saveQuietly();
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Найти пользователя по telegram_id из апдейта.
     *
     * @param int $telegramId from.id апдейта
     * @return User|null null когда привязки нет
     */
    private function findUser(int $telegramId): ?User
    {
        if ($telegramId <= 0) {
            return null;
        }

        return User::where('telegram_id', $telegramId)->first();
    }

    /**
     * Сверить секрет вебхука, если он задан в конфиге.
     *
     * @param Request $request входящий запрос
     * @return bool true когда можно обрабатывать
     */
    private function checkSecret(Request $request): bool
    {
        $expected = (string) config('telegram.webhook_secret', '');

        if ($expected === '') {
            return true;
        }

        $given = (string) $request->header('X-Telegram-Bot-Api-Secret-Token', '');

        if ($given === '' || ! hash_equals($expected, $given)) {
            Log::warning('telegram webhook bad secret');

            return false;
        }

        return true;
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
