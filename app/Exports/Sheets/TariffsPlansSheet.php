<?php

namespace App\Exports\Sheets;

use App\Services\PlanCatalog;
use App\Services\TariffsExcelLabels;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Лист «Тарифы»: названия, описания и все три цены как видят люди.
 *
 * Цена одна для всех стран: месяц, год, неделя. Пустой месяц = «Бесплатно»,
 * пустые год/неделя = «Нет» (периода нет).
 *
 * Первая колонка — технический ID (free/pro/…): по нему импорт понимает,
 * какую строку обновлять, даже если название поменяли. Серый фон колонки
 * подсказывает «не трогайте без нужды».
 *
 * Интерактив: закреплённая шапка, фильтры, выпадающий список «Для кого»,
 * денежный формат цен, цвет названия по тарифу, статус ручных правок
 * цветом, живые итоги количества возможностей формулами COUNTIF.
 */
class TariffsPlansSheet implements FromArray, WithHeadings, WithTitle, WithStyles, WithColumnWidths, WithEvents
{
    /**
     * Цвет шапки.
     */
    private const HEADER_FILL = '0F172A';

    /**
     * Цвет технических клеток (ID тарифа).
     */
    private const KEY_FILL = 'F1F5F9';

    /**
     * Цвет названия по тарифу.
     *
     * @var array<string, string>
     */
    private const PLAN_FILLS = [
        'free' => 'E2E8F0',
        'pro' => 'D1FAE5',
        'premium' => 'EDE9FE',
        'business' => 'FEF3C7',
    ];

    /**
     * @var list<array<int, mixed>> готовые строки без шапки
     */
    private array $rows;

    /**
     * @var array<string, int> сколько возможностей у тарифа (для итогов)
     */
    private array $featureCounts;

    public function __construct()
    {
        $this->rows = $this->buildRows();
        $this->featureCounts = $this->buildFeatureCounts();
    }

    /**
     * Название вкладки.
     */
    public function title(): string
    {
        return 'Тарифы';
    }

    /**
     * Заголовки колонок.
     *
     * @return list<string>
     */
    public function headings(): array
    {
        return TariffsExcelLabels::PLANS_HEADERS;
    }

    /**
     * Строки тарифов.
     *
     * @return list<array<int, mixed>>
     */
    public function array(): array
    {
        return $this->rows;
    }

    /**
     * Ширина колонок: описание широкое с переносом, цены узкие.
     *
     * @return array<string, float|int>
     */
    public function columnWidths(): array
    {
        return [
            'A' => 12,
            'B' => 16,
            'C' => 15,
            'D' => 48,
            'E' => 15,
            'F' => 14,
            'G' => 14,
            'H' => 20,
        ];
    }

    /**
     * Статика: тёмная шапка + серая колонка ID.
     *
     * @param Worksheet $sheet лист PhpSpreadsheet
     * @return array<int|string, array<string, mixed>>|null
     */
    public function styles(Worksheet $sheet): ?array
    {
        $lastRow = count($this->rows) + 1;

        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::HEADER_FILL]],
                'alignment' => ['vertical' => 'center', 'wrapText' => true],
            ],
            "A2:A{$lastRow}" => [
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::KEY_FILL]],
                'font' => ['color' => ['rgb' => '64748B'], 'italic' => true],
            ],
        ];
    }

    /**
     * Динамика: фильтры, заморозка, деньги, цвета, списки, итоги.
     *
     * @return array<string, callable>
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $lastRow = count($this->rows) + 1;

                if ($lastRow < 2) {
                    return;
                }

                $sheet->freezePane('A2');
                $sheet->setAutoFilter("A1:H{$lastRow}");
                $sheet->getRowDimension(1)->setRowHeight(30);

                foreach (range(2, $lastRow) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(28);
                }

                $sheet->getStyle("D2:D{$lastRow}")->getAlignment()->setWrapText(true);
                $sheet->getStyle("D2:D{$lastRow}")->getAlignment()->setVertical('center');

                foreach (['E', 'F', 'G'] as $column) {
                    $sheet->getStyle("{$column}2:{$column}{$lastRow}")
                        ->getNumberFormat()
                        ->setFormatCode('"$"#,##0.00');
                }

                $this->paintPlanNames($sheet, $lastRow);
                $this->paintStatus($sheet, $lastRow);
                $this->addAudienceValidation($sheet, $lastRow);
                $this->addHeaderComments($sheet);
                $this->writeTotals($sheet, $lastRow);

                $sheet->getSheetView()->setZoomScale(100);
                $sheet->getTabColor()->setRGB('10B981');
                $sheet->getPageSetup()->setFitToPage(true);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setFitToHeight(0);
                $sheet->getPageSetup()->setOrientation('landscape');
                $sheet->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(1, 1);
            },
        ];
    }

    /**
     * Собрать строки тарифов: ID + живые название/описание/цены/статус.
     *
     * @return list<array<int, mixed>>
     */
    private function buildRows(): array
    {
        $catalog = PlanCatalog::plans();
        $priceOverrides = PlanCatalog::priceOverrides();
        $metaOverrides = PlanCatalog::metaOverrides();
        $audienceMap = TariffsExcelLabels::audienceMap();

        $rows = [];

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $info = $catalog[$plan] ?? [];

            $rows[] = [
                $plan,
                (string) ($info['name'] ?? $plan),
                $audienceMap[$info['audience'] ?? 'users'] ?? 'Для всех',
                (string) ($info['tagline'] ?? ''),
                $this->exportPrice(PlanCatalog::monthlyPrice($plan), 'Бесплатно'),
                $this->exportPrice(PlanCatalog::periodPrice($plan, 'yearly'), 'Нет'),
                $this->exportPrice(PlanCatalog::periodPrice($plan, 'weekly'), 'Нет'),
                $this->planSource($plan, $priceOverrides, $metaOverrides),
            ];
        }

        return $rows;
    }

    /**
     * Посчитать возможности по тарифам для блока итогов.
     *
     * @return array<string, int>
     */
    private function buildFeatureCounts(): array
    {
        $counts = [
            'free' => 0,
            'pro' => 0,
            'premium' => 0,
            'business' => 0,
        ];

        foreach ($counts as $plan => $zero) {
            $counts[$plan] = count(PlanCatalog::featuresForPlan($plan));
        }

        return $counts;
    }

    /**
     * Цена в клетку: число либо понятное слово (импорт поймёт оба).
     *
     * @param float|null $value цена
     * @param string $empty слово вместо пустоты
     */
    private function exportPrice(?float $value, string $empty): mixed
    {
        if ($value === null) {
            return $empty;
        }

        return $value;
    }

    /**
     * Откуда цены тарифа: меняли ли вручную в админке.
     *
     * @param string $plan тариф
     * @param array<string, float|null> $priceOverrides правки цен
     * @param array<string, array{name?:string,tagline?:string}> $metaOverrides правки описаний
     */
    private function planSource(string $plan, array $priceOverrides, array $metaOverrides): string
    {
        foreach (['monthly', 'yearly', 'weekly'] as $period) {
            $key = $plan.'.'.$period;

            if (array_key_exists($key, $priceOverrides) && $priceOverrides[$key] !== null) {
                return 'Изменены вручную';
            }
        }

        if (array_key_exists($plan, $metaOverrides)) {
            return 'Изменены вручную';
        }

        return 'Стандартные';
    }

    /**
     * Покрасить названия тарифов их цветами.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function paintPlanNames(Worksheet $sheet, int $lastRow): void
    {
        $row = 2;

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $fill = self::PLAN_FILLS[$plan] ?? 'FFFFFF';

            $sheet->getStyle("B{$row}")->applyFromArray([
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $fill]],
                'font' => ['bold' => true],
            ]);

            $row++;
        }

        if ($row - 1 !== $lastRow) {
            return;
        }
    }

    /**
     * Покрасить статус цен: ручные — янтарь, стандартные — серый.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function paintStatus(Worksheet $sheet, int $lastRow): void
    {
        foreach (range(2, $lastRow) as $row) {
            $value = (string) $sheet->getCell("H{$row}")->getValue();
            $isManual = $value === 'Изменены вручную';

            $sheet->getStyle("H{$row}")->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => $isManual ? 'FEF3C7' : 'F1F5F9'],
                ],
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => $isManual ? '92400E' : '64748B'],
                ],
            ]);
        }
    }

    /**
     * Выпадающий список «Для кого».
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function addAudienceValidation(Worksheet $sheet, int $lastRow): void
    {
        foreach (range(2, $lastRow) as $row) {
            $validation = $sheet->getCell("C{$row}")->getDataValidation();
            $validation->setType(DataValidation::TYPE_LIST);
            $validation->setErrorStyle(DataValidation::STYLE_STOP);
            $validation->setAllowBlank(false);
            $validation->setShowDropDown(false);
            $validation->setShowErrorMessage(true);
            $validation->setErrorTitle('Выберите из списка');
            $validation->setError('Только «Для всех» или «Для компаний».');
            $validation->setFormula1('"Для всех,Для компаний"');
        }
    }

    /**
     * Подсказки к шапке: что писать в ценах и ID.
     *
     * @param Worksheet $sheet лист
     */
    private function addHeaderComments(Worksheet $sheet): void
    {
        $hints = [
            'A1' => 'Технический ID: free, pro, premium, business. Не меняйте — по нему импорт находит строку.',
            'E1' => 'Цена в месяц, одна для всех стран. Число (например 3.99) или «Бесплатно».',
            'F1' => 'Цена сразу за год. «Нет» = периода нет.',
            'G1' => 'Цена на неделю. «Нет» = периода нет.',
            'H1' => 'Служебная колонка: пересчитается сама, при импорте не читается.',
        ];

        foreach ($hints as $cell => $text) {
            $comment = $sheet->getComment($cell);
            $comment->getText()->createTextRun($text);
            $comment->setWidth(220);
            $comment->setHeight(70);
        }
    }

    /**
     * Блок итогов ниже таблицы: сколько возможностей в каждом тарифе.
     *
     * Формулы COUNTIF живые: добавили строку на листе «Что входит» —
     * цифра здесь выросла сама.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function writeTotals(Worksheet $sheet, int $lastRow): void
    {
        $start = $lastRow + 3;
        $sheet->setCellValue("B{$start}", 'Возможностей в тарифе (считается само)');
        $sheet->getStyle("B{$start}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0F172A']],
        ]);

        $names = [
            'free' => 'Free',
            'pro' => 'PRO',
            'premium' => 'Premium',
            'business' => 'Business',
        ];

        $row = $start + 1;

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $planName = $names[$plan] ?? $plan;
            $sheet->setCellValue("B{$row}", "В «{$planName}»");
            $sheet->setCellValue("C{$row}", "=COUNTIF('Что входит'!B:B,\"*{$planName}*\")+COUNTIF('Что входит'!B:B,\"{$plan}\")");
            $sheet->getStyle("B{$row}:C{$row}")->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => self::PLAN_FILLS[$plan] ?? 'FFFFFF'],
                ],
                'font' => ['bold' => true],
            ]);

            $row++;
        }
    }
}
