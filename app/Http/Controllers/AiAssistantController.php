<?php

namespace App\Http\Controllers;

use App\Http\Requests\Ai\AiAskRequest;
use App\Http\Requests\Ai\AiFeedbackRequest;
use App\Http\Requests\Ai\AiModerateTextRequest;
use App\Http\Requests\Ai\AiProfileAnalysisRequest;
use App\Http\Requests\Ai\AiQuestionnaireDraftRequest;
use App\Models\User;
use App\Services\AiTextService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Ai\Responses\StreamableAgentResponse;

/**
 * Текстовый AI-ассистент: модерация, гид по приложению, разбор профиля.
 *
 * Контроллер тонкий: валидация — в FormRequest, логика — в AiTextService.
 */
class AiAssistantController extends Controller
{
    /**
     * Проверить текст на токсичность (regex + OpenRouter при нужде).
     *
     * @param  AiModerateTextRequest  $request  валидированный текст
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse вердикт модерации
     */
    public function moderate(AiModerateTextRequest $request, AiTextService $ai): JsonResponse
    {
        $validated = $request->validated();
        $verdict = $ai->moderate($validated['text']);

        return response()->json(['data' => $verdict]);
    }

    /**
     * Ответить на вопрос о приложении (JSON, с историей диалога).
     *
     * @param  AiAskRequest  $request  вопрос + опциональный conversation_id
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse ответ и id диалога
     */
    public function ask(AiAskRequest $request, AiTextService $ai): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $result = $ai->askGuide($user, $validated['question'], $validated['conversation_id'] ?? null);

        return response()->json(['data' => $result]);
    }

    /**
     * Стримить ответ гида (SSE, нативный формат SDK).
     *
     * @param  AiAskRequest  $request  вопрос + опциональный conversation_id
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return StreamableAgentResponse поток SDK, сам отдаёт SSE
     */
    public function askStream(AiAskRequest $request, AiTextService $ai): StreamableAgentResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        return $ai->streamGuide($user, $validated['question'], $validated['conversation_id'] ?? null);
    }

    /**
     * Разобрать дейтинг-профиль текущего пользователя.
     *
     * @param  AiProfileAnalysisRequest  $request  пустое тело
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse оценка и рекомендации
     */
    public function analyze(AiProfileAnalysisRequest $request, AiTextService $ai): JsonResponse
    {
        $analysis = $ai->analyzeProfile($request->user());

        return response()->json(['data' => $analysis]);
    }

    /**
     * Сгенерировать черновик дейтинг-анкеты по промпту (Premium и выше).
     *
     * Промпт и результат проходят модерацию в AiTextService.
     * Черновик только подставляется в форму — пользователь правит и сохраняет сам.
     *
     * @param  AiQuestionnaireDraftRequest  $request  валидированный промпт
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse черновик анкеты
     */
    public function draftQuestionnaire(AiQuestionnaireDraftRequest $request, AiTextService $ai): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            in_array($user->effectivePlan(), User::TOP_PLANS, true),
            402,
            'Генерация анкеты по промпту — фишка Premium. Оформите тариф, чтобы продолжить.'
        );

        $validated = $request->validated();
        $draft = $ai->draftQuestionnaire($user, $validated['prompt']);

        return response()->json(['data' => $draft]);
    }

    /**
     * Список диалогов с гидом (восстановление после перезагрузки).
     *
     * @param  Request  $request  запрос с опциональным limit
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse диалоги пользователя
     */
    public function index(Request $request, AiTextService $ai): JsonResponse
    {
        $limit = (int) $request->integer('limit', 20);
        $conversations = $ai->listConversations($request->user(), $limit);

        return response()->json(['data' => $conversations]);
    }

    /**
     * История сообщений диалога в хронологическом порядке.
     *
     * @param  string  $id  id диалога
     * @param  Request  $request  запрос с опциональным limit
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse сообщения диалога
     */
    public function history(string $id, Request $request, AiTextService $ai): JsonResponse
    {
        $limit = (int) $request->integer('limit', 50);
        $messages = $ai->conversationMessages($request->user(), $id, $limit);

        return response()->json(['data' => $messages]);
    }

    /**
     * Быстрые команды гида под включённые у пользователя модули.
     *
     * @param  Request  $request  запрос с опциональным limit
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse чипы команд
     */
    public function quickCommands(Request $request, AiTextService $ai): JsonResponse
    {
        $limit = (int) $request->integer('limit', 12);
        $commands = $ai->quickCommands($request->user(), $limit);

        return response()->json(['data' => $commands]);
    }

    /**
     * Оценить ответ гида (обучающий сигнал для базы знаний).
     *
     * @param  AiFeedbackRequest  $request  диалог + оценка
     * @param  AiTextService  $ai  текстовый AI-слой
     * @return JsonResponse id оценки
     */
    public function feedback(AiFeedbackRequest $request, AiTextService $ai): JsonResponse
    {
        $validated = $request->validated();
        $result = $ai->rateAnswer(
            $request->user(),
            $validated['conversation_id'],
            (int) $validated['rating'],
            $validated['comment'] ?? null,
        );

        return response()->json(['data' => $result], 201);
    }
}
