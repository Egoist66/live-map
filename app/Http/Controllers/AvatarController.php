<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Загрузка и замена аватара пользователя.
 *
 * Пишет файл на диск из User::avatarDisk (S3 при настройке, иначе public),
 * старый файл удаляет только после успешной записи нового — путь в БД
 * никогда не затирается неудачной загрузкой.
 */
class AvatarController extends Controller
{
    public function store(Request $request)
    {
        $request->validate(['avatar' => 'required|image|max:2048']);

        $user = $request->user();
        $disk = User::avatarDisk();
        $oldPath = $user->avatar_path;

        $path = $request->file('avatar')->store('avatars', $disk);
        if (!$path || !Storage::disk($disk)->exists($path)) {
            throw ValidationException::withMessages([
                'avatar' => 'Не удалось сохранить файл. Попробуй ещё раз.',
            ]);
        }

        $user->update(['avatar_path' => $path]);

        if ($oldPath && $oldPath !== $path) {
            Storage::disk($disk)->delete($oldPath);
            if ($disk !== 'public') {
                Storage::disk('public')->delete($oldPath);
            }
        }

        return back()->with('status', 'avatar-updated');
    }
}
