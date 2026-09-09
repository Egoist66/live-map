<?php

namespace App\Http\Controllers;

use App\Services\DatingService;
use Illuminate\Http\Request;

/**
 * Дейтинг-лента: свайпы, мэтчи, фильтры, настройки приватности.
 */
class SwipeController extends Controller
{
    public function __construct(private DatingService $dating) {}

    /**
     * Лента кандидатов.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function feed(Request $request)
    {
        $me = $request->user();
        $this->dating->assertAdult($me);

        $data = $request->validate([
            'goal' => 'nullable|in:love,flirt,friendship,chat,interests',
            'gender' => 'nullable|in:male,female,all',
            'age_min' => 'nullable|integer|min:18|max:99',
            'age_max' => 'nullable|integer|min:18|max:99',
            'radius_km' => 'nullable|integer|min:1|max:500',
            'interests' => 'nullable|array|max:10',
            'interests.*' => 'string|max:40',
        ]);

        $cards = $this->dating->feed($me, $data);

        return response()->json([
            'cards' => $cards,
            'quota' => $this->dating->quotaState($me),
        ]);
    }

    /**
     * Лайк или пас.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function act(Request $request)
    {
        $this->dating->assertAdult($request->user());
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'action' => 'required|in:like,pass',
        ]);

        $result = $this->dating->recordAction(
            $request->user(),
            (int) $data['user_id'],
            $data['action']
        );

        return response()->json(array_merge($result, [
            'quota' => $this->dating->quotaState($request->user()),
        ]), $result['matched'] ? 201 : 200);
    }

    /**
     * Список мэтчей.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function matches(Request $request)
    {
        $this->dating->assertAdult($request->user());
        return response()->json([
            'matches' => $this->dating->matches($request->user()),
            'quota' => $this->dating->quotaState($request->user()),
        ]);
    }

    /**
     * Квота рандомных чатов.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function quota(Request $request)
    {
        $this->dating->assertAdult($request->user());
        return response()->json($this->dating->quotaState($request->user()));
    }

    /**
     * Настройки дейтинга и приватности.
     *
     * Скрытие имени/возраста — PRO. Режим "только мэтчи" доступен всем.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function settings(Request $request)
    {
        $me = $request->user();
        $this->dating->assertAdult($me);

        $data = $request->validate([
            'dating_enabled' => 'sometimes|boolean',
            'dating_goal' => 'nullable|in:love,flirt,friendship,chat,interests',
            'dating_interests' => 'nullable|array|max:10',
            'dating_interests.*' => 'string|max:40',
            'dating_gender_pref' => 'sometimes|in:male,female,all',
            'dating_hide_name' => 'sometimes|boolean',
            'dating_hide_age' => 'sometimes|boolean',
            'dating_match_only' => 'sometimes|boolean',
        ]);

        $wantsHide = ($data['dating_hide_name'] ?? false) || ($data['dating_hide_age'] ?? false);

        if ($wantsHide && ! $me->isPro()) {
            return response()->json([
                'message' => 'Скрытие имени и возраста — PRO-функция. Заполните профиль и оформите PRO.',
            ], 402);
        }

        $me->update($data);

        return response()->json($me->only([
            'dating_enabled',
            'dating_goal',
            'dating_interests',
            'dating_gender_pref',
            'dating_hide_name',
            'dating_hide_age',
            'dating_match_only',
        ]));
    }

    /**
     * Подтверждение возраста для свайпов (строго 18+).
     *
     * Дату можно указать один раз — изменить её нельзя,
     * чтобы нельзя было обойти гейт.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verifyAge(Request $request)
    {
        $me = $request->user();

        abort_if($me->birth_date !== null, 422, 'Дата рождения уже указана и не может быть изменена');

        $threshold = now()->subYears(DatingService::ADULT_AGE)->toDateString();

        $data = $request->validate(
            ['birth_date' => ['required', 'date', 'after:1900-01-01', "before_or_equal:{$threshold}"]],
            ['birth_date.before_or_equal' => 'Свайпы доступны только с 18 лет.']
        );

        $me->forceFill(['birth_date' => $data['birth_date']])->save();

        return response()->json(['ok' => true, 'age' => $me->refresh()->age]);
    }
}
