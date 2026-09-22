<?php

namespace App\Http\Controllers;

use App\Http\Requests\BusinessProfileRequest;
use App\Http\Resources\BusinessResource;
use App\Models\Business;
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
     */
    public function onboarding(): Response
    {
        return Inertia::render('Business/Onboarding');
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
     * Отправить на проверку (УНП + юрадрес обязательны).
     */
    public function submit(Request $request): BusinessResource
    {
        $business = $this->businesses->submitForVerification($request->user());

        return new BusinessResource($business);
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
