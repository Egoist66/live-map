<?php

namespace App\Http\Controllers;

use App\Services\MonitoringService;
use Illuminate\Http\Request;

class AdminMonitoringController extends Controller
{
    public function overview(MonitoringService $monitoring)
    {
        return response()->json($monitoring->overview());
    }

    public function chart(Request $request, MonitoringService $monitoring)
    {
        $days = (int) $request->query('days', 14);
        $days = max(7, min(30, $days));
        return response()->json([
            'days' => $days,
            'points' => $monitoring->chart($days),
            'summary' => $monitoring->chartSummary($days),
        ]);
    }

    public function export(Request $request, MonitoringService $monitoring)
    {
        $days = (int) $request->query('days', 14);
        $days = max(7, min(30, $days));

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('ULove Admin')
            ->setTitle("Мониторинг за $days дней");

        $headerStyle = [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
        ];

        $dynamics = $spreadsheet->getActiveSheet();
        $dynamics->setTitle('Динамика');
        $headers = ['Дата', 'Новые регистрации', 'Активные пользователи', 'Новые пины', 'Всего пользователей'];
        foreach ($headers as $col => $title) {
            $cell = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1).'1';
            $dynamics->setCellValue($cell, $title);
        }
        $dynamics->getStyle('A1:E1')->applyFromArray($headerStyle);
        $row = 2;
        foreach ($monitoring->chart($days) as $p) {
            $dynamics->setCellValue("A$row", $p['date']);
            $dynamics->setCellValue("B$row", $p['registrations']);
            $dynamics->setCellValue("C$row", $p['active']);
            $dynamics->setCellValue("D$row", $p['pins']);
            $dynamics->setCellValue("E$row", $p['total']);
            $row++;
        }
        $dynamics->setCellValue("A$row", 'ИТОГО');
        $dynamics->setCellValue("B$row", "=SUM(B2:B".($row - 1).')');
        $dynamics->setCellValue("C$row", "=SUM(C2:C".($row - 1).')');
        $dynamics->setCellValue("D$row", "=SUM(D2:D".($row - 1).')');
        $dynamics->getStyle("A$row:E$row")->getFont()->setBold(true);
        foreach (range('A', 'E') as $c) $dynamics->getColumnDimension($c)->setAutoSize(true);

        $summarySheet = $spreadsheet->createSheet();
        $summarySheet->setTitle('Сводка');
        $summary = $monitoring->chartSummary($days);
        $overview = $monitoring->overview();
        $lines = [
            ['Период', ($summary['from'] ?? '').' — '.($summary['to'] ?? '')." ($days дн.)"],
            ['Всего пользователей', $overview['total_users']],
            ['Онлайн сейчас', $overview['online_users']],
            ['Новых сегодня / 7д / 30д', $overview['new_today'].' / '.$overview['new_week'].' / '.$overview['new_month']],
            ['Активных сегодня / 7д', $overview['active_today'].' / '.$overview['active_week']],
            ['Регистраций за период', $summary['total_registrations']],
            ['В среднем регистраций в день', $summary['avg_registrations']],
            ['Рост к пред. периоду, %', $summary['registrations_growth_pct']],
            ['Лучший день по регистрациям', ($summary['best_registrations_day']['date'] ?? '—').' ('.($summary['best_registrations_day']['value'] ?? 0).')'],
            ['Лучший день по активности', ($summary['best_active_day']['date'] ?? '—').' ('.($summary['best_active_day']['value'] ?? 0).')'],
            ['Пинов за период (всего / активных)', $summary['total_pins'].' / '.$overview['total_pins'].' / '.$overview['active_pins']],
            ['Жалоб в ожидании', $overview['reports_pending']],
            ['Тарифы', self::formatPlans($overview['plans'] ?? [])],
            ['Сформировано', now()->format('Y-m-d H:i')],
        ];
        $summarySheet->setCellValue('A1', 'Метрика');
        $summarySheet->setCellValue('B1', 'Значение');
        $summarySheet->getStyle('A1:B1')->applyFromArray($headerStyle);
        $r = 2;
        foreach ($lines as [$k, $v]) {
            $summarySheet->setCellValue("A$r", $k);
            $summarySheet->setCellValue("B$r", $v);
            $r++;
        }
        $summarySheet->getColumnDimension('A')->setAutoSize(true);
        $summarySheet->getColumnDimension('B')->setAutoSize(true);

        $onlineSheet = $spreadsheet->createSheet();
        $onlineSheet->setTitle('Онлайн');
        foreach (['ID', 'Имя', 'Email', 'Тариф', 'Был(а) в сети'] as $col => $title) {
            $onlineSheet->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($col + 1).'1', $title);
        }
        $onlineSheet->getStyle('A1:E1')->applyFromArray($headerStyle);
        $orow = 2;
        foreach (\App\Models\User::where('last_seen_at', '>=', MonitoringService::onlineThreshold())->orderByDesc('last_seen_at')->limit(500)->get(['id', 'name', 'email', 'plan', 'last_seen_at']) as $u) {
            $onlineSheet->setCellValue("A$orow", $u->id);
            $onlineSheet->setCellValue("B$orow", $u->name);
            $onlineSheet->setCellValue("C$orow", $u->email);
            $onlineSheet->setCellValue("D$orow", $u->plan);
            $onlineSheet->setCellValue("E$orow", $u->last_seen_at?->format('Y-m-d H:i'));
            $orow++;
        }
        foreach (range('A', 'E') as $c) $onlineSheet->getColumnDimension($c)->setAutoSize(true);

        $spreadsheet->setActiveSheetIndex(0);
        $fileName = 'monitoring-'.$days.'d-'.now()->format('Y-m-d_H-i').'.xlsx';

        return response()->streamDownload(function () use ($spreadsheet) {
            (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet))->save('php://output');
        }, $fileName, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private static function formatPlans(mixed $plans): string
    {
        $items = $plans instanceof \Traversable ? iterator_to_array($plans) : (is_array($plans) ? $plans : []);
        if ($items instanceof \Illuminate\Support\Collection) $items = $items->all();
        if (! is_array($items)) return '';
        $parts = [];
        foreach ($items as $key => $value) {
            if (is_array($value)) {
                $name = $value['plan'] ?? $value['name'] ?? $key;
                $count = $value['c'] ?? $value['count'] ?? $value['total'] ?? reset($value);
                $parts[] = (is_array($name) || is_array($count)) ? json_encode($value, JSON_UNESCAPED_UNICODE) : "$name: $count";
            } else {
                $parts[] = "$key: $value";
            }
        }
        return implode(', ', $parts);
    }

    public function online(Request $request, MonitoringService $monitoring)
    {
        $data = $request->validate([
            'per_page' => 'nullable|integer|min:5|max:100',
            'q' => 'nullable|string|max:100',
        ]);
        $paginator = $monitoring->online(
            (int) ($data['per_page'] ?? 20),
            $data['q'] ?? null
        );

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'threshold_minutes' => MonitoringService::ONLINE_MINUTES,
        ]);
    }

    public function users(Request $request, MonitoringService $monitoring)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'filter' => 'nullable|in:all,online,new,hidden,admins,organizations',
            'sort' => 'nullable|in:last_seen,newest,oldest,name',
            'per_page' => 'nullable|integer|min:10|max:100',
        ]);
        $paginator = $monitoring->users(
            $data['q'] ?? null,
            $data['filter'] ?? 'all',
            $data['sort'] ?? 'last_seen',
            (int) ($data['per_page'] ?? 20)
        );

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
