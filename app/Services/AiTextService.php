<?php

namespace App\Services;

use App\Ai\Agents\AppGuideAgent;
use App\Ai\Agents\ProfileCoachAgent;
use App\Ai\Agents\QuestionnaireDraftAgent;
use App\Ai\Agents\TextSafetyAgent;
use App\Models\AiGuideFeedback;
use App\Models\ReferencePage;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Ai\Models\Conversation as AiConversation;
use Laravel\Ai\Responses\StreamableAgentResponse;
use Throwable;

/**
 * Текстовый AI-слой приложения: модерация, гид и разбор профиля.
 *
 * Все вызовы идут через официальный Laravel AI SDK на бесплатный OpenRouter
 * (доступен из РБ/СНГ, free-модели без карты).
 * Модерация работает в два слоя: мгновенный regex (ContentModeration)
 * и AI-вердикт для спорных текстов с суточным кэшем по хэшу.
 */
class AiTextService
{
    /**
     * Сколько символов текста уходит в AI (защита квоты).
     */
    public const MAX_TEXT_LENGTH = 2000;

    /**
     * Сколько символов вопроса уходит гиду.
     */
    public const MAX_QUESTION_LENGTH = 1000;

    /**
     * TTL кэша AI-вердиктов модерации в секундах.
     */
    public const SAFETY_CACHE_TTL = 86400;

    /**
     * Таймаут модерации: маленькая модель отвечает за секунды.
     */
    public const SAFETY_TIMEOUT = 20;

    /**
     * Таймаут ответа гида.
     */
    public const GUIDE_TIMEOUT = 60;

    /**
     * Таймаут разбора профиля: structured output на большой модели.
     */
    public const PROFILE_TIMEOUT = 90;

    /**
     * Сколько символов промпта уходит генератору анкеты.
     */
    public const MAX_PROMPT_LENGTH = 500;

    /**
     * Таймаут генерации черновика анкеты.
     */
    public const QUESTIONNAIRE_TIMEOUT = 60;

    /**
     * Лимит генераций черновика на пользователя в час (бережём free-квоту).
     */
    public const QUESTIONNAIRE_HOURLY_LIMIT = 10;

    /**
     * Цели анкеты, которые умеет ставить генератор.
     */
    public const QUESTIONNAIRE_GOALS = ['love', 'flirt', 'friendship', 'chat', 'interests'];

    /**
     * Проверить текст: regex-слой, затем AI-вердикт с кэшем.
     *
     * Никогда не бросает исключение: при недоступности AI
     * возвращает fail-open вердикт (regex уже отработал выше).
     *
     * @param  string  $text  проверяемый текст
     * @return array{is_toxic: bool, category: string|null, confidence: string|null, reason: string|null, source: string}
     */
    public function moderate(string $text): array
    {
        $cleanText = mb_substr(trim($text), 0, self::MAX_TEXT_LENGTH);

        if ($cleanText === '') {
            return $this->cleanVerdict('empty');
        }

        $regexHit = ContentModeration::check($cleanText);

        if ($regexHit !== null) {
            return $this->toxicVerdict($regexHit['topic'], $regexHit['message'], 'regex');
        }

        $cacheKey = $this->safetyCacheKey($cleanText);
        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return $cached;
        }

        try {
            $verdict = $this->askSafetyAgent($cleanText);
        } catch (Throwable $error) {
            Log::warning('ai safety check failed: '.$error->getMessage());

            return $this->cleanVerdict('fallback');
        }

        Cache::put($cacheKey, $verdict, self::SAFETY_CACHE_TTL);

        return $verdict;
    }

    /**
     * Ответить на вопрос о приложении с продолжением диалога.
     *
     * @param  User  $user  автор вопроса
     * @param  string  $question  вопрос пользователя
     * @param  string|null  $conversationId  продолжить диалог либо null для последнего
     * @return array{answer: string, conversation_id: string|null}
     */
    public function askGuide(User $user, string $question, ?string $conversationId = null): array
    {
        $this->ensureConfigured();

        $cleanQuestion = mb_substr(trim($question), 0, self::MAX_QUESTION_LENGTH);
        $agent = $this->guideAgentFor($user, $conversationId);
        $providers = $this->failoverProviders('ai.providers.openrouter.models.text.default');
        $response = $agent->prompt($cleanQuestion, provider: $providers, timeout: self::GUIDE_TIMEOUT);

        return [
            'answer' => $response->text,
            'conversation_id' => $response->conversationId,
        ];
    }

    /**
     * Стримить ответ гида (SSE). Возвращается напрямую из контроллера.
     *
     * @param  User  $user  автор вопроса
     * @param  string  $question  вопрос пользователя
     * @param  string|null  $conversationId  продолжить диалог либо null для последнего
     * @return StreamableAgentResponse поток SDK (Responsable)
     */
    public function streamGuide(User $user, string $question, ?string $conversationId = null): StreamableAgentResponse
    {
        $this->ensureConfigured();

        $cleanQuestion = mb_substr(trim($question), 0, self::MAX_QUESTION_LENGTH);
        $agent = $this->guideAgentFor($user, $conversationId);
        $providers = $this->failoverProviders('ai.providers.openrouter.models.text.default');

        return $agent->stream($cleanQuestion, provider: $providers, timeout: self::GUIDE_TIMEOUT);
    }

    /**
     * Разобрать дейтинг-профиль пользователя.
     *
     * @param  User  $user  чей профиль разбираем
     * @return array{score: int, strengths: string[], fixes: string[], bio_variants: string[], icebreakers: string[]}
     */
    public function analyzeProfile(User $user): array
    {
        $this->ensureConfigured();

        return $this->runProfileAnalysis($user);
    }

    /**
     * Сгенерировать черновик дейтинг-анкеты по свободному промпту (Premium).
     *
     * Промпт и результат проходят модерацию: токсичный промпт — 422,
     * сбой AI — исключение наверх (контроллер отдаёт 503/429).
     * Лимит 10/час на пользователя.
     *
     * @param  User  $user  владелец анкеты
     * @param  string  $prompt  описание желаемой анкеты своими словами
     * @return array{goal: string|null, custom_goal: string|null, about: string, interests: string[]}
     */
    public function draftQuestionnaire(User $user, string $prompt): array
    {
        $this->ensureConfigured();

        $cleanPrompt = mb_substr(trim($prompt), 0, self::MAX_PROMPT_LENGTH);

        abort_if($cleanPrompt === '', 422, 'Опишите, какую анкету хотите.');

        $verdict = $this->moderate($cleanPrompt);

        abort_if(
            $verdict['is_toxic'] ?? false,
            422,
            (string) ($verdict['reason'] ?? 'Промпт не прошёл модерацию.')
        );

        $result = RateLimiter::attempt(
            $this->questionnaireLimitKey($user),
            self::QUESTIONNAIRE_HOURLY_LIMIT,
            fn (): array => $this->runQuestionnaireDraft($cleanPrompt),
            3600,
        );

        if ($result === false) {
            abort(429, 'Генерация анкеты доступна 10 раз в час. Попробуйте позже.');
        }

        return $result;
    }

    /**
     * Выполнить генерацию черновика через агента и почистить поля.
     *
     * @param  string  $prompt  уже очищенный промпт
     * @return array{goal: string|null, custom_goal: string|null, about: string, interests: string[]}
     */
    private function runQuestionnaireDraft(string $prompt): array
    {
        $providers = $this->failoverProviders('ai.providers.openrouter.models.text.default');

        $response = (new QuestionnaireDraftAgent)->prompt(
            'Опиши анкету: '.$prompt,
            provider: $providers,
            timeout: self::QUESTIONNAIRE_TIMEOUT,
        );

        $draft = $response->toArray();

        $goal = isset($draft['goal']) ? (string) $draft['goal'] : null;
        $goal = in_array($goal, self::QUESTIONNAIRE_GOALS, true) ? $goal : null;

        $customGoal = isset($draft['custom_goal']) ? trim((string) $draft['custom_goal']) : '';
        $customGoal = $customGoal !== '' ? mb_substr($customGoal, 0, 60) : null;

        $about = mb_substr(trim((string) ($draft['about'] ?? '')), 0, 1000);

        $interests = $this->stringList($draft['interests'] ?? []);
        $lowered = [];

        foreach ($interests as $interest) {
            $tag = mb_strtolower(trim($interest));

            if ($tag !== '' && ! in_array($tag, $lowered, true)) {
                $lowered[] = mb_substr($tag, 0, 40);
            }

            if (count($lowered) >= 10) {
                break;
            }
        }

        ContentModeration::assertClean($about, $customGoal, ...$lowered);

        return [
            'goal' => $goal,
            'custom_goal' => $customGoal,
            'about' => $about,
            'interests' => $lowered,
        ];
    }

    /**
     * Спросить агента-модератора и привести ответ к вердикту.
     *
     * @param  string  $text  уже очищенный текст
     * @return array{is_toxic: bool, category: string|null, confidence: string|null, reason: string|null, source: string}
     */
    private function askSafetyAgent(string $text): array
    {
        $prompt = 'Оцени текст: '.$text;
        $providers = $this->failoverProviders('ai.providers.openrouter.models.text.safety');

        $response = (new TextSafetyAgent)->prompt(
            $prompt,
            provider: $providers,
            timeout: self::SAFETY_TIMEOUT,
        );

        $verdict = $response->toArray();

        return [
            'is_toxic' => (bool) ($verdict['is_toxic'] ?? false),
            'category' => isset($verdict['category']) ? (string) $verdict['category'] : null,
            'confidence' => isset($verdict['confidence']) ? (string) $verdict['confidence'] : null,
            'reason' => isset($verdict['reason']) ? (string) $verdict['reason'] : null,
            'source' => 'ai',
        ];
    }

    /**
     * Подготовить агента гида: продолжить диалог или взять последний.
     *
     * @param  User  $user  участник диалога
     * @param  string|null  $conversationId  id диалога из agent_conversations
     * @return AppGuideAgent настроенный агент
     */
    private function guideAgentFor(User $user, ?string $conversationId): AppGuideAgent
    {
        $agent = new AppGuideAgent($user);

        if ($conversationId === null) {
            return $agent->continueLastConversation($user);
        }

        $this->ensureOwnConversation($user, $conversationId);

        return $agent->continue($conversationId, as: $user);
    }

    /**
     * Быстрые команды гида: чипы статей из базы знаний под модули пользователя.
     *
     * Чипом становится только статья с meta.quick=true и видимым
     * по гейту модулем. Порядок — как в сидере (от базового к частному).
     *
     * @param  User  $user  владелец модулей
     * @param  int  $limit  максимум чипов
     * @return list<array{icon: string, label: string, question: string, module: string|null}>
     */
    public function quickCommands(User $user, int $limit = 12): array
    {
        $safeLimit = min(max($limit, 1), 24);

        $pages = ReferencePage::query()
            ->published()
            ->orderBy('id')
            ->limit(80)
            ->get(['title', 'meta']);

        $commands = [];

        foreach ($pages as $page) {
            $meta = $page->meta;

            if (! is_array($meta) || ($meta['quick'] ?? null) !== true) {
                continue;
            }

            $module = $meta['module'] ?? null;
            $module = is_string($module) && $module !== '' ? $module : null;

            if (! $this->isModuleVisible($user, $module)) {
                continue;
            }

            $question = $meta['question'] ?? null;
            $question = is_string($question) && trim($question) !== '' ? $question : $page->title;

            $icon = $meta['icon'] ?? null;
            $icon = is_string($icon) && $icon !== '' ? $icon : '❓';

            $commands[] = [
                'icon' => $icon,
                'label' => (string) $page->title,
                'question' => $question,
                'module' => $module,
            ];

            if (count($commands) >= $safeLimit) {
                break;
            }
        }

        return $commands;
    }

    /**
     * Виден ли раздел с меткой модуля текущему пользователю.
     *
     * @param  User  $user  проверяемый владелец
     * @param  string|null  $module  метка модуля либо null для общих
     */
    private function isModuleVisible(User $user, ?string $module): bool
    {
        if ($module === null) {
            return true;
        }

        if (! in_array($module, User::allModules(), true)) {
            return false;
        }

        try {
            return $user->hasModule($module);
        } catch (Throwable) {
            return $module === 'ulove';
        }
    }

    /**
     * Базовый запрос AI-диалогов пользователя.
     *
     * Не $user->conversations(): это связь чатов (belongsToMany),
     * AI-диалоги лежат в agent_conversations с морф-участником.
     *
     * @param  User  $user  владелец диалогов
     * @return Builder<AiConversation>
     */
    private function aiConversationQuery(User $user): Builder
    {
        return AiConversation::where('participant_type', $user->getMorphClass())
            ->where('participant_id', $user->getKey());
    }

    /**
     * Убедиться, что диалог принадлежит пользователю.
     *
     * @param  User  $user  проверяемый владелец
     * @param  string  $conversationId  id диалога
     */
    private function ensureOwnConversation(User $user, string $conversationId): void
    {
        $ownsConversation = $this->aiConversationQuery($user)
            ->where('id', $conversationId)
            ->exists();

        if (! $ownsConversation) {
            abort(403, 'Чужой диалог.');
        }
    }

    /**
     * Убедиться, что OpenRouter-ключ задан, иначе 503 с понятным текстом.
     */
    private function ensureConfigured(): void
    {
        $key = (string) config('ai.providers.openrouter.key', '');

        if ($key === '') {
            abort(503, 'AI-ассистент не настроен: задайте OPENROUTER_API_KEY.');
        }
    }

    /**
     * Выполнить разбор профиля через агента-коуча.
     *
     * @param  User  $user  чей профиль разбираем
     * @return array{score: int, strengths: string[], fixes: string[], bio_variants: string[], icebreakers: string[]}
     */
    private function runProfileAnalysis(User $user): array
    {
        $prompt = $this->buildProfilePrompt($user);
        $providers = $this->failoverProviders('ai.providers.openrouter.models.text.smartest');

        $response = (new ProfileCoachAgent)->prompt($prompt, provider: $providers, timeout: self::PROFILE_TIMEOUT);
        $analysis = $response->toArray();

        return [
            'score' => (int) ($analysis['score'] ?? 0),
            'strengths' => $this->stringList($analysis['strengths'] ?? []),
            'fixes' => $this->stringList($analysis['fixes'] ?? []),
            'bio_variants' => $this->stringList($analysis['bio_variants'] ?? []),
            'icebreakers' => $this->stringList($analysis['icebreakers'] ?? []),
        ];
    }

    /**
     * Список диалогов пользователя с гидом (для восстановления после перезагрузки).
     *
     * @param  User  $user  владелец диалогов
     * @param  int  $limit  сколько диалогов отдать
     * @return list<array{id: string, title: string, updated_at: string|null}>
     */
    public function listConversations(User $user, int $limit = 20): array
    {
        $safeLimit = min(max($limit, 1), 50);

        // Не $user->conversations(): это связь чатов (belongsToMany),
        // AI-диалоги лежат в agent_conversations с морф-участником.
        $conversations = $this->aiConversationQuery($user)
            ->latest('updated_at')
            ->limit($safeLimit)
            ->get(['id', 'title', 'updated_at']);

        return $conversations->map(fn (AiConversation $conversation): array => [
            'id' => (string) $conversation->id,
            'title' => (string) $conversation->title,
            'updated_at' => $conversation->updated_at?->toISOString(),
        ])->all();
    }

    /**
     * Сообщения диалога в хронологическом порядке (чужой диалог — 403).
     *
     * @param  User  $user  владелец диалога
     * @param  string  $conversationId  id из agent_conversations
     * @param  int  $limit  сколько последних сообщений отдать
     * @return list<array{role: string, text: string, at: string|null}>
     */
    public function conversationMessages(User $user, string $conversationId, int $limit = 50): array
    {
        $this->ensureOwnConversation($user, $conversationId);

        $safeLimit = min(max($limit, 1), 100);

        $rows = AiConversation::where('id', $conversationId)
            ->firstOrFail()
            ->messages()
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($safeLimit)
            ->get(['role', 'content', 'created_at']);

        $chronological = $rows->reverse()->values();

        $withText = $chronological->filter(
            fn ($message): bool => trim((string) $message->content) !== '' || (string) $message->role === 'user'
        );

        return $withText->values()->map(fn ($message): array => [
            'role' => (string) $message->role,
            'text' => (string) $message->content,
            'at' => $message->created_at?->toISOString(),
        ])->all();
    }

    /**
     * Сохранить оценку ответа гида (сигнал для улучшения базы знаний).
     *
     * @param  User  $user  автор оценки
     * @param  string  $conversationId  оцениваемый диалог
     * @param  int  $rating  1 — помогло, -1 — не помогло
     * @param  string|null  $comment  необязательный комментарий
     * @return array{id: int, rating: int}
     */
    public function rateAnswer(User $user, string $conversationId, int $rating, ?string $comment = null): array
    {
        $this->ensureOwnConversation($user, $conversationId);

        $cleanComment = $comment === null ? null : mb_substr(trim($comment), 0, 500);
        $cleanComment = $cleanComment === '' ? null : $cleanComment;

        $feedback = AiGuideFeedback::create([
            'user_id' => $user->getKey(),
            'conversation_id' => $conversationId,
            'rating' => $rating,
            'comment' => $cleanComment,
        ]);

        return [
            'id' => $feedback->getKey(),
            'rating' => $feedback->rating,
        ];
    }

    /**
     * Собрать цепочку провайдеров: OpenRouter основной, Zen запасным при наличии ключа.
     *
     * Формат «имя => модель» даёт каждому провайдеру свою модель:
     * SDK перебирает их по порядку при сетевых/лимитных ошибках.
     *
     * @param  string  $openRouterModelKey  ключ конфига модели OpenRouter
     * @return array<string, string> провайдер => модель
     */
    private function failoverProviders(string $openRouterModelKey): array
    {
        $model = (string) config($openRouterModelKey, 'nvidia/nemotron-3.5-lightning:free');
        $providers = ['openrouter' => $model];

        $zenKey = (string) config('ai.providers.zen.key', '');

        if ($zenKey !== '') {
            $zenModel = (string) config('ai.providers.zen.models.text.default', 'mimo-v2.6-flash-free');
            $providers['zen'] = $zenModel;
        }

        return $providers;
    }

    /**
     * Собрать промпт с данными анкеты без приватных полей.
     *
     * @param  User  $user  владелец анкеты
     * @return string промпт для коуча
     */
    private function buildProfilePrompt(User $user): string
    {
        $bio = mb_substr((string) ($user->bio ?? ''), 0, 500);
        $about = mb_substr((string) ($user->dating_about ?? ''), 0, 500);
        $thought = mb_substr((string) ($user->thought ?? ''), 0, 140);

        $interests = $user->dating_interests;
        $interestsText = is_array($interests) ? implode(', ', $interests) : (string) ($interests ?? '');
        $interestsText = mb_substr($interestsText, 0, 300);

        $goal = mb_substr((string) ($user->dating_goal ?? ''), 0, 120);

        return "Разбери анкету.\n"
            ."Описание: {$bio}\n"
            ."О себе: {$about}\n"
            ."Мысль профиля: {$thought}\n"
            ."Интересы: {$interestsText}\n"
            ."Цель: {$goal}";
    }

    /**
     * Привести mixed-значение к списку строк.
     *
     * @param  mixed  $value  значение из structured output
     * @return string[] очищенный список
     */
    private function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $strings = array_map(static fn ($item): string => trim((string) $item), $value);
        $filled = array_filter($strings, static fn (string $item): bool => $item !== '');

        return array_values($filled);
    }

    /**
     * Ключ кэша вердикта по хэшу текста.
     *
     * @param  string  $text  очищенный текст
     * @return string ключ кэша
     */
    private function safetyCacheKey(string $text): string
    {
        return 'ai:safety:'.sha1($text);
    }

    /**
     * Ключ часового лимита генераций анкеты.
     *
     * @param  User  $user  владелец лимита
     * @return string ключ лимита
     */
    private function questionnaireLimitKey(User $user): string
    {
        return 'ai:questionnaire:'.$user->getKey();
    }

    /**
     * Вердикт «чисто».
     *
     * @param  string  $source  empty|fallback|ai
     * @return array{is_toxic: bool, category: null, confidence: null, reason: null, source: string}
     */
    private function cleanVerdict(string $source): array
    {
        return [
            'is_toxic' => false,
            'category' => null,
            'confidence' => null,
            'reason' => null,
            'source' => $source,
        ];
    }

    /**
     * Вердикт «токсично».
     *
     * @param  string  $category  категория нарушения
     * @param  string|null  $reason  обоснование
     * @param  string  $source  regex|ai
     * @return array{is_toxic: bool, category: string, confidence: string|null, reason: string|null, source: string}
     */
    private function toxicVerdict(string $category, ?string $reason, string $source): array
    {
        return [
            'is_toxic' => true,
            'category' => $category,
            'confidence' => $source === 'regex' ? 'high' : null,
            'reason' => $reason,
            'source' => $source,
        ];
    }
}
