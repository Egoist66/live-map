<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AccountDeletionService;
use App\Services\DatingService;
use App\Services\ProfileVisibilityService;
use App\Services\TelegramAccountPanel;
use App\Services\TelegramAccountSwitch;
use App\Services\TelegramBotApi;
use App\Services\TelegramCardSender;
use App\Services\TelegramDeletionFlow;
use App\Services\TelegramEmailPanel;
use App\Services\TelegramFavoritesPanel;
use App\Services\TelegramInsights;
use App\Services\TelegramMenu;
use App\Services\TelegramNotifyPanel;
use App\Services\TelegramOnlinePanel;
use App\Services\TelegramPasswordService;
use App\Services\TelegramPlanPanel;
use App\Services\TelegramProfilePanel;
use App\Services\TelegramResetPanel;
use App\Services\TelegramSessionActions;
use App\Services\TelegramSessionsPanel;
use App\Services\TelegramSwipePanel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук Telegram-бота: мега-меню Mini App в чате.
 *
 * Команды (см. TelegramBotApi::setup):
 * - /start, /app, /help — вход и навигация;
 * - /profile, /hide, /show — видимость анкеты;
 * - /find — свайпы кнопками прямо в чате (лайк/пас по одной анкете);
 * - /likes, /matches, /messages, /stats — живые инсайты;
 * - /online — кто сейчас в ULove (онлайн) с лайками из списка;
 * - /favorites — избранное по тарифу + кому можно написать;
 * - /notes — заметки «Избранного»: сохранить текстом, найти и убрать;
 * - /reset — сброс просмотренных (Free — раз, PRO — безлимит);
 * - /switch — переключение на другой аккаунт по коду с сайта;
 * - /account — какой аккаунт привязан к боту;
 * - /plan — мой тарифный план и выбор тарифа (платные — после оплаты);
 * - /email — основная почта для уведомлений (технический tg-логин не подходит);
 * - /notify — тумблеры уведомлений;
 * - /sessions — панель сеансов (kill/ban);
 * - /password — новый пароль для входа с компьютера (показ один раз);
 * - /delete, /restore — отложенное удаление с приманкой (PRO-неделя + 14 дней grace).
 *
 * Колбэки короче 64 байт: sess*, prof_*, go_*, ntg_*, del_*, sw_*, plan_*, email_*.
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

        if ($rawText === '') {
            return;
        }

        $user = $this->findUser($fromId);

        if ($user === null) {
            $this->handleUnlinkedMessage($chatId, $fromId, $rawText);

            return;
        }

        $this->clearBlockedFlag($user);

        if (! str_starts_with($rawText, '/')) {
            $this->handlePlainText($user, $chatId, $fromId, $rawText);

            return;
        }

        $parts = explode(' ', $rawText, 2);
        $command = mb_strtolower($parts[0] ?? '');
        $command = explode('@', $command)[0];
        $argument = trim((string) ($parts[1] ?? ''));

        if (($command === '/switch' || $command === '/account') && $argument !== '') {
            $this->handleSwitchCode($user, $chatId, $fromId, $argument);

            return;
        }

        match ($command) {
            '/start' => $this->replyStart($user, $chatId),
            '/app' => $this->replyApp($user, $chatId),
            '/help' => $this->replyHelp($chatId),
            '/profile' => $this->replyProfile($user, $chatId),
            '/find' => $this->replyFind($user, $chatId),
            '/hide' => $this->replyHide($user, $chatId),
            '/show' => $this->replyShow($user, $chatId),
            '/likes' => $this->replyLikes($user, $chatId),
            '/matches' => $this->replyMatches($user, $chatId),
            '/messages' => $this->replyMessages($user, $chatId),
            '/stats' => $this->replyStats($user, $chatId),
            '/online' => $this->replyOnline($user, $chatId),
            '/favorites', '/fav' => $this->replyFav($user, $chatId),
            '/notes' => $this->replyNotes($user, $chatId, $argument),
            '/reset' => $this->replyReset($user, $chatId),
            '/switch' => $this->replyAccount($user, $chatId, true),
            '/account' => $this->replyAccount($user, $chatId),
            '/plan' => $this->replyPlan($user, $chatId),
            '/email' => $this->replyEmail($user, $chatId),
            '/notify' => $this->replyNotify($user, $chatId),
            '/sessions' => $this->replySessions($user, $chatId),
            '/password' => $this->replyPasswordAsk($user, $chatId),
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

        $from = $callback['from'] ?? null;
        $handled = $this->runPanelCallback($user, $data, $chatId, $messageId, $callbackId, is_array($from) ? $from : []);

        if ($handled) {
            return;
        }

        if (! $this->isSessionCallback($data)) {
            TelegramBotApi::answerCallback($callbackId, 'Неизвестное действие — жмите 📋 Команды');

            return;
        }

        $toast = $this->runAction($user, $data);
        $panel = TelegramSessionsPanel::build($user->fresh() ?? $user);

        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
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
     * @param array<string, mixed> $from объект from колбэка (имя для пересоздания TG-аккаунта)
     * @return bool true когда колбэк наш и обработан
     */
    private function runPanelCallback(User $user, string $data, int $chatId, int $messageId, string $callbackId, array $from = []): bool
    {
        $fresh = $user->fresh() ?? $user;

        if ($data === 'go_menu') {
            $menu = TelegramMenu::main($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $menu['text'], $menu['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Главное меню');

            return true;
        }

        if ($data === 'go_help') {
            $help = TelegramMenu::help();
            TelegramCardSender::redrawText($chatId, $messageId, $help['text'], $help['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Все команды бота');

            return true;
        }

        if ($data === 'go_sessions' || $data === 'sess') {
            $panel = TelegramSessionsPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
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

        if ($data === 'go_password') {
            $ask = TelegramPasswordService::ask($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $ask['text'], $ask['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Пароль для входа с ПК');

            return true;
        }

        if ($data === 'pwd_show') {
            $this->issuePassword($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'pwd_hide') {
            $done = TelegramPasswordService::hidden();
            TelegramCardSender::redrawText($chatId, $messageId, $done['text'], $done['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Пароль убран с экрана 🙈');

            return true;
        }

        if ($data === 'prof_hide') {
            $updated = ProfileVisibilityService::hide($fresh);
            $full = TelegramProfilePanel::full($updated);

            TelegramCardSender::redraw($chatId, $messageId, $full['photoUrl'], $full['text'], $full['keyboard']);
            TelegramBotApi::answerCallback($callbackId, '🙈 Анкета скрыта — вас никто не видит');

            return true;
        }

        if ($data === 'prof_show' || $data === 'prof_refresh') {
            $updated = ProfileVisibilityService::show($fresh);
            $full = TelegramProfilePanel::full($updated);

            TelegramCardSender::redraw($chatId, $messageId, $full['photoUrl'], $full['text'], $full['keyboard']);

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
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Настройки уведомлений');

            return true;
        }

        if ($data === 'go_profile') {
            $full = TelegramProfilePanel::full($fresh);

            TelegramCardSender::redraw($chatId, $messageId, $full['photoUrl'], $full['text'], $full['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Моя анкета');

            return true;
        }

        if ($data === 'go_email') {
            $panel = TelegramEmailPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Моя почта');

            return true;
        }

        if ($data === 'email_ask') {
            $this->rememberEmailWait((int) $fresh->telegram_id);
            $ask = TelegramEmailPanel::ask();
            TelegramCardSender::redrawText($chatId, $messageId, $ask['text'], $ask['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Жду почту следующим сообщением 📧');

            return true;
        }

        if ($data === 'go_plan') {
            $panel = TelegramPlanPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Мой тариф');

            return true;
        }

        if ($data === 'go_plan_list') {
            $panel = TelegramPlanPanel::list($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Выбор тарифа');

            return true;
        }

        if ($data === 'plan_free' || $data === 'plan_pro' || $data === 'plan_premium' || $data === 'plan_business') {
            $this->choosePlan($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'sw_find') {
            $this->editSwipeCard($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if (str_starts_with($data, 'sw_like:') || str_starts_with($data, 'sw_pass:')) {
            $this->handleSwipeAction($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if (str_starts_with($data, 'sw_view:')) {
            $this->showCandidate($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_online' || str_starts_with($data, 'on_page:')) {
            $page = $data === 'go_online' ? 1 : (int) substr($data, 8);
            $panel = TelegramOnlinePanel::build($fresh, $page);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Кто сейчас в ULove');

            return true;
        }

        if (str_starts_with($data, 'on_like:')) {
            $this->handleOnlineLike($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_fav' || str_starts_with($data, 'fav_page:')) {
            $page = $data === 'go_fav' ? 1 : (int) substr($data, 9);
            $panel = TelegramFavoritesPanel::build($fresh, $page);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Моё избранное');

            return true;
        }

        if (str_starts_with($data, 'fav_del:')) {
            $this->handleFavDelete($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_notes' || str_starts_with($data, 'notes_page:')) {
            $page = $data === 'go_notes' ? 1 : (int) substr($data, 11);
            $panel = \App\Services\TelegramNotesPanel::build($fresh, $page);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Мои заметки');

            return true;
        }

        if ($data === 'notes_add') {
            \App\Services\TelegramNotesPanel::rememberWait((int) $fresh->telegram_id);
            $ask = \App\Services\TelegramNotesPanel::ask();
            TelegramCardSender::redrawText($chatId, $messageId, $ask['text'], $ask['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Жду заметку следующим сообщением 📝');

            return true;
        }

        if (str_starts_with($data, 'notes_del:')) {
            $this->handleNoteDelete($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_reset') {
            $panel = TelegramResetPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Сброс просмотренных');

            return true;
        }

        if ($data === 'reset_do') {
            $this->doReset($fresh, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'go_account') {
            $panel = TelegramAccountPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Мой аккаунт');

            return true;
        }

        if ($data === 'acc_ask') {
            TelegramAccountSwitch::rememberWait((int) $fresh->telegram_id);
            $ask = TelegramAccountPanel::ask();
            TelegramCardSender::redrawText($chatId, $messageId, $ask['text'], $ask['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Жду код следующим сообщением 🔀');

            return true;
        }

        if ($data === 'acc_back') {
            $ask = TelegramAccountPanel::askBack($fresh, (int) ($fresh->telegram_id ?? 0));
            TelegramCardSender::redrawText($chatId, $messageId, $ask['text'], $ask['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Подтвердите возврат ↩️');

            return true;
        }

        if ($data === 'acc_back_yes') {
            $this->doBackToDefault($fresh, $from, $chatId, $messageId, $callbackId);

            return true;
        }

        if (str_starts_with($data, 'ntg_') || str_starts_with($data, 'nem_') || str_starts_with($data, 'ndm_')) {
            $this->toggleNotify($fresh, $data, $chatId, $messageId, $callbackId);

            return true;
        }

        if ($data === 'del_ask') {
            $bait = TelegramDeletionFlow::bait($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $bait['text'], $bait['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Подумайте ещё секунду 💔');

            return true;
        }

        if ($data === 'del_yes') {
            $updated = AccountDeletionService::request($fresh);
            $done = TelegramDeletionFlow::scheduled($updated);
            TelegramCardSender::redrawText($chatId, $messageId, $done['text'], $done['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Анкета скрыта, PRO включён 🎁');

            return true;
        }

        if ($data === 'del_cancel') {
            $updated = AccountDeletionService::cancel($fresh);
            $done = TelegramDeletionFlow::restored();
            TelegramCardSender::redrawText($chatId, $messageId, $done['text'], $done['keyboard']);
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
     * Кнопки входа: Mini App внутри Telegram и сайт во внешнем браузере.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyApp(User $user, int $chatId): void
    {
        TelegramBotApi::sendMessage($chatId, '🌐 Открывайте приложение как удобно — внутри Telegram или в браузере:', TelegramMenu::withNav([
            [TelegramMenu::openAppButton('🌐 Открыть Mini App')],
            [TelegramMenu::openBrowserButton('🌍 Открыть в браузере')],
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
        $full = TelegramProfilePanel::full($user);

        TelegramCardSender::sendCard($chatId, $full['photoUrl'], $full['text'], $full['keyboard']);
    }

    /**
     * Панель аккаунта новым сообщением (/account, /switch без кода).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @param bool $withAsk сразу ли ждать код (после /switch)
     * @return void
     */
    private function replyAccount(User $user, int $chatId, bool $withAsk = false): void
    {
        if ($withAsk) {
            TelegramAccountSwitch::rememberWait((int) (($user->fresh() ?? $user)->telegram_id ?? 0));
            $ask = TelegramAccountPanel::ask();
            TelegramBotApi::sendMessage($chatId, $ask['text'], $ask['keyboard']);

            return;
        }

        $panel = TelegramAccountPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Кто онлайн новым сообщением (/online).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyOnline(User $user, int $chatId): void
    {
        $panel = TelegramOnlinePanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Избранное новым сообщением (/favorites).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyFav(User $user, int $chatId): void
    {
        $panel = TelegramFavoritesPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Заметки новым сообщением (/notes).
     *
     * С аргументом (`/notes купить молоко`) — сразу сохраняем заметкой,
     * без — показываем список. Тела лежат в БД сжатыми и зашифрованными.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @param string $argument текст после команды
     * @return void
     */
    private function replyNotes(User $user, int $chatId, string $argument = ''): void
    {
        $text = trim($argument);

        if ($text !== '') {
            $this->saveNoteFromBot($user, $chatId, (int) (($user->fresh() ?? $user)->telegram_id ?? 0), $text);

            return;
        }

        $panel = \App\Services\TelegramNotesPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Сохранить текст из бота заметкой «Избранного».
     *
     * @param User $user владелец
     * @param int $chatId куда отвечать
     * @param int $telegramId telegram_id для снятия ожидания
     * @param string $text сырой текст
     * @return void
     */
    private function saveNoteFromBot(User $user, int $chatId, int $telegramId, string $text): void
    {
        $fresh = $user->fresh() ?? $user;
        $body = trim(mb_substr($text, 0, 10000));

        if ($body === '') {
            TelegramBotApi::sendMessage($chatId, 'Пустую заметку сохранять нечего — пришлите текст или ссылку 📝.');

            return;
        }

        try {
            $note = app(\App\Services\SavedNotesService::class)->create($fresh, $body);
        } catch (\Throwable) {
            TelegramBotApi::sendMessage($chatId, 'Не получилось сохранить 😕 Попробуйте позже.');

            return;
        }

        \App\Services\TelegramNotesPanel::forgetWait($telegramId);

        try {
            broadcast(new \App\Events\SavedNotesChanged((int) $fresh->id, 'created'))->toOthers();
        } catch (\Throwable) {
        }

        $preview = mb_strlen($body) > 120 ? mb_substr($body, 0, 120).'…' : $body;

        $panel = \App\Services\TelegramNotesPanel::build($fresh->fresh() ?? $fresh, 1);
        TelegramBotApi::sendMessage(
            $chatId,
            "✅ <b>Сохранено в «Избранное»</b>:\n".htmlspecialchars($preview, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')."\n\n".$panel['text'],
            $panel['keyboard']
        );
    }

    /**
     * Убрать заметку кнопкой в боте.
     *
     * @param User $user владелец
     * @param string $data callback_data notes_del:{id}
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function handleNoteDelete(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $noteId = (int) (explode(':', $data, 2)[1] ?? 0);

        if ($noteId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Уже убрано — обновите список');

            return;
        }

        $note = \App\Models\SavedNote::whereKey($noteId)->where('user_id', $fresh->id)->first();

        if ($note === null) {
            TelegramBotApi::answerCallback($callbackId, 'Заметка не найдена');
        } else {
            $note->delete();

            try {
                broadcast(new \App\Events\SavedNotesChanged((int) $fresh->id, 'deleted'))->toOthers();
            } catch (\Throwable) {
            }

            TelegramBotApi::answerCallback($callbackId, 'Заметка убрана 🗑');
        }

        $panel = \App\Services\TelegramNotesPanel::build($fresh->fresh() ?? $fresh, 1);
        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Сброс просмотренных новым сообщением (/reset).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyReset(User $user, int $chatId): void
    {
        $panel = TelegramResetPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Панель почты новым сообщением (/email).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyEmail(User $user, int $chatId): void
    {
        $panel = TelegramEmailPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Панель тарифа новым сообщением (/plan).
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyPlan(User $user, int $chatId): void
    {
        $panel = TelegramPlanPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Режим «Найти мэтч здесь» новым сообщением (/find).
     *
     * Сразу показываем первую анкету, чтобы не требовать лишний тап.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyFind(User $user, int $chatId): void
    {
        $fresh = $user->fresh() ?? $user;

        if (! $this->isAdultForBot($fresh)) {
            $gate = TelegramSwipePanel::ageGate();
            TelegramBotApi::sendMessage($chatId, $gate['text'], $gate['keyboard']);

            return;
        }

        $card = TelegramSwipePanel::nextCard($fresh);

        if ($card === null) {
            $empty = TelegramSwipePanel::empty();
            TelegramBotApi::sendMessage($chatId, $empty['text'], $empty['keyboard']);

            return;
        }

        $built = TelegramSwipePanel::card($card);

        TelegramCardSender::sendCard($chatId, $built['photoUrl'], $built['text'], $built['keyboard']);
    }

    /**
     * Обычный текст без слеша: ждём только почту после кнопки «Указать почту».
     *
     * Иначе молчим, чтобы не спамить на каждое сообщение.
     *
     * @param User $user владелец
     * @param int $chatId куда отвечать
     * @param int $telegramId from.id для ключа ожидания
     * @param string $text присланный текст
     * @return void
     */
    /**
     * Сообщение от непривязанного Telegram: пробуем код переключения.
     *
     * Иначе — подсказка привязать через Mini App.
     *
     * @param int $chatId куда отвечать
     * @param int $telegramId from.id апдейта
     * @param string $text сырой текст
     * @return void
     */
    private function handleUnlinkedMessage(int $chatId, int $telegramId, string $text): void
    {
        $command = mb_strtolower(explode(' ', $text)[0] ?? '');
        $command = explode('@', $command)[0];

        if ($command === '/start' || $command === '/switch' || $command === '/account') {
            $argument = trim((string) (explode(' ', $text, 2)[1] ?? ''));

            if ($argument !== '') {
                $this->linkByCode($chatId, $telegramId, $argument);

                return;
            }
        }

        if (TelegramAccountSwitch::looksLikeCode($text)) {
            $this->linkByCode($chatId, $telegramId, $text);

            return;
        }

        $this->replyUnlinked($chatId, $command === '' ? '/start' : $command);
    }

    /**
     * Привязать непривязанный Telegram к аккаунту по коду с сайта.
     *
     * @param int $chatId куда отвечать
     * @param int $telegramId from.id апдейта
     * @param string $code 6 цифр
     * @return void
     */
    private function linkByCode(int $chatId, int $telegramId, string $code): void
    {
        try {
            $user = TelegramAccountSwitch::consumeCode($code, $telegramId);
        } catch (\RuntimeException $e) {
            TelegramBotApi::sendMessage($chatId, 'Не получилось привязать: '.$this->esc($e->getMessage()), TelegramMenu::withNav([
                [[TelegramMenu::openAppButton('🌐 Открыть приложение')]],
            ]));

            return;
        }

        $menu = TelegramMenu::main($user->fresh() ?? $user);

        TelegramBotApi::sendMessage($chatId, "✅ Готово — бот теперь работает с аккаунтом <b>".$this->esc((string) ($user->name ?? ''))."</b>.\n\n".$menu['text'], $menu['keyboard']);
    }

    private function handlePlainText(User $user, int $chatId, int $telegramId, string $text): void
    {
        $tgId = (int) $user->telegram_id ?: $telegramId;

        if ($this->isEmailWait($tgId)) {
            $this->saveEmailFromBot($user, $chatId, $text);

            return;
        }

        if (\App\Services\TelegramNotesPanel::isWait($tgId)) {
            $this->saveNoteFromBot($user, $chatId, $tgId, $text);

            return;
        }

        if (TelegramAccountSwitch::isWait($tgId) || TelegramAccountSwitch::looksLikeCode($text)) {
            $this->handleSwitchCode($user, $chatId, $tgId, $text);
        }
    }

    /**
     * Переключение аккаунта по коду из бота.
     *
     * @param User $user текущий привязанный пользователь
     * @param int $chatId куда отвечать
     * @param int $telegramId from.id апдейта
     * @param string $code 6 цифр
     * @return void
     */
    private function handleSwitchCode(User $user, int $chatId, int $telegramId, string $code): void
    {
        if (! TelegramAccountSwitch::looksLikeCode($code)) {
            TelegramBotApi::sendMessage($chatId, 'Жду ровно 6 цифр из кода с сайта — цифры генерируются в Настройки → Приложение → Telegram.', TelegramMenu::withNav([
                [['text' => '◀️ К аккаунту', 'callback_data' => 'go_account']],
            ]));

            return;
        }

        try {
            $switched = TelegramAccountSwitch::consumeCode($code, $telegramId);
        } catch (\RuntimeException $e) {
            TelegramBotApi::sendMessage($chatId, 'Не получилось переключиться: '.$this->esc($e->getMessage()), TelegramMenu::withNav([
                [['text' => '◀️ К аккаунту', 'callback_data' => 'go_account']],
            ]));

            return;
        }

        TelegramAccountSwitch::forgetWait($telegramId);

        $menu = TelegramMenu::main($switched->fresh() ?? $switched);

        TelegramBotApi::sendMessage($chatId, "✅ Переключил — теперь бот работает с аккаунтом <b>".$this->esc((string) ($switched->name ?? ''))."</b>.\n\n".$menu['text'], $menu['keyboard']);
    }

    /**
     * Вернуться из второго аккаунта в дефолтный Telegram-аккаунт.
     *
     * Перерисовывает панель главным меню нового аккаунта, при ошибке —
     * текст причины с кнопкой назад к панели аккаунта.
     *
     * @param User $user текущий (второй) пользователь
     * @param array<string, mixed> $from объект from колбэка
     * @param int $chatId что перерисовать
     * @param int $messageId что перерисовать
     * @param string $callbackId для тоста
     * @return void
     */
    private function doBackToDefault(User $user, array $from, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $telegramId = (int) ($fresh->telegram_id ?? 0);

        try {
            $result = TelegramAccountSwitch::backToDefault($telegramId, $from);
        } catch (\RuntimeException $e) {
            $panel = TelegramAccountPanel::build($fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, $e->getMessage(), true);

            return;
        }

        $backTo = $result['user'];
        $suffix = $result['created'] ? ' (аккаунт был удалён — создал заново)' : '';
        $menu = TelegramMenu::main($backTo);

        TelegramCardSender::redrawText(
            $chatId,
            $messageId,
            "↩️ Вернулся в ваш Telegram-аккаунт <b>".$this->esc((string) ($backTo->name ?? ''))."</b>{$suffix}.\n\n".$menu['text'],
            $menu['keyboard']
        );
        TelegramBotApi::answerCallback($callbackId, 'Вы снова в Telegram-аккаунте ↩️');
    }

    /**
     * Запомнить ожидание почты на 10 минут.
     *
     * @param int $telegramId telegram_id владельца
     * @return void
     */
    private function rememberEmailWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::put(TelegramSwipePanel::emailWaitKey($telegramId), true, 600);
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Ждём ли почту от этого telegram_id.
     *
     * @param int $telegramId telegram_id владельца
     * @return bool
     */
    private function isEmailWait(int $telegramId): bool
    {
        if ($telegramId <= 0) {
            return false;
        }

        try {
            return (bool) Cache::get(TelegramSwipePanel::emailWaitKey($telegramId), false);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Снять ожидание почты.
     *
     * @param int $telegramId telegram_id владельца
     * @return void
     */
    private function forgetEmailWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::forget(TelegramSwipePanel::emailWaitKey($telegramId));
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Сохранить почту, присланную в бот следующим сообщением.
     *
     * Валидируем как в Mini App, дубликаты отклоняем, после сохранения
     * отправляем ссылку подтверждения — без неё уведомления на почту
     * слаться не будут.
     *
     * @param User $user владелец
     * @param int $chatId куда отвечать
     * @param string $text присланный адрес
     * @return void
     */
    private function saveEmailFromBot(User $user, int $chatId, string $text): void
    {
        $fresh = $user->fresh() ?? $user;
        $telegramId = (int) ($fresh->telegram_id ?? 0);
        $candidate = mb_strtolower(trim($text));

        if (! filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            TelegramBotApi::sendMessage($chatId, 'Не похоже на почту 😕 Пришлите адрес вида name@example.com следующим сообщением.', TelegramMenu::withNav([
                [['text' => '◀️ К почте', 'callback_data' => 'go_email']],
            ]));

            return;
        }

        $taken = User::where('email', $candidate)
            ->where('id', '!=', $fresh->id)
            ->exists();

        if ($taken) {
            $this->forgetEmailWait($telegramId);
            TelegramBotApi::sendMessage($chatId, 'Эта почта уже занята другим аккаунтом. Укажите другую.', TelegramMenu::withNav([
                [['text' => '◀️ К почте', 'callback_data' => 'go_email']],
            ]));

            return;
        }

        $fresh->forceFill([
            'email' => $candidate,
            'email_verified_at' => null,
        ])->save();

        $this->forgetEmailWait($telegramId);

        try {
            $fresh->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            Log::warning('telegram bot email verification failed', ['error' => $e->getMessage()]);
        }

        $panel = TelegramEmailPanel::build($fresh->fresh() ?? $fresh);
        TelegramBotApi::sendMessage($chatId, "✅ Сохранил <code>".$this->esc($candidate)."</code> — письмо со ссылкой уже летит. Перейдите по ней, и уведомления начнут приходить корректно.\n\n".$panel['text'], $panel['keyboard']);
    }

    /**
     * Выбор тарифа кнопкой в боте.
     *
     * Free откатываем сразу, платные — только после оплаты,
     * поэтому показываем заглушку «Оплата в разработке».
     *
     * @param User $user владелец
     * @param string $data callback_data plan_*
     * @param int $chatId куда перерисовать
     * @param int $messageId что перерисовать
     * @param string $callbackId для тоста
     * @return void
     */
    private function choosePlan(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $plan = substr($data, 5);

        if ($plan === 'free') {
            $fresh->forceFill(['plan' => 'free', 'plan_expires_at' => null])->save();
            $panel = TelegramPlanPanel::build($fresh->fresh() ?? $fresh);
            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Вы на Free — бесплатно навсегда');

            return;
        }

        $panel = TelegramPlanPanel::list($fresh);
        $note = "\n\n".TelegramPlanPanel::PAYMENT_NOTE;
        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'].$note, $panel['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Сначала оплата — тариф после неё 💳');
    }

    /**
     * Показать следующую анкету в режиме свайпов (перерисовка панели).
     *
     * @param User $user зритель
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function editSwipeCard(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;

        if (! $this->isAdultForBot($fresh)) {
            $gate = TelegramSwipePanel::ageGate();
            TelegramCardSender::redrawText($chatId, $messageId, $gate['text'], $gate['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Свайпы — строго 18+');

            return;
        }

        $card = TelegramSwipePanel::nextCard($fresh);

        if ($card === null) {
            $empty = TelegramSwipePanel::empty();
            TelegramCardSender::redrawText($chatId, $messageId, $empty['text'], $empty['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Анкеты кончились');

            return;
        }

        $built = TelegramSwipePanel::card($card);

        TelegramCardSender::redraw($chatId, $messageId, $built['photoUrl'], $built['text'], $built['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Ваша следующая анкета 💘');
    }

    /**
     * Показать анкету целиком по кнопке «👤 Анкета целиком».
     *
     * @param User $user зритель
     * @param string $data callback_data sw_view:{id}
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function showCandidate(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $candidateId = (int) (explode(':', $data, 2)[1] ?? 0);

        $details = TelegramSwipePanel::detailsFor($fresh, $candidateId);

        if ($details === null) {
            TelegramBotApi::answerCallback($callbackId, 'Анкета недоступна — смотрим дальше');
            $this->editSwipeCard($fresh, $chatId, $messageId, $callbackId);

            return;
        }

        TelegramCardSender::redraw($chatId, $messageId, $details['photoUrl'], $details['text'], $details['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Анкета целиком 👤');
    }

    /**
     * Лайк из списка онлайна: пишем свайп и обновляем ту же страницу.
     *
     * @param User $user зритель
     * @param string $data callback_data on_like:{id}
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function handleOnlineLike(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $targetId = (int) (explode(':', $data, 2)[1] ?? 0);

        if ($targetId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Анкета потерялась — обновите список');

            return;
        }

        if (! $this->isAdultForBot($fresh)) {
            $gate = TelegramSwipePanel::ageGate();
            TelegramCardSender::redrawText($chatId, $messageId, $gate['text'], $gate['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Свайпы — строго 18+');

            return;
        }

        try {
            $result = app(DatingService::class)->recordAction($fresh, $targetId, 'like');
        } catch (\Throwable $e) {
            $message = $e instanceof \Illuminate\Http\Exceptions\HttpResponseException
                ? (string) ($e->getResponse()->getData(true)['message'] ?? 'Не получилось')
                : 'Не получилось — попробуйте дальше';

            TelegramBotApi::answerCallback($callbackId, mb_substr($message, 0, 200));

            return;
        }

        $page = self::onlinePageOf($messageId, $fresh);

        if (! empty($result['matched'])) {
            $panel = TelegramOnlinePanel::build($fresh->fresh() ?? $fresh, $page);
            TelegramCardSender::redrawText($chatId, $messageId, "🎉 <b>Это мэтч!</b> Чат уже открыт — пишите первым!\n\n".$panel['text'], $panel['keyboard']);
            TelegramBotApi::answerCallback($callbackId, '🎉 Мэтч! Чаты уже открыты');

            return;
        }

        $panel = TelegramOnlinePanel::build($fresh->fresh() ?? $fresh, $page);
        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Лайк отправлен 💞');
    }

    /**
     * Убрать из избранного кнопкой в боте.
     *
     * @param User $user владелец
     * @param string $data callback_data fav_del:{id}
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function handleFavDelete(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;
        $targetId = (int) (explode(':', $data, 2)[1] ?? 0);

        if ($targetId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Уже убрано — обновите список');

            return;
        }

        try {
            app(DatingService::class)->removeFavorite($fresh, $targetId);
        } catch (\Throwable) {
            TelegramBotApi::answerCallback($callbackId, 'Не получилось убрать');

            return;
        }

        $panel = TelegramFavoritesPanel::build($fresh->fresh() ?? $fresh, 1);
        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Убрано из избранного');
    }

    /**
     * Выполнить сброс просмотренных кнопкой в боте.
     *
     * @param User $user владелец
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function doReset(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;

        try {
            $deleted = app(DatingService::class)->resetHistory($fresh);
        } catch (\Throwable $e) {
            $message = $e instanceof \Illuminate\Http\Exceptions\HttpResponseException
                ? (string) ($e->getResponse()->getData(true)['message'] ?? 'Сброс недоступен')
                : 'Сброс недоступен';

            TelegramBotApi::answerCallback($callbackId, mb_substr($message, 0, 200));

            return;
        }

        TelegramSwipePanel::clearSeen((int) $fresh->id);

        $next = TelegramSwipePanel::nextCard($fresh->fresh() ?? $fresh);

        if ($next === null) {
            TelegramCardSender::redrawText($chatId, $messageId, "✅ История сброшена (оценок было: <b>{$deleted}</b>).\n\nНовых анкет пока нет — загляните позже.", TelegramMenu::withNav([
                [
                    ['text' => '💎 Мой тариф', 'callback_data' => 'go_plan'],
                ],
            ]));
            TelegramBotApi::answerCallback($callbackId, 'История сброшена ✅');

            return;
        }

        $built = TelegramSwipePanel::card($next);

        TelegramCardSender::redraw($chatId, $messageId, $built['photoUrl'], "✅ История сброшена (оценок было: <b>{$deleted}</b>). Лента свежая:\n\n".$built['text'], $built['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'История сброшена ✅');
    }

    /**
     * Номер страницы онлайна для возврата после лайка.
     *
     * Точный номер из callback_data уже ушёл, поэтому эвристика:
     * всегда первая страница свежего списка — честно и просто.
     *
     * @param int $messageId id панели (резерв под будущий кеш страниц)
     * @param User $user зритель
     * @return int
     */
    private static function onlinePageOf(int $messageId, User $user): int
    {
        return 1;
    }

    /**
     * Лайк/пас кнопкой в боте + сразу следующая анкета.
     *
     * @param User $user зритель
     * @param string $data callback_data sw_like:{id} | sw_pass:{id}
     * @param int $chatId куда
     * @param int $messageId что
     * @param string $callbackId тост
     * @return void
     */
    private function handleSwipeAction(User $user, string $data, int $chatId, int $messageId, string $callbackId): void
    {
        $fresh = $user->fresh() ?? $user;

        $parts = explode(':', $data, 2);
        $kind = $parts[0] ?? '';
        $targetId = (int) ($parts[1] ?? 0);

        if ($targetId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Анкета потерялась — жмите Дальше');

            return;
        }

        if (! $this->isAdultForBot($fresh)) {
            $gate = TelegramSwipePanel::ageGate();
            TelegramCardSender::redrawText($chatId, $messageId, $gate['text'], $gate['keyboard']);
            TelegramBotApi::answerCallback($callbackId, 'Свайпы — строго 18+');

            return;
        }

        $action = $kind === 'sw_like' ? 'like' : 'pass';

        try {
            $dating = app(DatingService::class);
            $result = $dating->recordAction($fresh, $targetId, $action);
        } catch (\Throwable $e) {
            $message = $e instanceof \Illuminate\Http\Exceptions\HttpResponseException
                ? (string) ($e->getResponse()->getData(true)['message'] ?? 'Не получилось')
                : 'Не получилось — попробуйте дальше';

            TelegramBotApi::answerCallback($callbackId, mb_substr($message, 0, 200));

            return;
        }

        if (! empty($result['matched'])) {
            $toast = '🎉 Мэтч! Чаты уже открыты — пишите первым!';
            $next = TelegramSwipePanel::nextCard($fresh->fresh() ?? $fresh);

            if ($next === null) {
                $text = "🎉 <b>Это мэтч!</b> Вы понравились друг другу — чат уже открыт.\n\nАнкеты пока кончились, загляните позже.";
                TelegramCardSender::redrawText($chatId, $messageId, $text, TelegramMenu::withNav([
                    [
                        ['text' => '🎉 Мои мэтчи', 'callback_data' => 'go_matches'],
                        TelegramMenu::openAppButton('🌐 Открыть чаты'),
                    ],
                ]));
                TelegramBotApi::answerCallback($callbackId, $toast);

                return;
            }

            $built = TelegramSwipePanel::card($next);
            $text = "🎉 <b>Это мэтч!</b> Вы понравились друг другу — чат уже открыт.\n\nСледующая анкета:\n\n".$built['text'];

            TelegramCardSender::redraw($chatId, $messageId, $built['photoUrl'], $text, $built['keyboard']);
            TelegramBotApi::answerCallback($callbackId, $toast);

            return;
        }

        $next = TelegramSwipePanel::nextCard($fresh->fresh() ?? $fresh);

        if ($next === null) {
            $empty = TelegramSwipePanel::empty();
            TelegramCardSender::redrawText($chatId, $messageId, $empty['text'], $empty['keyboard']);
            TelegramBotApi::answerCallback($callbackId, $action === 'like' ? 'Лайк отправлен 💞' : 'Пас — смотрим дальше');

            return;
        }

        $built = TelegramSwipePanel::card($next);

        TelegramCardSender::redraw($chatId, $messageId, $built['photoUrl'], $built['text'], $built['keyboard']);
        TelegramBotApi::answerCallback($callbackId, $action === 'like' ? 'Лайк отправлен 💞' : 'Пас — смотрим дальше');
    }

    /**
     * Можно ли показывать свайпы в боте (строго 18+).
     *
     * @param User $user зритель
     * @return bool
     */
    private function isAdultForBot(User $user): bool
    {
        try {
            app(DatingService::class)->assertAdult($user);

            return true;
        } catch (\Throwable) {
            return false;
        }
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
     * Экран-подтверждение выдачи пароля новым сообщением (/password).
     *
     * Сам пароль здесь не генерируем — только по тапу «Показать»
     * (колбэк pwd_show), чтобы случайный ввод команды не сжигал текущий.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replyPasswordAsk(User $user, int $chatId): void
    {
        $ask = TelegramPasswordService::ask($user);

        TelegramBotApi::sendMessage($chatId, $ask['text'], $ask['keyboard']);
    }

    /**
     * Выпустить пароль по кнопке и прислать отдельным сообщением.
     *
     * Отправка — прямой вызов TelegramBotApi::sendMessage, а не очередь:
     * открытый текст не должен оседать в хранилище jobs. Панель
     * подтверждения правим в нейтральное состояние, чтобы повторный тап
     * не плодил пароли (второй упрётся в кулдаун из issue()).
     *
     * @param User $user владелец
     * @param int $chatId куда слать пароль
     * @param int $messageId панель подтверждения (переправить в «отправлено»)
     * @param string $callbackId для тоста
     * @return void
     */
    private function issuePassword(User $user, int $chatId, int $messageId, string $callbackId): void
    {
        $left = TelegramPasswordService::cooldownLeft($user);

        if ($left > 0) {
            $wait = $this->waitLabel($left);
            TelegramBotApi::answerCallback($callbackId, "Пауза {$wait} — пароль уже выдавался");

            return;
        }

        $result = TelegramPasswordService::issue($user);

        if (! ($result['ok'] ?? false)) {
            $wait = $this->waitLabel((int) ($result['retry_after'] ?? 0));
            TelegramBotApi::answerCallback($callbackId, "Пауза {$wait} — пароль уже выдавался");

            return;
        }

        $sent = TelegramBotApi::sendMessage($chatId, $result['text'], $result['keyboard']);

        if ($sent === null) {
            TelegramPasswordService::release($user);
            TelegramBotApi::answerCallback($callbackId, 'Не смог отправить — попробуйте ещё раз');

            return;
        }

        $ask = TelegramPasswordService::ask($user->fresh() ?? $user);
        $sentNote = "✅ Пароль отправлен следующим сообщением.\n\n".$ask['text'];
        TelegramCardSender::redrawText($chatId, $messageId, $sentNote, $ask['keyboard']);
        TelegramBotApi::answerCallback($callbackId, 'Пароль отправлен 🔑');
    }

    /**
     * Человеческая подпись ожидания кулдауна («5 мин», «40 сек»).
     *
     * @param int $seconds сколько ждать
     * @return string
     */
    private function waitLabel(int $seconds): string
    {
        if ($seconds <= 0) {
            return 'ещё чуть-чуть';
        }

        if ($seconds < 60) {
            return $seconds.' сек';
        }

        $minutes = (int) ceil($seconds / 60);

        return $minutes.' мин';
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

        TelegramCardSender::redrawText($chatId, $messageId, $text, TelegramMenu::withNav([
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

        TelegramCardSender::redrawText($chatId, $messageId, $text, TelegramMenu::withNav([
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

        TelegramCardSender::redrawText($chatId, $messageId, $text, $keyboard);
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

        TelegramCardSender::redrawText($chatId, $messageId, $text, $keyboard);
        TelegramBotApi::answerCallback($callbackId, 'Сообщения обновлены');
    }

    /**
     * Переключить тип уведомлений целиком и перерисовать панель.
     *
     * Панель показывает 4 уникальных типа (сообщения, лайки, мэтчи,
     * комментарии): тап включает/глушит тип везде — бот + дубль на почту,
     * где он есть. Старые кнопки (мастер ntg_all, почтовые nem_*, ndm_*)
     * из уже отправленных панелей продолжают работать ради совместимости.
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
        if (str_starts_with($data, 'ndm_')) {
            TelegramBotApi::answerCallback($callbackId, 'Отдельной лички больше нет — всё уже в боте');

            $panel = TelegramNotifyPanel::build($user->fresh() ?? $user);

            TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);

            return;
        }

        $columns = match ($data) {
            'ntg_msg' => ['telegram_notify_messages', 'email_notify_messages'],
            'ntg_like' => ['telegram_notify_likes', 'email_notify_likes'],
            'ntg_match' => ['telegram_notify_matches', 'email_notify_matches'],
            'ntg_cmt' => ['telegram_notify_comments'],
            'ntg_all' => ['telegram_notify_enabled'],
            'nem_msg' => ['email_notify_messages'],
            'nem_like' => ['email_notify_likes'],
            'nem_match' => ['email_notify_matches'],
            default => null,
        };

        if ($columns === null) {
            TelegramBotApi::answerCallback($callbackId, 'Неизвестный тумблер');

            return;
        }

        $first = $columns[0];
        $next = ! (bool) ($user->{$first} ?? true);

        $patch = [];

        foreach ($columns as $column) {
            $patch[$column] = $next;
        }

        $user->forceFill($patch)->save();

        $panel = TelegramNotifyPanel::build($user->fresh() ?? $user);

        TelegramCardSender::redrawText($chatId, $messageId, $panel['text'], $panel['keyboard']);

        $scope = match (true) {
            str_starts_with($data, 'nem_') => 'Почта',
            $data === 'ntg_all' => 'Личка',
            default => 'Уведомления',
        };

        $state = $next ? 'включены ✅' : 'выключены ❌';
        TelegramBotApi::answerCallback($callbackId, "{$scope}: {$state}");
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
