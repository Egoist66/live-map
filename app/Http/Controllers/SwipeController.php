<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityRewards;
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
            'exclude_ids' => 'nullable|array|max:200',
            'exclude_ids.*' => 'integer|min:1',
            'limit' => 'nullable|integer|min:1|max:30',
        ]);

        $cards = $this->dating->feed($me, $data, (int) ($data['limit'] ?? 20));

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
            'incognito' => 'sometimes|boolean',
        ]);

        $result = $this->dating->recordAction(
            $request->user(),
            (int) $data['user_id'],
            $data['action'],
            (bool) ($data['incognito'] ?? false)
        );

        $me = $request->user();
        $otherId = (int) $data['user_id'];
        $swipeAction = $data['action'] === 'like' ? 'swipe_like' : 'swipe_pass';
        $reward = ActivityRewards::award($me, $swipeAction, 'user', $otherId);

        if (! empty($result['matched'])) {
            $matchReward = ActivityRewards::award($me, 'swipe_match', 'user', $otherId);

            if ($matchReward !== null) {
                $reward = $matchReward;
            }

            $partner = User::find($otherId);

            if ($partner) {
                ActivityRewards::award($partner, 'swipe_match', 'user', (int) $me->id);
            }
        }

        $response = array_merge($result, [
            'quota' => $this->dating->quotaState($request->user()),
        ]);

        if ($reward !== null) {
            $response['reward'] = $reward;
        }

        return response()->json($response, $result['matched'] ? 201 : 200);
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
        $page = max(1, (int) $request->input('page', 1));
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));
        $res = $this->dating->matches($request->user(), $page, $perPage);
        return response()->json([
            'matches' => $res['matches'],
            'current_page' => $res['current_page'],
            'last_page' => $res['last_page'],
            'total' => $res['total'],
            'has_more' => $res['has_more'],
            'quota' => $this->dating->quotaState($request->user()),
        ]);
    }

    /**
     * Избранное: лайкнутые без мэтча + лимит по тарифу.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function favorites(Request $request)
    {
        $this->dating->assertAdult($request->user());
        $page = max(1, (int) $request->input('page', 1));
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));

        return response()->json($this->dating->favorites($request->user(), $page, $perPage));
    }

    /**
     * Кто лайкнул меня: открытые + инкогнито.
     * Инкогнито (PRO) видно как «Тайный поклонник» до мэтча.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function admirers(Request $request)
    {
        $this->dating->assertAdult($request->user());
        $page = max(1, (int) $request->input('page', 1));
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));

        return response()->json($this->dating->admirers($request->user(), $page, $perPage));
    }

    /**
     * Убрать человека из избранного.
     *
     * @param Request $request
     * @param int $user
     * @return \Illuminate\Http\JsonResponse
     */
    public function removeFavorite(Request $request, int $user)
    {
        $this->dating->assertAdult($request->user());
        $this->dating->removeFavorite($request->user(), $user);

        return response()->json(['ok' => true]);
    }

    /**
     * Активные сейчас в ULove (онлайн).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function active(Request $request)
    {
        $this->dating->assertAdult($request->user());
        $page = max(1, (int) $request->input('page', 1));
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));
        $res = $this->dating->active($request->user(), $perPage, $page);

        return response()->json([
            'active' => $res['active'],
            'current_page' => $res['current_page'],
            'last_page' => $res['last_page'],
            'total' => $res['total'],
            'has_more' => $res['has_more'],
            'quota' => $this->dating->quotaState($request->user()),
        ]);
    }

    /**
     * Сбросить просмотренные свайпы.
     *
     * Админ и PRO/Business — безлимитно, Free — один раз.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function resetHistory(Request $request)
    {
        $deleted = $this->dating->resetHistory($request->user());

        return response()->json([
            'ok' => true,
            'deleted' => $deleted,
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
     * Скрытие имени/возраста/расстояния — PRO. Режим "только мэтчи" доступен всем.
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
            'dating_custom_goal' => 'nullable|string|max:60',
            'dating_about' => 'nullable|string|max:1000',
            'dating_interests' => 'nullable|array|max:10',
            'dating_interests.*' => 'string|max:40',
            'dating_gender_pref' => 'sometimes|in:male,female,all',
            'dating_hide_name' => 'sometimes|boolean',
            'dating_hide_age' => 'sometimes|boolean',
            'dating_hide_distance' => 'sometimes|boolean',
            'dating_match_only' => 'sometimes|boolean',
        ]);

        $customGoal = isset($data['dating_custom_goal']) ? trim((string) $data['dating_custom_goal']) : null;
        $data['dating_custom_goal'] = $customGoal !== '' ? $customGoal : null;
        $about = isset($data['dating_about']) ? trim((string) $data['dating_about']) : null;
        $data['dating_about'] = $about !== '' ? $about : null;
        $interests = $data['dating_interests'] ?? null;
        if (is_array($interests)) {
            $cleaned = [];
            foreach ($interests as $interest) {
                $tag = mb_strtolower(trim((string) $interest));
                if ($tag === '' || in_array($tag, $cleaned, true)) {
                    continue;
                }
                $cleaned[] = mb_substr($tag, 0, 40);
            }
            $data['dating_interests'] = array_values(array_slice($cleaned, 0, 10));
        }

        \App\Services\ContentModeration::assertClean(
            $data['dating_about'] ?? null,
            $data['dating_custom_goal'] ?? null,
            ...($data['dating_interests'] ?? [])
        );

        $wantsHide = ($data['dating_hide_name'] ?? false) || ($data['dating_hide_age'] ?? false) || ($data['dating_hide_distance'] ?? false);

        if ($wantsHide && ! $me->isPro()) {
            return response()->json([
                'message' => 'Скрытие имени и возраста — PRO-функция. Заполните профиль и оформите PRO.',
            ], 402);
        }

        $me->update($data);

        return response()->json($me->only([
            'dating_enabled',
            'dating_goal',
            'dating_custom_goal',
            'dating_about',
            'dating_interests',
            'dating_gender_pref',
            'dating_hide_name',
            'dating_hide_age',
            'dating_hide_distance',
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
