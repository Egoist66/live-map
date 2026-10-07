<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Выгрузка переписки в standalone-HTML.
 *
 * Один файл без внешних запросов: инлайн-CSS, системные шрифты,
 * спокойная «мессенджерная» вёрстка (белые входящие, зелёные свои,
 * плашки дней). Без градиентов и эмодзи-мусора — выглядит как
 * обычная сохранённая переписка, а не как генерация нейросети.
 */
class ChatExportService
{
    /**
     * Сколько последних сообщений попадает в файл (защита от гигантов).
     */
    public const MAX_MESSAGES = 3000;

    /**
     * Плоские цвета имён/аватарок по автору (без градиентов).
     *
     * @var string[]
     */
    private const NAME_COLORS = [
        '#d3392c',
        '#d97e06',
        '#5b8c00',
        '#0b8457',
        '#0b7b8b',
        '#1668dc',
        '#5926d6',
        '#a1218f',
    ];

    /**
     * Собрать полный HTML-документ переписки.
     *
     * @param Conversation $conversation диалог с загруженными participants
     * @param User $viewer кто выгружает (его сообщения — справа)
     * @param Collection $messages сообщения по возрастанию (sender, replyTo.sender)
     * @return string готовый HTML
     */
    public function buildHtml(Conversation $conversation, User $viewer, Collection $messages): string
    {
        $title = $this->chatTitle($conversation, $viewer);
        $names = $this->participantNames($conversation, $viewer);
        $count = $messages->count();

        $period = $this->periodLabel($messages);
        $exportedAt = now()->format('d.m.Y H:i');

        $body = $this->renderMessages($messages, $viewer);

        $safeTitle = e($title);
        $safeNames = e($names);
        $safePeriod = e($period);

        return <<<HTML
        <!DOCTYPE html>
        <html lang="ru">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Переписка — {$safeTitle}</title>
        <style>{$this->css()}</style>
        </head>
        <body>
        <div class="page">
        <header class="chat-header">
        <div class="chat-avatar" style="background:{$this->colorFor($title)}">{$this->letter($title)}</div>
        <div class="chat-info">
        <h1>{$safeTitle}</h1>
        <p>{$safeNames}</p>
        <p class="meta">{$count} сообщений · {$safePeriod} · сохранено {$exportedAt}</p>
        </div>
        </header>
        <main class="thread">
        {$body}
        </main>
        <footer class="page-footer">Сохранено из переписки · {$exportedAt}</footer>
        </div>
        </body>
        </html>
        HTML;
    }

    /**
     * Имя файла выгрузки.
     *
     * @param Conversation $conversation диалог
     * @return string вида chat-12-2026-11-09.html
     */
    public function filename(Conversation $conversation): string
    {
        return 'chat-'.$conversation->id.'-'.now()->format('Y-m-d').'.html';
    }

    /**
     * Последние диалоги пользователя для выбора в Telegram-боте.
     *
     * Лёгкий список без сообщений: id + подпись (район или собеседник).
     * Скрытые у себя диалоги не показываем.
     *
     * @param User $viewer владелец
     * @param int $limit сколько диалогов
     * @return array<int, array{id:int,label:string}>
     */
    public static function recentFor(User $viewer, int $limit = 10): array
    {
        $limit = max(1, min(20, $limit));

        $rows = Conversation::whereHas('participantRows', function ($q) use ($viewer) {
                $q->where('user_id', $viewer->id)->whereNull('hidden_at');
            })
            ->with(['participants:id,name', 'district:id,name'])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        $list = [];

        foreach ($rows as $conv) {
            $service = new self();

            $list[] = ['id' => (int) $conv->id, 'label' => $service->chatTitle($conv, $viewer)];
        }

        return $list;
    }

    /**
     * Заголовок чата: район, SOS по пину или имя собеседника.
     *
     * @param Conversation $conversation диалог
     * @param User $viewer смотрящий
     * @return string заголовок
     */
    private function chatTitle(Conversation $conversation, User $viewer): string
    {
        if ($conversation->type === 'district') {
            $districtName = $conversation->district?->name;
            if (is_string($districtName) && $districtName !== '') {
                return $districtName;
            }

            return 'Общий чат района';
        }

        $other = $conversation->participants->firstWhere('id', '!=', $viewer->id);

        if ($other && is_string($other->name) && $other->name !== '') {
            return $other->name;
        }

        return 'Переписка №'.$conversation->id;
    }

    /**
     * Список участников строкой.
     *
     * @param Conversation $conversation диалог
     * @param User $viewer смотрящий
     * @return string имена через запятую
     */
    private function participantNames(Conversation $conversation, User $viewer): string
    {
        $names = $conversation->participants
            ->map(fn ($p) => (string) ($p->name ?? ''))
            ->filter(fn ($name) => $name !== '')
            ->unique()
            ->values()
            ->all();

        if (empty($names)) {
            return $viewer->name ?? 'Вы';
        }

        return implode(', ', $names);
    }

    /**
     * Период переписки строкой.
     *
     * @param Collection $messages сообщения
     * @return string «09.11.2025 — 09.11.2026» или «—»
     */
    private function periodLabel(Collection $messages): string
    {
        $first = $messages->first();
        $last = $messages->last();

        if (! $first || ! $last) {
            return 'пусто';
        }

        $from = $first->created_at?->format('d.m.Y') ?? '—';
        $to = $last->created_at?->format('d.m.Y') ?? '—';

        if ($from === $to) {
            return $from;
        }

        return $from.' — '.$to;
    }

    /**
     * Отрендерить ленту сообщений с плашками дней.
     *
     * @param Collection $messages сообщения по возрастанию
     * @param User $viewer чьи сообщения считать своими
     * @return string HTML ленты
     */
    private function renderMessages(Collection $messages, User $viewer): string
    {
        if ($messages->isEmpty()) {
            return '<div class="empty">В этом периоде сообщений нет.</div>';
        }

        $html = '';
        $currentDay = null;

        foreach ($messages as $message) {
            $day = $message->created_at?->format('Y-m-d');

            if ($day !== $currentDay) {
                $currentDay = $day;
                $dayText = $this->dayLabel($message);
                $html .= '<div class="day"><span>'.$dayText.'</span></div>';
            }

            $html .= $this->renderMessage($message, $viewer);
        }

        return $html;
    }

    /**
     * Подпись плашки дня.
     *
     * @param mixed $message сообщение с created_at
     * @return string «9 ноября 2026»
     */
    private function dayLabel($message): string
    {
        try {
            $label = $message->created_at?->locale('ru')->isoFormat('D MMMM YYYY');
        } catch (\Throwable) {
            $label = null;
        }

        return e((string) ($label ?: $message->created_at?->format('d.m.Y') ?: ''));
    }

    /**
     * Одно сообщение: системное по центру, своё справа, чужое слева.
     *
     * @param mixed $message сообщение
     * @param User $viewer смотрящий
     * @return string HTML сообщения
     */
    private function renderMessage($message, User $viewer): string
    {
        $time = $message->created_at?->format('H:i') ?? '';

        if (($message->type ?? 'text') === 'system') {
            $text = e((string) ($message->body ?? ''));
            $text = $this->withLineBreaks($text);

            return '<div class="msg system"><span>'.$text.'</span></div>';
        }

        $isOwn = (int) ($message->sender_id ?? 0) === (int) $viewer->id;
        $senderName = (string) ($message->sender?->name ?? '');
        $kind = $isOwn ? 'out' : 'in';

        $nameHtml = '';

        if (! $isOwn && $senderName !== '') {
            $color = $this->colorFor($senderName);
            $nameHtml = '<div class="sender" style="color:'.$color.'">'.e($senderName).'</div>';
        }

        $replyHtml = $this->renderReply($message);
        $bodyHtml = $this->renderBody($message, $viewer);
        $editedHtml = $message->edited_at ? ' <span class="edited">изм.</span>' : '';

        return '<div class="msg '.$kind.'"><div class="bubble">'
            .$nameHtml.$replyHtml.$bodyHtml
            .'<span class="time">'.e($time).$editedHtml.'</span>'
            .'</div></div>';
    }

    /**
     * Цитата ответа на сообщение.
     *
     * @param mixed $message сообщение
     * @return string HTML цитаты или пусто
     */
    private function renderReply($message): string
    {
        $reply = $message->replyTo ?? null;

        if (! $reply) {
            return '';
        }

        $replyName = (string) ($reply->sender?->name ?? $reply->sender_name ?? '');
        $replyText = (string) ($reply->body ?? '');
        $excerpt = mb_substr($replyText, 0, 140);

        if ($excerpt === '') {
            return '';
        }

        return '<div class="reply"><b>'.e($replyName).'</b><span>'.e($excerpt).'</span></div>';
    }

    /**
     * Тело сообщения: текст, пересланный пост, вложение.
     *
     * @param mixed $message сообщение
     * @param User $viewer смотрящий (для видимости автора поста)
     * @return string HTML тела
     */
    private function renderBody($message, User $viewer): string
    {
        $parts = '';

        $shared = $this->renderSharedPost($message, $viewer);

        if ($shared !== '') {
            $parts .= $shared;
        }

        $body = trim((string) ($message->body ?? ''));

        if ($body !== '') {
            $parts .= '<div class="text">'.$this->withLineBreaks(e($body)).'</div>';
        }

        $attachment = $this->renderAttachment($message);

        if ($attachment !== '') {
            $parts .= $attachment;
        }

        if ($parts === '') {
            $parts = '<div class="text empty-text">Пустое сообщение</div>';
        }

        return $parts;
    }

    /**
     * Пересланный пост (UFlow/район) карточкой.
     *
     * Пост подтягиваем живым через sharedPostPayload: видны актуальный
     * текст и автор с учётом анонимности. Запросы — только для сообщений
     * с shared_post_type, таких в переписке единицы.
     *
     * @param mixed $message сообщение
     * @param User $viewer смотрящий
     * @return string HTML карточки или пусто
     */
    private function renderSharedPost($message, User $viewer): string
    {
        $type = (string) ($message->shared_post_type ?? '');

        if ($type === '') {
            return '';
        }

        try {
            $post = $message->sharedPostPayload($viewer);
        } catch (\Throwable) {
            $post = null;
        }

        if (! is_array($post)) {
            return '';
        }

        $title = trim((string) ($post['title'] ?? ''));
        $excerpt = trim((string) ($post['excerpt'] ?? ''));
        $author = trim((string) ($post['author_name'] ?? ''));

        if ($title === '' && $excerpt === '') {
            if (! empty($post['unavailable'])) {
                return '<div class="post"><div class="post-tag">Пересланный пост</div><div class="post-excerpt">Пост удалён или недоступен</div></div>';
            }

            return '';
        }

        $html = '<div class="post"><div class="post-tag">Пересланный пост</div>';

        if ($title !== '') {
            $html .= '<div class="post-title">'.e($title).'</div>';
        }

        if ($excerpt !== '') {
            $html .= '<div class="post-excerpt">'.e(mb_substr($excerpt, 0, 220)).'</div>';
        }

        if ($author !== '') {
            $html .= '<div class="post-author">'.e($author).'</div>';
        }

        return $html.'</div>';
    }

    /**
     * Вложение строкой: голосовое, картинка или файл.
     *
     * Сами файлы не встраиваем —offline-файл должен открываться
     * без сети, поэтому только название, тип и размер.
     *
     * @param mixed $message сообщение
     * @return string HTML вложения или пусто
     */
    private function renderAttachment($message): string
    {
        $kind = (string) ($message->attachment_kind ?? '');
        $name = trim((string) ($message->attachment_name ?? ''));

        if ($kind === '' && $name === '') {
            return '';
        }

        $label = $this->attachmentLabel($message, $kind, $name);
        $size = $this->formatBytes($message->attachment_size ?? null);

        $sizeHtml = $size !== '' ? '<span class="att-size">'.e($size).'</span>' : '';

        return '<div class="attachment"><span class="att-icon">'.$this->attachmentIcon($kind).'</span><span class="att-name">'.e($label).'</span>'.$sizeHtml.'</div>';
    }

    /**
     * Подпись вложения.
     *
     * @param mixed $message сообщение
     * @param string $kind тип вложения
     * @param string $name имя файла
     * @return string подпись
     */
    private function attachmentLabel($message, string $kind, string $name): string
    {
        if ($kind === 'voice') {
            $duration = (int) ($message->attachment_duration ?? 0);

            if ($duration > 0) {
                return 'Голосовое сообщение · '.$this->formatDuration($duration);
            }

            return 'Голосовое сообщение';
        }

        if ($name !== '') {
            return $name;
        }

        return match ($kind) {
            'image' => 'Фотография',
            'file' => 'Файл',
            default => 'Вложение',
        };
    }

    /**
     * Буква-иконка вместо эмодзи.
     *
     * @param string $kind тип вложения
     * @return string символ
     */
    private function attachmentIcon(string $kind): string
    {
        return match ($kind) {
            'voice' => '◉',
            'image' => '▣',
            default => '⎙',
        };
    }

    /**
     * Размер файла человекочитаемо.
     *
     * @param mixed $bytes байты
     * @return string «2,4 МБ» или пусто
     */
    private function formatBytes($bytes): string
    {
        $value = (int) ($bytes ?? 0);

        if ($value <= 0) {
            return '';
        }

        if ($value < 1024) {
            return $value.' Б';
        }

        $kb = $value / 1024;

        if ($kb < 1024) {
            return rtrim(rtrim(number_format($kb, 1, ',', ' '), '0'), ',').' КБ';
        }

        $mb = $kb / 1024;

        return rtrim(rtrim(number_format($mb, 1, ',', ' '), '0'), ',').' МБ';
    }

    /**
     * Длительность голосового мм:сс.
     *
     * @param int $seconds секунды
     * @return string «01:24»
     */
    private function formatDuration(int $seconds): string
    {
        $minutes = intdiv($seconds, 60);
        $rest = $seconds % 60;

        return sprintf('%02d:%02d', $minutes, $rest);
    }

    /**
     * Первая буква имени заглавной.
     *
     * @param string $name имя
     * @return string буква
     */
    private function letter(string $name): string
    {
        $trimmed = trim($name);

        if ($trimmed === '') {
            return '?';
        }

        return e(mb_strtoupper(mb_substr($trimmed, 0, 1)));
    }

    /**
     * Детерминированный плоский цвет по строке.
     *
     * @param string $key имя/заголовок
     * @return string hex-цвет
     */
    private function colorFor(string $key): string
    {
        $hash = crc32($key);
        $index = abs((int) $hash) % count(self::NAME_COLORS);

        return self::NAME_COLORS[$index];
    }

    /**
     * Переносы строк для текста (после e()).
     *
     * @param string $escaped уже экранированный текст
     * @return string с <br>
     */
    private function withLineBreaks(string $escaped): string
    {
        return str_replace("\n", '<br>', $escaped);
    }

    /**
     * Весь CSS документа: спокойная светлая тема, печать дружелюбна.
     *
     * @return string CSS
     */
    private function css(): string
    {
        return <<<'CSS'
        * { box-sizing: border-box; }
        body { margin: 0; background: #d8d2c7; color: #1c1c1e; font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 15px; line-height: 1.45; }
        .page { max-width: 760px; margin: 0 auto; background: #ece5dd; min-height: 100vh; }
        .chat-header { display: flex; gap: 14px; align-items: center; padding: 18px 20px; background: #f6f4ef; border-bottom: 1px solid #d9d2c4; position: sticky; top: 0; }
        .chat-avatar { width: 52px; height: 52px; border-radius: 50%; color: #fff; font-size: 22px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex: none; }
        .chat-info h1 { margin: 0; font-size: 19px; }
        .chat-info p { margin: 2px 0 0; color: #6b6b6b; font-size: 13px; }
        .chat-info .meta { color: #8a8a8a; font-size: 12px; }
        .thread { padding: 18px 16px 8px; }
        .day { text-align: center; margin: 14px 0; }
        .day span { display: inline-block; background: #fff; border: 1px solid #d9d2c4; border-radius: 12px; padding: 3px 14px; font-size: 12px; color: #6b6b6b; }
        .msg { display: flex; margin: 6px 0; }
        .msg.in { justify-content: flex-start; }
        .msg.out { justify-content: flex-end; }
        .msg.system { justify-content: center; }
        .msg.system span { background: #f6f4ef; border: 1px solid #d9d2c4; border-radius: 12px; padding: 4px 14px; font-size: 12px; color: #6b6b6b; max-width: 90%; text-align: center; }
        .bubble { max-width: 78%; padding: 8px 10px 6px; border-radius: 8px; box-shadow: 0 1px 1px rgba(0,0,0,.12); overflow-wrap: anywhere; }
        .msg.in .bubble { background: #fff; border-top-left-radius: 0; }
        .msg.out .bubble { background: #d9fdd3; border-top-right-radius: 0; }
        .sender { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
        .text { white-space: normal; }
        .empty-text { color: #8a8a8a; font-style: italic; }
        .time { display: block; text-align: right; font-size: 11px; color: #8a8a8a; margin-top: 3px; }
        .edited { font-style: italic; }
        .reply { border-left: 3px solid #b3b3b3; padding: 4px 8px; margin-bottom: 6px; background: rgba(0,0,0,.04); border-radius: 0 6px 6px 0; font-size: 13px; }
        .reply b { display: block; font-size: 12px; }
        .reply span { color: #555; }
        .post { border: 1px solid #d9d2c4; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; background: rgba(255,255,255,.6); }
        .post-tag { font-size: 11px; color: #8a8a8a; text-transform: uppercase; letter-spacing: .06em; }
        .post-title { font-weight: 700; margin-top: 2px; }
        .post-excerpt { font-size: 13px; color: #444; margin-top: 2px; }
        .post-author { font-size: 12px; color: #8a8a8a; margin-top: 4px; }
        .attachment { display: flex; gap: 8px; align-items: center; margin-top: 6px; background: rgba(0,0,0,.05); border-radius: 8px; padding: 7px 10px; font-size: 13px; }
        .att-icon { font-size: 16px; }
        .att-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .att-size { margin-left: auto; color: #8a8a8a; font-size: 12px; flex: none; }
        .empty { text-align: center; color: #8a8a8a; padding: 40px 0; }
        .page-footer { text-align: center; color: #8a8a8a; font-size: 12px; padding: 18px; }
        @media print { body { background: #fff; } .chat-header { position: static; } }
        CSS;
    }
}
