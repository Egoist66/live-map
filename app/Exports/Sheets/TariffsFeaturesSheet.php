<?php

namespace App\Exports\Sheets;

use App\Models\PaymentItem;
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
 * Лист «Что входит»: какая возможность в каком тарифе и видна ли.
 *
 * Колонка «Ключ» — техническая (серый фон): по ней импорт обновляет строку,
 * даже если всё удалили, а потом вернули файл обратно. Пустой ключ = новая
 * строка, ключ придумается сам при загрузке.
 *
 * Интерактив: цвет тарифа в колонке B, «да» — зелёным / «нет» — красным,
 * выпадающие списки тарифа и видимости, фильтры, заморозка, подсказки.
 */
class TariffsFeaturesSheet implements FromArray, WithHeadings, WithTitle, WithStyles, WithColumnWidths, WithEvents
{
    /**
     * Цвет шапки.
     */
    private const HEADER_FILL = '0F172A';

    /**
     * Цвет технических клеток (ключи).
     */
    private const KEY_FILL = 'F1F5F9';

    /**
     * Цвет тарифа в колонке B.
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
     * @var array<int, string> план строки (для покраски)
     */
    private array $rowPlans;

    /**
     * @var array<int, bool> видимость строки (для покраски)
     */
    private array $rowVisible;

    public function __construct()
    {
        [$this->rows, $this->rowPlans, $this->rowVisible] = $this->buildRows();
    }

    /**
     * Название вкладки.
     */
    public function title(): string
    {
        return 'Что входит';
    }

    /**
     * Заголовки колонок.
     *
     * @return list<string>
     */
    public function headings(): array
    {
        return TariffsExcelLabels::FEATURES_HEADERS;
    }

    /**
     * Строки возможностей.
     *
     * @return list<array<int, mixed>>
     */
    public function array(): array
    {
        return $this->rows;
    }

    /**
     * Ширина колонок.
     *
     * @return array<string, float|int>
     */
    public function columnWidths(): array
    {
        return [
            'A' => 22,
            'B' => 16,
            'C' => 34,
            'D' => 48,
            'E' => 15,
            'F' => 10,
        ];
    }

    /**
     * Статика: тёмная шапка + серая колонка ключей.
     *
     * @param Worksheet $sheet лист PhpSpreadsheet
     * @return array<int|string, array<string, mixed>>|null
     */
    public function styles(Worksheet $sheet): ?array
    {
        $lastRow = count($this->rows) + 1;

        $styles = [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::HEADER_FILL]],
                'alignment' => ['vertical' => 'center', 'wrapText' => true],
            ],
        ];

        if ($lastRow >= 2) {
            $styles["A2:A{$lastRow}"] = [
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::KEY_FILL]],
                'font' => ['color' => ['rgb' => '64748B'], 'italic' => true, 'size' => 10],
            ];
        }

        return $styles;
    }

    /**
     * Динамика: фильтры, цвета, списки, подсказки.
     *
     * @return array<string, callable>
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                $sheet = $event->sheet->getDelegate();
                $lastRow = count($this->rows) + 1;

                $sheet->freezePane('A2');
                $sheet->getRowDimension(1)->setRowHeight(30);
                $sheet->getTabColor()->setRGB('3B82F6');
                $sheet->getPageSetup()->setFitToPage(true);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setFitToHeight(0);
                $sheet->getPageSetup()->setOrientation('landscape');
                $sheet->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(1, 1);

                if ($lastRow < 2) {
                    return;
                }

                $sheet->setAutoFilter("A1:F{$lastRow}");

                foreach (range(2, $lastRow) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(26);
                }

                $sheet->getStyle("D2:D{$lastRow}")->getAlignment()->setWrapText(true);
                $sheet->getStyle("D2:D{$lastRow}")->getAlignment()->setVertical('center');

                $this->paintPlans($sheet, $lastRow);
                $this->paintVisibility($sheet, $lastRow);
                $this->addValidations($sheet, $lastRow);
                $this->addHeaderComments($sheet);

                $sheet->getSheetView()->setZoomScale(100);
            },
        ];
    }

    /**
     * Собрать строки: ключ, живой тариф, название, пояснение, да/нет, порядок.
     *
     * Сначала фишки с тарифами (группами по тарифам), в конце — потеряшки
     * без тарифа и без цены с прочерком (разовые с ценой живут на листе
     * «Витрина»). Иначе круговое восстановление их потеряет.
     *
     * @return array{0: list<array<int, mixed>>, 1: array<int, string>, 2: array<int, bool>}
     */
    private function buildRows(): array
    {
        $catalog = PlanCatalog::plans();

        $features = PaymentItem::where('kind', 'feature')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $grouped = [
            'free' => [],
            'pro' => [],
            'premium' => [],
            'business' => [],
        ];

        $homeless = [];

        foreach ($features as $feature) {
            $payload = is_array($feature->payload) ? $feature->payload : [];
            $linked = [];

            if (isset($payload['plan']) && is_string($payload['plan'])) {
                $linked[] = $payload['plan'];
            }

            if (isset($payload['plans']) && is_array($payload['plans'])) {
                foreach ($payload['plans'] as $planId) {
                    if (is_string($planId)) {
                        $linked[] = $planId;
                    }
                }
            }

            $known = array_values(array_filter(
                array_unique($linked),
                static fn (string $planId): bool => array_key_exists($planId, $grouped)
            ));

            if ($known === []) {
                if ($feature->price !== null) {
                    continue;
                }

                $homeless[] = $feature;
                continue;
            }

            foreach ($known as $planId) {
                $grouped[$planId][] = $feature;
            }
        }

        $rows = [];
        $rowPlans = [];
        $rowVisible = [];
        $index = 0;

        $push = function (object $feature, string $plan, string $planName) use (&$rows, &$rowPlans, &$rowVisible, &$index): void {
            $visible = (bool) $feature->is_active;

            $rows[] = [
                (string) $feature->key,
                $planName,
                (string) $feature->name,
                (string) ($feature->description ?? ''),
                $visible ? 'да' : 'нет',
                (int) ($feature->sort_order ?? 0),
            ];

            $rowPlans[$index] = $plan;
            $rowVisible[$index] = $visible;
            $index++;
        };

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $planName = (string) ($catalog[$plan]['name'] ?? $plan);

            if ($grouped[$plan] === []) {
                continue;
            }

            foreach ($grouped[$plan] as $feature) {
                $push($feature, $plan, $planName);
            }
        }

        foreach ($homeless as $feature) {
            $push($feature, '', '—');
        }

        return [$rows, $rowPlans, $rowVisible];
    }

    /**
     * Покрасить тарифы их цветами.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function paintPlans(Worksheet $sheet, int $lastRow): void
    {
        foreach (range(2, $lastRow) as $row) {
            $plan = $this->rowPlans[$row - 2] ?? null;
            $fill = self::PLAN_FILLS[$plan ?? ''] ?? 'FFFFFF';

            $sheet->getStyle("B{$row}")->applyFromArray([
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $fill]],
                'font' => ['bold' => true],
            ]);
        }
    }

    /**
     * Покрасить видимость: «да» — зелёным, «нет» — красным.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function paintVisibility(Worksheet $sheet, int $lastRow): void
    {
        foreach (range(2, $lastRow) as $row) {
            $visible = $this->rowVisible[$row - 2] ?? true;

            $sheet->getStyle("E{$row}")->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => $visible ? 'D1FAE5' : 'FEE2E2'],
                ],
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => $visible ? '065F46' : '991B1B'],
                ],
                'alignment' => ['horizontal' => 'center'],
            ]);
        }
    }

    /**
     * Выпадающие списки: тариф и видимость.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function addValidations(Worksheet $sheet, int $lastRow): void
    {
        $catalog = PlanCatalog::plans();
        $names = [];

        foreach (TariffsExcelLabels::PLAN_ORDER as $plan) {
            $names[] = (string) ($catalog[$plan]['name'] ?? $plan);
        }

        $planList = '"'.implode(',', array_map(
            static fn (string $name): string => str_replace(',', '‚', $name),
            array_merge($names, TariffsExcelLabels::PLAN_ORDER, ['—'])
        )).'"';

        foreach (range(2, $lastRow) as $row) {
            $planValidation = $sheet->getCell("B{$row}")->getDataValidation();
            $planValidation->setType(DataValidation::TYPE_LIST);
            $planValidation->setErrorStyle(DataValidation::STYLE_STOP);
            $planValidation->setAllowBlank(false);
            $planValidation->setShowDropDown(false);
            $planValidation->setShowErrorMessage(true);
            $planValidation->setErrorTitle('Выберите тариф');
            $planValidation->setError('Тариф из списка: название или free/pro/premium/business.');
            $planValidation->setFormula1($planList);

            $visibleValidation = $sheet->getCell("E{$row}")->getDataValidation();
            $visibleValidation->setType(DataValidation::TYPE_LIST);
            $visibleValidation->setErrorStyle(DataValidation::STYLE_STOP);
            $visibleValidation->setAllowBlank(false);
            $visibleValidation->setShowDropDown(false);
            $visibleValidation->setShowErrorMessage(true);
            $visibleValidation->setErrorTitle('Только да или нет');
            $visibleValidation->setError('Напишите «да» (показывать) или «нет» (скрыть).');
            $visibleValidation->setFormula1('"да,нет"');
        }
    }

    /**
     * Подсказки к шапке.
     *
     * @param Worksheet $sheet лист
     */
    private function addHeaderComments(Worksheet $sheet): void
    {
        $hints = [
            'A1' => 'Технический ключ строки (латиница). Не меняйте у старых строк — по нему импорт обновляет, а не дублирует. У новой строки оставьте пусто — ключ придумается сам.',
            'B1' => 'В каком тарифе показывать. Можно названием (PRO) или кодом (pro). Прочерк — ни в каком (потеряшка).',
            'E1' => '«да» — видно в тарифе, «нет» — скрыто, но не удалено.',
            'F1' => 'Порядок внутри тарифа: меньше — выше. Можно оставить пусто.',
        ];

        foreach ($hints as $cell => $text) {
            $comment = $sheet->getComment($cell);
            $comment->getText()->createTextRun($text);
            $comment->setWidth(240);
            $comment->setHeight(80);
        }
    }
}
