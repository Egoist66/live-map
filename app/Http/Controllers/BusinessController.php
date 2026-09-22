<?php

namespace App\Http\Controllers;

use App\Http\Requests\BusinessProfileRequest;
use App\Http\Resources\BusinessResource;
use App\Models\Business;
use App\Models\Pin;
use App\Services\BusinessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Кабинет бизнеса: профиль, верификация РБ, дашборд.
 */
class BusinessController extends Controller
{
    public function __construct(private BusinessService $businesses) {}

    /**
     * Страница кабинета (дашборд).
     */
    public function index(Request $request): Response
    {
        $dashboard = $this->businesses->dashboardFor($request->user());

        return Inertia::render('Business/Index', [
            'initialDashboard' => $dashboard,
        ]);
    }

    /**
     * Онбординг компании по законодательству РБ.
     *
     * Форма подтягивает уже известные реквизиты из профиля
     * (заполнены при регистрации) — дозаполнить нужно только
     * недостающее, это решает фронт по данным show/dashboard.
     */
    public function onboarding(): Response
    {
        return Inertia::render('Business/Onboarding');
    }

    /**
     * Пины компании в кабинете.
     */
    public function pinsPage(): Response
    {
        return Inertia::render('Business/Pins');
    }

    /**
     * Настройки бизнеса: профиль, тариф, уведомления, приложение.
     *
     * Только бизнес-сущности, без персональных разделов
     * (свайпы, знакомства, невидимка персоны).
     */
    public function settings(Request $request): Response
    {
        $dashboard = $this->businesses->dashboardFor($request->user());

        return Inertia::render('Business/Settings', [
            'initialDashboard' => $dashboard,
        ]);
    }

    /**
     * Текущий профиль бизнеса.
     */
    public function show(Request $request): BusinessResource
    {
        $business = $this->businesses->profileFor($request->user());

        return new BusinessResource($business);
    }

    /**
     * Обновить профиль бизнеса.
     */
    public function update(BusinessProfileRequest $request): BusinessResource
    {
        $business = $this->businesses->updateProfile(
            $request->user(),
            $request->validated()
        );

        return new BusinessResource($business);
    }

    /**
     * Дашборд кабинета: цифры, пины, подсказки заработка.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $data = $this->businesses->dashboardFor($request->user());

        return response()->json($data);
    }

    /**
     * Компании на карте: активные бизнесы с точкой в радиусе.
     *
     * Особая метка домашней зоны компании — видна всем пользователям
     * карты. Клик открывает список пинов компании и её профиль.
     */
    public function map(Request $request): JsonResponse
    {
        $lat = (float) $request->input('lat', 53.9);
        $lng = (float) $request->input('lng', 27.56);
        $radiusKm = (int) $request->input('radius', 50);
        $radiusKm = max(1, min($radiusKm, 500));

        $haversine = '(6371 * acos(cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + sin(radians(?)) * sin(radians(lat))))';

        $companies = Business::query()
            ->where('is_active', true)
            ->whereNotNull('lat')
            ->whereNotNull('lng')
            ->selectRaw("businesses.*, {$haversine} as distance", [$lat, $lng, $lat])
            ->having('distance', '<=', $radiusKm)
            ->orderBy('distance')
            ->with('user:id,profile_slug,name')
            ->limit(100)
            ->get();

        $pinsCounts = Pin::query()
            ->whereIn('user_id', $companies->pluck('user_id')->all() ?: [0])
            ->where('status', 'active')
            ->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->selectRaw('user_id, count(*) as aggregate')
            ->groupBy('user_id')
            ->pluck('aggregate', 'user_id');

        $items = $companies->map(function (Business $business) use ($pinsCounts) {
            $public = $business->toPublicArray();
            $public['pins_count'] = (int) ($pinsCounts[$business->user_id] ?? 0);
            $public['owner_profile'] = $business->user?->profileIdentifier();

            return $public;
        })->values();

        return response()->json($items);
    }

    /**
     * Живые пины компании для модалки на карте.
     */
    public function pins(Request $request, Business $business): JsonResponse
    {
        abort_unless($business->is_active, 404);

        $viewerId = $request->user()?->id;

        $pins = Pin::where('user_id', $business->user_id)
            ->active()
            ->boostedFirst()
            ->with('user:id,name,avatar_path,level,account_type')
            ->limit(50)
            ->get();

        return response()->json(
            $pins->map(fn (Pin $pin) => $pin->toPublicArray($viewerId))->values()
        );
    }

    /**
     * Отправить на проверку (УНП + юрадрес обязательны).
     */
    public function submit(Request $request): BusinessResource
    {
        $business = $this->businesses->submitForVerification($request->user());

        return new BusinessResource($business);
    }

    /**
     * Загрузить логотип компании (владелец или админ).
     */
    public function logo(Request $request, Business $business): BusinessResource
    {
        $user = $request->user();

        abort_unless($business->user_id === $user->id || $user->isAdmin(), 403);

        $request->validate(['logo' => 'required|image|max:2048']);

        $path = \App\Services\ImageOptimizer::storeOptimized(
            $request->file('logo'),
            'business-logos',
            'public',
            ['maxSide' => \App\Services\ImageOptimizer::GALLERY_MAX_SIDE]
        );

        $old = $business->logo_path;

        $business->forceFill(['logo_path' => $path])->save();

        if (is_string($old) && $old !== '') {
            try {
                \Illuminate\Support\Facades\Storage::disk('public')->delete($old);
            } catch (\Throwable) {
            }
        }

        return new BusinessResource($business->fresh());
    }

    /**
     * Верифицировать (админ).
     */
    public function verify(Request $request, Business $business): BusinessResource
    {
        $verified = $this->businesses->verify($business, $request->user());

        return new BusinessResource($verified);
    }

    /**
     * Отклонить с причиной (админ).
     */
    public function reject(Request $request, Business $business): BusinessResource
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:1000'],
        ]);

        $rejected = $this->businesses->reject($business, $request->user(), $data['reason']);

        return new BusinessResource($rejected);
    }
}
