<?php

namespace App\Http\Controllers;

use App\Rules\NoContactInfo;
use App\Rules\NoProfanity;
use App\Services\HomeLocationService;
use App\Services\TelegramOnboarding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Веб-анкета онбординга для Mini App (добивка после Telegram-входа).
 *
 * Та же анкета, что в боте пошагово и в браузерной регистрации:
 * имя, пол, дата рождения 18+, цель, город. Пока не заполнена —
 * middleware EnsureOnboardingComplete держит сессию с флагом
 * `onboarding_only` взаперти: открыт только этот контроллер.
 * Стафф сюда не попадает (гейт его не касается).
 */
class OnboardingController extends Controller
{
    /**
     * Цели знакомств как в регистрации и боте.
     *
     * @var string[]
     */
    private const GOALS = ['love', 'flirt', 'friendship', 'chat', 'interests'];

    /**
     * Статус анкеты: заполнена ли, что не хватает, черновик полей.
     *
     * @param Request $request запрос
     * @return JsonResponse complete, missing[], draft
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user()->fresh() ?? $request->user();

        return response()->json([
            'complete' => TelegramOnboarding::isComplete($user),
            'missing' => TelegramOnboarding::missingFields($user),
            'draft' => self::draftFor($user),
        ]);
    }

    /**
     * Сохранить анкету целиком и снять флаг взаперти.
     *
     * @param Request $request имя, пол, дата рождения, цель, город
     * @return JsonResponse complete:true
     *
     * @throws ValidationException
     */
    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255', new NoProfanity(), new NoContactInfo()],
            'gender' => 'required|in:male,female',
            'birth_date' => 'required|date|before:today|after:1900-01-01',
            'dating_goal' => 'required|in:love,flirt,friendship,chat,interests',
            'home_city' => 'nullable|string|max:120',
        ]);

        $birth = (string) $data['birth_date'];

        if (! TelegramOnboarding::isAdultBirth($birth)) {
            throw ValidationException::withMessages([
                'birth_date' => 'Свайпы и мэтчи — строго с 18 лет.',
            ]);
        }

        $fresh = $user->fresh() ?? $user;

        $patch = [
            'name' => trim($data['name']),
            'gender' => $data['gender'],
            'birth_date' => $birth,
            'dating_goal' => $data['dating_goal'],
            'dating_enabled' => true,
        ];

        $city = trim((string) ($data['home_city'] ?? ''));

        if ($city !== '') {
            $patch['home_city'] = mb_substr($city, 0, 120);
        }

        $fresh->forceFill($patch)->save();

        // Город из анкеты — резервная точка для свайпов: без геолокации
        // дистанции и «Люди рядом» считаются по центру города.
        app(HomeLocationService::class)->ensureCoordinates($fresh);

        $request->session()->forget('onboarding_only');
        TelegramOnboarding::clearState((int) $fresh->id);

        return response()->json(['complete' => true]);
    }

    /**
     * Черновик формы: что уже есть в профиле.
     *
     * @param mixed $user пользователь
     * @return array{name:string, gender:string|null, birth_date:string|null, dating_goal:string|null, home_city:string|null}
     */
    private static function draftFor(mixed $user): array
    {
        $name = trim((string) ($user->name ?? ''));

        if ($name === TelegramOnboarding::GUEST_NAME) {
            $name = '';
        }

        $birth = $user->birth_date ?? null;

        try {
            $birthIso = $birth !== null
                ? \Carbon\Carbon::parse($birth)->toDateString()
                : null;
        } catch (\Throwable) {
            $birthIso = null;
        }

        $gender = in_array($user->gender, ['male', 'female'], true)
            ? (string) $user->gender
            : null;

        $goal = in_array((string) ($user->dating_goal ?? ''), self::GOALS, true)
            ? (string) $user->dating_goal
            : null;

        return [
            'name' => $name,
            'gender' => $gender,
            'birth_date' => $birthIso,
            'dating_goal' => $goal,
            'home_city' => $user->home_city ?? null,
        ];
    }
}
