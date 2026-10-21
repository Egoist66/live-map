<?php

namespace App\Http\Controllers;

use App\Events\GalleryChanged;
use App\Models\User;
use App\Services\ImageOptimizer;
use App\Services\PhotoModerationService;
use App\Services\ProfileFanout;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Загрузка и замена аватара пользователя.
 *
 * Пишет файл на диск из User::avatarDisk (S3 при настройке, иначе public),
 * старый файл удаляет только после успешной записи нового — путь в БД
 * никогда не затирается неудачной загрузкой.
 *
 * Аватар зеркалится в галерею главным фото: новая запись profile_photos
 * (порядок latest() — она первая и с бейджем «ГЛАВНОЕ»). Лимит тарифа
 * уважаем: при полной галерее аватар просто не дублируется.
 */
class AvatarController extends Controller
{
    public function store(Request $request)
    {
        $request->validate(['avatar' => 'required|image|max:10240']);

        PhotoModerationService::assertAllowed($request->file('avatar'));

        $user = $request->user();
        $disk = User::avatarDisk();
        $oldPath = $user->avatar_path;

        $path = ImageOptimizer::storeOptimized($request->file('avatar'), 'avatars', $disk, ['maxSide' => ImageOptimizer::AVATAR_MAX_SIDE]);
        if (!$path || !Storage::disk($disk)->exists($path)) {
            throw ValidationException::withMessages([
                'avatar' => 'Не удалось сохранить файл. Попробуй ещё раз.',
            ]);
        }

        $user->update(['avatar_path' => $path]);

        $this->mirrorAvatarToGallery($user->refresh(), $path, $disk, $oldPath);

        $this->broadcastAvatarChanged((int) $user->id);

        if ($oldPath && $oldPath !== $path && ! $user->profilePhotos()->where('path', $oldPath)->exists()) {
            Storage::disk($disk)->delete($oldPath);
            if ($disk !== 'public') {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back()->with('status', 'avatar-updated');
    }

    /**
     * Разнести смену аватара: своим устройствам (gallery.changed) и чужим
     * кешам (profile.updated) — иначе у собеседников остаётся старый URL.
     *
     * @param int $userId владелец аватара
     */
    private function broadcastAvatarChanged(int $userId): void
    {
        $version = now()->valueOf();

        try {
            broadcast(new GalleryChanged($userId, $version))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('reverb broadcast failed: '.$e->getMessage());
        }

        try {
            app(ProfileFanout::class)->notifyAvatarChanged($userId, $version, $version);
        } catch (\Throwable $e) {
            Log::warning('profile fanout failed: '.$e->getMessage());
        }
    }

    /**
     * Зеркалит аватар в галерею главным фото.
     *
     * Главное фото галереи всегда совпадает с avatar_path: ему выдаём
     * минимальный sort_order, фронт ставит его первым с бейджем «ГЛАВНОЕ».
     * Слот переиспользуем (обновляем фото старого аватара), чтобы смена
     * аватара не съедала лимит и работала даже при полной галерее.
     *
     * @param User $user владелец
     * @param string $path путь сохранённого аватара
     * @param string $disk диск файла
     * @param string|null $oldPath предыдущий avatar_path (его слот переиспользуем)
     * @return void
     */
    /**
     * Безопасный минимальный sort_order для главного фото.
     *
     * Колонка sort_order — unsigned: min - 1 при min <= 0 ронял MySQL
     * (Out of range value). Тогда перенумеровываем чужие фото
     * в 10, 20, 30… и возвращаем 0 для главного.
     *
     * @param User $user владелец галереи
     * @param int|null $mainId id главного фото (его пропускаем при перенумерации)
     * @return int sort_order для главного фото
     */
    private function safeFirstOrder(User $user, ?int $mainId = null): int
    {
        $minOrder = (int) ($user->profilePhotos()->min('sort_order') ?? 0);

        if ($minOrder > 0) {
            return $minOrder - 1;
        }

        $orderedIds = $user->profilePhotos()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $order = 10;

        foreach ($orderedIds as $orderedId) {
            if ($mainId !== null && (int) $orderedId === (int) $mainId) {
                continue;
            }

            \App\Models\ProfilePhoto::whereKey($orderedId)->update(['sort_order' => $order]);
            $order += 10;
        }

        return 0;
    }

    private function mirrorAvatarToGallery(User $user, string $path, string $disk, ?string $oldPath = null): void
    {
        try {
            $existing = $user->profilePhotos()->where('path', $path)->first();

            if ($existing) {
                $first = $this->safeFirstOrder($user, (int) $existing->id);
                $existing->forceFill(['sort_order' => $first])->save();
                return;
            }

            $makeThumb = static function () use ($path, $disk): ?string {
                try {
                    $thumbPath = ImageOptimizer::storeThumbnail($path, $disk);

                    return is_string($thumbPath) ? $thumbPath : null;
                } catch (\Throwable) {
                    return null;
                }
            };

            $firstOrder = function () use ($user): int {
                return $this->safeFirstOrder($user);
            };

            if ($oldPath && $oldPath !== $path) {
                $oldPhoto = $user->profilePhotos()->where('path', $oldPath)->first();

                if ($oldPhoto) {
                    $oldPhoto->forceFill(['path' => $path])->save();

                    $thumbPath = $makeThumb();

                    if ($thumbPath !== null) {
                        $oldPhoto->forceFill(['thumb_path' => $thumbPath])->save();
                    }

                    $first = $this->safeFirstOrder($user, (int) $oldPhoto->id);
                    $oldPhoto->forceFill(['sort_order' => $first])->save();

                    return;
                }
            }

            if (! $user->canAddProfilePhoto()) {
                $oldest = $user->profilePhotos()->orderBy('created_at')->orderBy('id')->first();

                if (! $oldest) {
                    return;
                }

                $oldFile = $oldest->path;

                $oldest->delete();

                if (is_string($oldFile) && $oldFile !== '' && $oldFile !== $path) {
                    try {
                        Storage::disk($disk)->delete($oldFile);
                    } catch (\Throwable) {
                    }

                    if ($disk !== 'public') {
                        try {
                            Storage::disk('public')->delete($oldFile);
                        } catch (\Throwable) {
                        }
                    }
                }
            }

            $photo = $user->profilePhotos()->create([
                'path' => $path,
                'caption' => null,
                'sort_order' => $firstOrder(),
            ]);

            $thumbPath = $makeThumb();

            if (is_string($thumbPath)) {
                $photo->forceFill(['thumb_path' => $thumbPath])->save();
            }
        } catch (\Throwable) {
        }
    }
}
