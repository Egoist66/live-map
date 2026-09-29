<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Полное удаление пользователя без следов.
 *
 * Строки чистятся через `cascadeOnDelete`, здесь добиваем всё,
 * что FK не покрывает:
 * - Sanctum-токены (морф, без FK);
 * - сессии, уведомления (морф), токены сброса пароля (по email);
 * - активность с `nullOnDelete` (логины, просмотры пинов) — удаляем,
 *   а не обнуляем, чтобы не оставалось осиротевших строк;
 * - пустые диалоги (0 участников после удаления);
 * - файлы на диске: аватар, галерея, пины, UFlow, районы,
 *   бизнес-медиа, вложения чатов, обои опустевших диалогов.
 *
 * Хуков `deleting` на моделях нет, Scout не используется,
 * поэтому файлы собираем ДО `$user->delete()` и трём после.
 */
class UserDeletionService
{
    /**
     * Удалить пользователя целиком: БД + файлы.
     *
     * @param User $user целевой пользователь
     * @return void
     */
    public function delete(User $user): void
    {
        $snapshot = $this->snapshot($user);

        $wallpapers = [];

        DB::transaction(function () use ($user, $snapshot, &$wallpapers) {
            $this->purgeAuthTraces($user);

            $this->purgeActivityTraces((int) $user->id);

            $this->purgeApiTokens($user);

            $user->delete();

            $wallpapers = $this->purgeEmptyConversations($snapshot['conversationIds']);
        });

        $allPaths = array_merge($snapshot['paths'], $wallpapers);

        $this->deleteFiles($allPaths);
    }

    /**
     * Снапшот до удаления: пути файлов + диалоги (потом строк уже нет).
     *
     * @param User $user целевой пользователь
     * @return array{paths: string[], conversationIds: int[]} файлы и диалоги
     */
    private function snapshot(User $user): array
    {
        $userId = (int) $user->id;

        $paths = [];

        $avatarPath = trim((string) ($user->avatar_path ?? ''));

        if ($avatarPath !== '') {
            $paths[] = $avatarPath;
        }

        $galleryPaths = $this->pluckColumn('profile_photos', 'user_id', $userId, 'path');
        $galleryThumbs = $this->pluckColumn('profile_photos', 'user_id', $userId, 'thumb_path');

        $pinPhotos = $this->pluckColumn('pins', 'user_id', $userId, 'photo_path');

        $flowImagePaths = $this->pluckColumn('flow_posts', 'user_id', $userId, 'image_path');

        $flowPostIds = $this->pluckIds('flow_posts', 'user_id', $userId);
        $flowMediaPaths = $this->pluckWhereIn('flow_post_media', 'post_id', $flowPostIds, 'path');

        $districtIds = $this->pluckIds('districts', 'user_id', $userId);
        $districtCovers = $this->pluckWhereIn('districts', 'id', $districtIds, 'cover_path');

        $districtPostImages = $this->pluckColumn('district_posts', 'user_id', $userId, 'image_path');
        $districtPostImagesInOwn = $this->pluckWhereIn('district_posts', 'district_id', $districtIds, 'image_path');

        $businessIds = $this->pluckIds('businesses', 'user_id', $userId);
        $businessLogos = $this->pluckWhereIn('businesses', 'id', $businessIds, 'logo_path');
        $businessCovers = $this->pluckWhereIn('businesses', 'id', $businessIds, 'cover_path');
        $businessPhotos = $this->pluckWhereIn('business_photos', 'business_id', $businessIds, 'path');

        $chatAttachments = $this->pluckColumn('messages', 'sender_id', $userId, 'attachment_path');

        $conversationIds = $this->pluckIds('conversation_participants', 'user_id', $userId);

        $merged = array_merge(
            $paths,
            $galleryPaths,
            $galleryThumbs,
            $pinPhotos,
            $flowImagePaths,
            $flowMediaPaths,
            $districtCovers,
            $districtPostImages,
            $districtPostImagesInOwn,
            $businessLogos,
            $businessCovers,
            $businessPhotos,
            $chatAttachments
        );

        $cleanPaths = $this->cleanPaths($merged);

        return [
            'paths' => $cleanPaths,
            'conversationIds' => $conversationIds,
        ];
    }

    /**
     * Вычистить auth-следы без FK: сессии, уведомления, сброс пароля.
     *
     * @param User $user целевой пользователь
     * @return void
     */
    private function purgeAuthTraces(User $user): void
    {
        $userId = (int) $user->id;

        $this->safeDelete('sessions', 'user_id', $userId);

        try {
            DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $userId)
                ->delete();
        } catch (\Throwable) {
            // Таблицы может не быть — идём дальше.
        }

        $email = trim((string) ($user->email ?? ''));

        if ($email !== '') {
            try {
                DB::table('password_reset_tokens')
                    ->where('email', $email)
                    ->delete();
            } catch (\Throwable) {
                // Таблицы может не быть — идём дальше.
            }
        }
    }

    /**
     * Удалить API-токены (таблицы может не быть — Sanctum-миграция не везде накачена).
     *
     * @param User $user целевой пользователь
     * @return void
     */
    private function purgeApiTokens(User $user): void
    {
        try {
            $user->tokens()->delete();
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Вычистить активность с nullOnDelete (иначе останутся NULL-строки).
     *
     * @param int $userId id удаляемого пользователя
     * @return void
     */
    private function purgeActivityTraces(int $userId): void
    {
        $this->safeDelete('login_attempts', 'user_id', $userId);

        $this->safeDelete('pin_views', 'user_id', $userId);
    }

    /**
     * Удалить диалоги, опустевшие после ухода пользователя.
     *
     * Диалоги с оставшимися участниками не трогаем (там чужие данные).
     *
     * @param int[] $conversationIds диалоги, где состоял пользователь
     * @return string[] пути обоев удалённых диалогов
     */
    private function purgeEmptyConversations(array $conversationIds): array
    {
        if ($conversationIds === []) {
            return [];
        }

        $emptyConversations = Conversation::whereIn('id', $conversationIds)
            ->whereDoesntHave('participantRows')
            ->get(['id', 'wallpaper_image_path']);

        $wallpapers = [];

        foreach ($emptyConversations as $conversation) {
            $wallpaper = trim((string) ($conversation->wallpaper_image_path ?? ''));

            if ($wallpaper !== '') {
                $wallpapers[] = $wallpaper;
            }
        }

        $emptyIds = $emptyConversations->map(fn ($row) => (int) $row->id)->all();

        if ($emptyIds !== []) {
            Conversation::whereIn('id', $emptyIds)->delete();
        }

        return $wallpapers;
    }

    /**
     * Удалить файлы через MediaDisk (best-effort, без отката транзакции).
     *
     * @param string[] $paths пути в сторедже
     * @return void
     */
    private function deleteFiles(array $paths): void
    {
        $uniquePaths = array_values(array_unique($this->cleanPaths($paths)));

        foreach ($uniquePaths as $path) {
            MediaDisk::delete($path);
        }
    }

    /**
     * Pluck строковой колонки по равенству (пустые отбрасываем позже).
     *
     * @param string $table таблица
     * @param string $whereColumn колонка условия
     * @param int $whereValue id пользователя
     * @param string $pluckColumn забираемая колонка
     * @return string[] сырые значения
     */
    private function pluckColumn(string $table, string $whereColumn, int $whereValue, string $pluckColumn): array
    {
        try {
            $values = DB::table($table)
                ->where($whereColumn, $whereValue)
                ->pluck($pluckColumn)
                ->map(fn ($value) => (string) ($value ?? ''))
                ->all();
        } catch (\Throwable) {
            return [];
        }

        return $values;
    }

    /**
     * Id строк пользователя в таблице.
     *
     * @param string $table таблица
     * @param string $whereColumn колонка владельца
     * @param int $whereValue id пользователя
     * @return int[] id строк
     */
    private function pluckIds(string $table, string $whereColumn, int $whereValue): array
    {
        try {
            $ids = DB::table($table)
                ->where($whereColumn, $whereValue)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
        } catch (\Throwable) {
            return [];
        }

        return $ids;
    }

    /**
     * Pluck строковой колонки по списку id.
     *
     * @param string $table таблица
     * @param string $whereColumn колонка условия
     * @param int[] $whereValues список id
     * @param string $pluckColumn забираемая колонка
     * @return string[] сырые значения
     */
    private function pluckWhereIn(string $table, string $whereColumn, array $whereValues, string $pluckColumn): array
    {
        if ($whereValues === []) {
            return [];
        }

        try {
            $values = DB::table($table)
                ->whereIn($whereColumn, $whereValues)
                ->pluck($pluckColumn)
                ->map(fn ($value) => (string) ($value ?? ''))
                ->all();
        } catch (\Throwable) {
            return [];
        }

        return $values;
    }

    /**
     * Убрать пустые пути и пробелы.
     *
     * @param string[] $paths сырые пути
     * @return string[] чистые пути
     */
    private function cleanPaths(array $paths): array
    {
        $clean = [];

        foreach ($paths as $path) {
            $trimmed = trim((string) $path);

            if ($trimmed !== '') {
                $clean[] = $trimmed;
            }
        }

        return array_values(array_unique($clean));
    }

    /**
     * Delete с игнором отсутствующей таблицы (разные драйверы/окружения).
     *
     * @param string $table таблица
     * @param string $column колонка пользователя
     * @param int $userId id пользователя
     * @return void
     */
    private function safeDelete(string $table, string $column, int $userId): void
    {
        try {
            DB::table($table)
                ->where($column, $userId)
                ->delete();
        } catch (\Throwable) {
            return;
        }
    }
}
