<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AvatarController extends Controller
{
    public function store(Request $request)
    {
        $request->validate(['avatar' => 'required|image|max:2048']);

        $user = $request->user();
        $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
        if ($user->avatar_path) {
            Storage::disk($disk)->delete($user->avatar_path);
            if ($disk !== 'public') Storage::disk('public')->delete($user->avatar_path);
        }
        $path = $request->file('avatar')->store('avatars', $disk);
        $user->update(['avatar_path' => $path]);

        return back()->with('status', 'avatar-updated');
    }
}
