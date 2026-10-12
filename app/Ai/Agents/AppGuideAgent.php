<?php

namespace App\Ai\Agents;

use App\Ai\Tools\SearchHelpArticles;
use App\Models\User;
use Laravel\Ai\Attributes\Provider;
use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;
use Stringable;
use Throwable;

/**
 * Гид по приложению: отвечает на вопросы пользователя о включённых у него функциях.
 *
 * Факты берёт из справочных страниц через инструмент SearchHelpArticles
 * (инструмент сам скрывает статьи выключенных модулей), историю диалога
 * хранит в таблицах agent_conversations / agent_conversation_messages
 * через трейт RemembersConversations.
 * Продолжение диалога — через continue($conversationId, as: $user).
 */
#[Provider(Lab::OpenRouter)]
class AppGuideAgent implements Agent, Conversational, HasTools
{
    use Promptable;
    use RemembersConversations;

    /**
     * @param  User|null  $user  спрашивающий (его модули задают границы ответов)
     */
    public function __construct(public ?User $user = null) {}

    /**
     * Системные инструкции гида по приложению.
     *
     * @return Stringable|string инструкции на русском языке
     */
    public function instructions(): Stringable|string
    {
        $modules = $this->allowedModules();
        $modulesText = $modules === [] ? 'только базовые функции' : implode(', ', $modules);

        return 'Ты — дружелюбный гид приложения UPin/ULove. '
            ."Пользователю доступны только эти разделы: {$modulesText}. "
            .'Про другие разделы не рассказывай: если спросят — скажи, что раздел пока недоступен '
            .'и появится позже, без подробностей и сроков. '
            .'Когда вопрос касается функций, правил, тарифов или настроек — сначала вызови '
            .'инструмент поиска по справочным страницам и опирайся на найденное. '
            .'Отвечай кратко, по-русски, по шагам. Не выдумывай кнопки, разделы и тарифы: '
            .'если в статьях ответа нет — скажи честно и предложи написать в поддержку. '
            .'Строго запрещено: внутренняя разработка, админка, код, API, база данных, '
            .'неанонсированные функции и любые технические детали сервиса. '
            .'Не проси пароль, не обещай того, чего нет в приложении.';
    }

    /**
     * Инструменты, доступные агенту.
     *
     * @return list<Tool> поиск по базе знаний
     */
    public function tools(): iterable
    {
        return [
            new SearchHelpArticles($this->user),
        ];
    }

    /**
     * Модули, о которых агенту разрешено говорить.
     *
     * @return string[] коды модулей из User::allModules()
     */
    private function allowedModules(): array
    {
        if ($this->user === null) {
            return ['ulove'];
        }

        try {
            $visible = array_filter(
                User::allModules(),
                fn (string $module): bool => $this->user->hasModule($module)
            );

            return array_values($visible);
        } catch (Throwable) {
            return ['ulove'];
        }
    }
}
