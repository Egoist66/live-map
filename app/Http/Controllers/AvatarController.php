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

        $this->mirrorAvatarToGallery($user->refresh(), $path, $disk);

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
     * Галерея отдаётся latest() — свежая запись оказывается первой,
     * фронт показывает её с бейджем «ГЛАВНОЕ», а дейтинг-карточки
     * берут её обложкой. Дубли одного пути и переполнение лимита
     * молча пропускаем — аватар при этом всё равно обновлён.
     *
     * @param User $user владелец
     * @param string $path путь сохранённого аватара
     * @param string $disk диск файла
     * @return void
     */
    private function mirrorAvatarToGallery(User $user, string $path, string $disk): void
    {
        try {
            if ($user->profilePhotos()->where('path', $path)->exists()) {
                return;
            }

            if (! $user->canAddProfilePhoto()) {
                return;
            }

            $photo = $user->profilePhotos()->create(['path' => $path, 'caption' => null]);

            try {
                $thumbPath = ImageOptimizer::storeThumbnail($path, $disk);

                if (is_string($thumbPath)) {
                    $photo->forceFill(['thumb_path' => $thumbPath])->save();
                }
            } catch (\Throwable) {
            }
        } catch (\Throwable) {
        }
    }
}
