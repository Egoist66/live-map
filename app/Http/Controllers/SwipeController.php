<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Rules\NoContactInfo;
use App\Services\ActivityRewards;
use App\Services\DatingQuestionnaireService;
use App\Services\DatingService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Дейтинг-лента: свайпы, мэтчи, фильтры, настройки приватности.
 */
class SwipeController extends Controller
{
    public function __construct(
        private DatingService $dating,
        private DatingQuestionnaireService $questionnaire,
    ) {}

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
     * Лайк, пас или суперлайк.
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
            'superlike' => 'sometimes|boolean',
        ]);

        $result = $this->dating->recordAction(
            $request->user(),
            (int) $data['user_id'],
            $data['action'],
            (bool) ($data['incognito'] ?? false),
            (bool) ($data['superlike'] ?? false)
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
     * Откатить последний свайп: вернуть анкету в начало колоды.
     *
     * Free — раз в день, PRO/Business — безлимит.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function undo(Request $request)
    {
        $this->dating->assertAdult($request->user());

        $data = $request->validate([
            'user_id' => 'nullable|integer|min:1',
        ]);

        $result = $this->dating->undoLastSwipe(
            $request->user(),
            isset($data['user_id']) ? (int) $data['user_id'] : null
        );

        return response()->json(array_merge($result, [
            'quota' => $this->dating->quotaState($request->user()),
        ]));
    }

    /**
     * Включить буст профиля на 30 минут.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function boost(Request $request)
    {
        $this->dating->assertAdult($request->user());

        $result = $this->dating->activateBoost($request->user());

        return response()->json(array_merge($result, [
            'quota' => $this->dating->quotaState($request->user()),
        ]));
    }

    /**
     * Купить разовый экстра-товар (пак суперлайков / буст).
     *
     * Стаб оплаты: начисляет сразу. Сюда подключается шлюз.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function purchase(Request $request)
    {
        $this->dating->assertAdult($request->user());

        $data = $request->validate([
            'item' => 'required|in:superlike_pack,boost',
        ]);

        $result = $this->dating->purchaseExtras($request->user(), $data['item']);

        return response()->json(array_merge($result, [
            'quota' => $this->dating->quotaState($request->user()),
        ]));
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
            'dating_custom_goal' => ['nullable', 'string', 'max:60', new NoContactInfo()],
            'dating_about' => ['nullable', 'string', 'max:1000', new NoContactInfo()],
            'dating_interests' => 'nullable|array|max:10',
            'dating_interests.*' => ['string', 'max:40', new NoContactInfo()],
            'dating_gender_pref' => 'sometimes|in:male,female,all',
            'dating_hide_name' => 'sometimes|boolean',
            'dating_hide_age' => 'sometimes|boolean',
            'dating_hide_distance' => 'sometimes|boolean',
            'dating_hide_rating' => 'sometimes|boolean',
            'dating_match_only' => 'sometimes|boolean',
        ]);

        $data = $this->questionnaire->normalize($data);
        $this->questionnaire->assertClean($data);

        $hideKeys = ['dating_hide_name', 'dating_hide_age', 'dating_hide_distance', 'dating_hide_rating'];

        $enablingHide = false;

        foreach ($hideKeys as $key) {
            if (array_key_exists($key, $data) && (bool) $data[$key] && ! (bool) $me->$key) {
                $enablingHide = true;
                break;
            }
        }

        if ($enablingHide && ! $me->canHideRating()) {
            return response()->json([
                'message' => 'Скрытие имени, возраста и рейтинга — PRO-функция. Заполните профиль и оформите PRO.',
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
            'dating_hide_rating',
            'dating_match_only',
        ]));
    }

    /**
     * Скачать анкету ULove переносимым JSON-файлом.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function exportSettings(Request $request)
    {
        $me = $request->user();
        $this->dating->assertAdult($me);

        $filename = 'ulove-anketa-'.now()->format('Y-m-d').'.json';

        return response()->json($this->questionnaire->export($me), 200, [
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * Импортировать анкету из JSON-файла, скачанного ранее.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     *
     * @throws ValidationException 422 — битый файл или запрещённый контент
     */
    public function importSettings(Request $request)
    {
        $me = $request->user();
        $this->dating->assertAdult($me);

        $request->validate([
            'file' => ['required', 'file', 'max:64'],
        ]);

        $contents = $request->file('file')->get();

        if ($contents === false) {
            throw ValidationException::withMessages([
                'file' => 'Не удалось прочитать файл анкеты.',
            ]);
        }

        $data = $this->questionnaire->parseImport($contents);
        $this->questionnaire->apply($me, $data);

        return response()->json($me->refresh()->only([
            'dating_enabled',
            'dating_goal',
            'dating_custom_goal',
            'dating_about',
            'dating_interests',
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
