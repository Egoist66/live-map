<?php

namespace App\Http\Controllers;

use App\Services\ProfileStatsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Статистика профиля: сводка по тарифу и выгрузка CSV.
 *
 * Free видит базу (время в приложении, лайки неделя/месяц,
 * просмотры, мэтчи). Pro — плюс разрез аудитории
 * (интересы/возраст/пол лайкнувших). Premium — плюс
 * конкретных гостей страницы с анкетой и кнопкой «написать».
 */
class ProfileStatsController extends Controller
{
    /**
     * Сводка статистики текущего пользователя.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(ProfileStatsService::summary($user));
    }

    /**
     * Выгрузка статистики в CSV (кодировка UTF-8 с BOM).
     *
     * Состав файла зависит от тарифа — тот же гейт,
     * что и в summary().
     *
     * @param Request $request
     * @return StreamedResponse
     */
    public function export(Request $request): StreamedResponse
    {
        $user = $request->user();
        $csv = ProfileStatsService::exportCsv($user);

        $filename = 'profile-stats-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($csv) {
            echo $csv;
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * Записать просмотр чужого профиля (SPA открывает
     * страницу без перезагрузки — фронт дергает явно).
     *
     * Свои просмотры игнорируются внутри сервиса.
     *
     * @param Request $request
     * @param int $user id просматриваемого профиля
     * @return JsonResponse
     */
    public function trackView(Request $request, int $user): JsonResponse
    {
        ProfileStatsService::recordView($request->user(), $user);

        return response()->json(['ok' => true]);
    }

    /**
     * Тумблер «уведомлять о гостях профиля» (PRO и выше).
     *
     * Управляет сразу обоими каналами: колокольчик в приложении
     * (realtime + пуш) и письмо Telegram-бота.
     *
     * @param Request $request запрос с notify_profile_visitors
     * @return JsonResponse
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user->canUseVisitorNotifications(), 403, 'Уведомления о гостях — на тарифе PRO и выше');

        $data = $request->validate([
            'notify_profile_visitors' => ['required', 'boolean'],
        ]);

        $user->forceFill([
            'notify_profile_visitors' => (bool) $data['notify_profile_visitors'],
        ])->save();

        return response()->json([
            'notify_profile_visitors' => (bool) $user->notify_profile_visitors,
        ]);
    }
}
