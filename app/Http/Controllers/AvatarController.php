<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ImageOptimizer;
use Illuminate\Http\Request;
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

        if ($oldPath && $oldPath !== $path && ! $user->profilePhotos()->where('path', $oldPath)->exists()) {
            Storage::disk($disk)->delete($oldPath);
            if ($disk !== 'public') {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back()->with('status', 'avatar-updated');
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
    private function mirrorAvatarToGallery(User $user, string $path, string $disk, ?string $oldPath = null): void
    {
        try {
            $existing = $user->profilePhotos()->where('path', $path)->first();

            if ($existing) {
                $minOrder = (int) ($user->profilePhotos()->min('sort_order') ?? 0);
                $existing->forceFill(['sort_order' => $minOrder - 1])->save();
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

            $firstOrder = static function () use ($user): int {
                $minOrder = (int) ($user->profilePhotos()->min('sort_order') ?? 0);

                return $minOrder - 1;
            };

            if ($oldPath && $oldPath !== $path) {
                $oldPhoto = $user->profilePhotos()->where('path', $oldPath)->first();

                if ($oldPhoto) {
                    $oldPhoto->forceFill(['path' => $path])->save();

                    $thumbPath = $makeThumb();

                    if ($thumbPath !== null) {
                        $oldPhoto->forceFill(['thumb_path' => $thumbPath])->save();
                    }

                    $oldPhoto->forceFill(['sort_order' => $firstOrder()])->save();

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
