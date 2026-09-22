<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\BusinessPhoto;
use App\Models\User;
use App\Services\ContentModeration;
use App\Services\ImageOptimizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Фотографии компании: витрина для пинов на карте и профиля.
 */
class BusinessPhotoController extends Controller
{
    public const MAX_PHOTOS = 10;

    /**
     * Фото компании (публично для пользователей карты).
     */
    public function index(Business $business): JsonResponse
    {
        abort_unless($business->is_active, 404);

        $photos = $business->photos()->get()->map(fn (BusinessPhoto $photo) => $photo->toPublicArray())->values();

        return response()->json(['photos' => $photos, 'limit' => self::MAX_PHOTOS, 'count' => $photos->count()]);
    }

    /**
     * Фото компании владельца по id пользователя (для карточки пина).
     */
    public function byOwner(User $user): JsonResponse
    {
        $business = Business::where('user_id', $user->id)->where('is_active', true)->orderByDesc('id')->first();

        if (! $business) {
            return response()->json(['photos' => []]);
        }

        $photos = $business->photos()->get()->map(fn (BusinessPhoto $photo) => $photo->toPublicArray())->values();

        return response()->json(['business_id' => $business->id, 'photos' => $photos]);
    }

    /**
     * Загрузить фото (владелец или админ).
     */
    public function store(Request $request, Business $business): JsonResponse
    {
        $user = $request->user();

        abort_unless($business->user_id === $user->id || $user->isAdmin(), 403);

        $request->validate([
            'photo' => 'required|image|max:10240',
            'caption' => 'nullable|string|max:140',
        ]);

        abort_if($business->photos()->count() >= self::MAX_PHOTOS, 422, 'Максимум ' . self::MAX_PHOTOS . ' фото компании');

        if ($request->filled('caption')) {
            ContentModeration::assertClean($request->input('caption'));
        }

        $path = ImageOptimizer::storeOptimized(
            $request->file('photo'),
            'business-photos',
            'public',
            ['maxSide' => ImageOptimizer::GALLERY_MAX_SIDE]
        );

        try {
            $photo = DB::transaction(function () use ($business, $path, $request) {
                abort_if($business->photos()->count() >= self::MAX_PHOTOS, 422, 'Максимум ' . self::MAX_PHOTOS . ' фото компании');

                $maxOrder = (int) ($business->photos()->max('sort_order') ?? 0);

                return $business->photos()->create([
                    'path' => $path,
                    'caption' => $request->input('caption'),
                    'sort_order' => $maxOrder + 1,
                ]);
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        return response()->json($photo->fresh()->toPublicArray(), 201);
    }

    /**
     * Удалить фото (владелец или админ).
     */
    public function destroy(Request $request, Business $business, BusinessPhoto $photo): JsonResponse
    {
        $user = $request->user();

        abort_unless($business->user_id === $user->id || $user->isAdmin(), 403);
        abort_unless($photo->business_id === $business->id, 404);

        Storage::disk('public')->delete($photo->path);
        $photo->delete();

        return response()->json(['ok' => true]);
    }
}
