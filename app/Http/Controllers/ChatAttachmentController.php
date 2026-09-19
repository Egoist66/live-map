<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Services\ChatAttachment;
use Illuminate\Http\Request;

/**
 * Архив вложений пользователя: документы и фото из чатов.
 *
 * Голосовые сообщения в архив не попадают — только документы и фото.
 * Показывает только отправленные текущим пользователем файлы.
 * Срок хранения — ChatAttachment::RETENTION_DAYS дней, дальше чистит планировщик.
 */
class ChatAttachmentController extends Controller
{
    /** Максимум файлов в одном ZIP-архиве. */
    private const ZIP_MAX_FILES = 100;

    /** Максимум суммарного веса ZIP-архива: 200 МБ. */
    private const ZIP_MAX_BYTES = 200 * 1024 * 1024;

    /**
     * Запрос вложений архива: отправленные файлы юзера без голосовых.
     *
     * @param int $me id текущего пользователя
     */
    private function archiveQuery(int $me)
    {
        return Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->where(fn ($query) => $query
                ->where('attachment_kind', '!=', 'voice')
                ->orWhereNull('attachment_kind'));
    }

    /**
     * Список отправленных вложений с контекстом чата.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $me = $request->user()->id;
        $items = $this->archiveQuery($me)
            ->with(['conversation.participants' => fn ($q) => $q->select('users.id', 'users.name')])
            ->latest('id')
            ->paginate(30);
        $items->getCollection()->transform(fn ($m) => $this->serialize($m, $me));

        return response()->json($items);
    }

    /**
     * Скачивает вложение как файл: Content-Disposition attachment + UTF-8 для текста.
     *
     * Прямая ссылка /storage открывается браузером во вкладке, где .txt
     * с кириллицей может показаться абракадаброй из-за неверной кодировки.
     * Здесь отдаём файл скачиванием сразу с корректным именем.
     *
     * @param Request $request
     * @param Message $message сообщение с вложением
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function download(Request $request, Message $message)
    {
        abort_unless($message->sender_id === $request->user()->id || $request->user()->isAdmin(), 403);
        abort_if(! $message->attachment_path, 404, 'Вложение уже удалено');

        $disk = ChatAttachment::disk();
        $path = $message->attachment_path;

        abort_unless(\Illuminate\Support\Facades\Storage::disk($disk)->exists($path), 404, 'Файл не найден');

        $name = $message->attachment_name ?: basename($path);
        $headers = [];

        if (($message->attachment_mime ?: '') === 'text/plain') {
            $headers['Content-Type'] = 'text/plain; charset=UTF-8';
        }

        return \Illuminate\Support\Facades\Storage::disk($disk)->download($path, $name, $headers);
    }

    /**
     * Скачать весь архив одним ZIP: документы и фото без голосовых,
     * сжатие DEFLATE (максимум для ZIP). Временный файл удаляется
     * сразу после отправки — место на сервере не занимает.
     *
     * @param Request $request
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function downloadAll(Request $request)
    {
        $me = $request->user()->id;
        $disk = ChatAttachment::disk();
        $storage = \Illuminate\Support\Facades\Storage::disk($disk);

        $messages = $this->archiveQuery($me)->oldest('id')->limit(self::ZIP_MAX_FILES + 1)->get();

        abort_if($messages->isEmpty(), 422, 'Архив пуст — нечего упаковывать');
        abort_if($messages->count() > self::ZIP_MAX_FILES, 422, 'Файлов больше сотни — удалите старые, потом качайте');

        $entries = [];

        foreach ($messages as $message) {
            $path = $message->attachment_path;

            if (! $path || ! $storage->exists($path)) {
                continue;
            }

            $entries[] = $message;
        }

        abort_if(empty($entries), 404, 'Файлы уже удалены');

        $zipName = 'archive-'.now()->format('Y-m-d').'.zip';
        $zipPath = tempnam(sys_get_temp_dir(), 'archive-');

        $zip = new \ZipArchive();
        abort_if($zip->open($zipPath, \ZipArchive::OVERWRITE) !== true, 500, 'Не вышло упаковать архив');

        $usedNames = [];
        $tmpFiles = [];
        $total = 0;

        try {
            foreach ($entries as $message) {
                try {
                    $bytes = $storage->get($message->attachment_path);
                } catch (\Throwable) {
                    continue;
                }

                $total += strlen($bytes);
                abort_if($total > self::ZIP_MAX_BYTES, 422, 'Архив тяжелее 200 МБ — удалите старые файлы');

                $tmp = tempnam(sys_get_temp_dir(), 'archive-file-');
                file_put_contents($tmp, $bytes);
                $tmpFiles[] = $tmp;

                $entryName = $this->zipEntryName($message, $usedNames);
                $zip->addFile($tmp, $entryName);
                $zip->setCompressionName($entryName, \ZipArchive::CM_DEFLATE);
            }
        } catch (\Throwable $e) {
            $zip->close();

            foreach ($tmpFiles as $tmp) {
                @unlink($tmp);
            }

            @unlink($zipPath);

            throw $e;
        }

        $zip->close();

        foreach ($tmpFiles as $tmp) {
            @unlink($tmp);
        }

        if (empty($usedNames)) {
            @unlink($zipPath);
            abort(404, 'Файлы уже удалены');
        }

        return response()->download($zipPath, $zipName, ['Content-Type' => 'application/zip'])->deleteFileAfterSend(true);
    }

    /**
     * Безопасное уникальное имя файла внутри ZIP.
     *
     * @param Message $message сообщение с вложением
     * @param array<string> $usedNames уже занятые имена
     * @return string имя записи
     */
    private function zipEntryName(Message $message, array &$usedNames): string
    {
        $raw = $message->attachment_name ?: basename((string) $message->attachment_path);
        $clean = preg_replace('/[^\p{L}\p{N}._-]+/u', '_', (string) $raw);
        $clean = trim((string) $clean, '._');

        if ($clean === '') {
            $clean = 'file-'.$message->id;
        }

        $name = $clean;
        $counter = 1;

        while (isset($usedNames[$name])) {
            $counter++;
            $dot = strrpos($clean, '.');
            $name = $dot === false ? "{$clean}-{$counter}" : substr($clean, 0, $dot)."-{$counter}".substr($clean, $dot);
        }

        $usedNames[$name] = true;

        return $name;
    }

    /**
     * Удаляет одно вложение: файл с диска и поля в БД.
     *
     * @param Request $request
     * @param Message $message сообщение с вложением
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, Message $message)
    {
        abort_unless($message->sender_id === $request->user()->id || $request->user()->isAdmin(), 403);
        abort_if(! $message->attachment_path, 404, 'Вложение уже удалено');
        ChatAttachment::delete($message->attachment_path);
        $message->update([
            'attachment_path' => null,
            'attachment_name' => null,
            'attachment_mime' => null,
            'attachment_size' => null,
            'attachment_kind' => null,
            'attachment_duration' => null,
            'type' => 'text',
        ]);

        return response()->json(['ok' => true]);
    }

    /**
     * Удаляет все вложения пользователя из БД и с диска.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function clear(Request $request)
    {
        $me = $request->user()->id;
        $paths = Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->pluck('attachment_path');
        foreach ($paths as $path) {
            ChatAttachment::delete($path);
        }
        Message::where('sender_id', $me)
            ->whereNotNull('attachment_path')
            ->update([
                'attachment_path' => null,
                'attachment_name' => null,
                'attachment_mime' => null,
                'attachment_size' => null,
                'attachment_kind' => null,
                'attachment_duration' => null,
                'type' => 'text',
            ]);

        return response()->json(['ok' => true, 'deleted' => $paths->count()]);
    }

    /**
     * Сериализует вложение для списка архива.
     *
     * @param Message $message
     * @param int $me id текущего пользователя
     * @return array
     */
    private function serialize(Message $message, int $me): array
    {
        $other = $message->relationLoaded('conversation') && $message->conversation
            ? $message->conversation->participants->firstWhere('id', '!=', $me)
            : null;
        $created = $message->created_at;

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'chat_with' => $other ? ['id' => $other->id, 'name' => $other->name] : null,
            'attachment' => $message->attachmentPayload(),
            'download_url' => $message->attachment_path ? url('/api/chat/attachments/'.$message->id.'/download') : null,
            'created_at' => $created?->toISOString(),
            'expires_at' => $created
                ? $created->copy()->addDays(ChatAttachment::RETENTION_DAYS)->toISOString()
                : null,
        ];
    }
}
