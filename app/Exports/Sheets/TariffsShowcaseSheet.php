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
 * Лист «Витрина»: разовые товары с ценами под каждый тариф.
 *
 * Колонка «Ключ» — техническая (серый фон): по ней импорт обновляет товар,
 * даже если витрину полностью очистили, а потом вернули файл обратно.
 * Цены «Для …» пустые или «Как всем» = обычная цена из колонки «Цена».
 *
 * Интерактив: деньги форматом $#,##0.00, «В продаже» зелёным/красным,
 * выпадающие списки раздела/вида/периода/продажи, фильтры, заморозка.
 */
class TariffsShowcaseSheet implements FromArray, WithHeadings, WithTitle, WithStyles, WithColumnWidths, WithEvents
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
     * @var list<array<int, mixed>> готовые строки без шапки
     */
    private array $rows;

    /**
     * @var array<int, bool> в продаже ли строка (для покраски)
     */
    private array $rowActive;

    public function __construct()
    {
        [$this->rows, $this->rowActive] = $this->buildRows();
    }

    /**
     * Название вкладки.
     */
    public function title(): string
    {
        return 'Витрина';
    }

    /**
     * Заголовки колонок.
     *
     * @return list<string>
     */
    public function headings(): array
    {
        return TariffsExcelLabels::SHOWCASE_HEADERS;
    }

    /**
     * Строки витрины.
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
            'A' => 20,
            'B' => 26,
            'C' => 44,
            'D' => 16,
            'E' => 20,
            'F' => 12,
            'G' => 17,
            'H' => 12,
            'I' => 12,
            'J' => 14,
            'K' => 14,
            'L' => 12,
            'M' => 10,
            'N' => 30,
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
            $styles["N2:N{$lastRow}"] = [
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => self::KEY_FILL]],
                'font' => ['color' => ['rgb' => '64748B'], 'size' => 9],
            ];
        }

        return $styles;
    }

    /**
     * Динамика: фильтры, деньги, цвета, списки.
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
                $sheet->getRowDimension(1)->setRowHeight(44);
                $sheet->getTabColor()->setRGB('8B5CF6');
                $sheet->getPageSetup()->setFitToPage(true);
                $sheet->getPageSetup()->setFitToWidth(1);
                $sheet->getPageSetup()->setFitToHeight(0);
                $sheet->getPageSetup()->setOrientation('landscape');
                $sheet->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(1, 1);

                if ($lastRow < 2) {
                    return;
                }

                $sheet->setAutoFilter("A1:N{$lastRow}");

                foreach (range(2, $lastRow) as $row) {
                    $sheet->getRowDimension($row)->setRowHeight(28);
                }

                $sheet->getStyle("C2:C{$lastRow}")->getAlignment()->setWrapText(true);
                $sheet->getStyle("C2:C{$lastRow}")->getAlignment()->setVertical('center');

                foreach (['F', 'H', 'I', 'J', 'K'] as $column) {
                    $sheet->getStyle("{$column}2:{$column}{$lastRow}")
                        ->getNumberFormat()
                        ->setFormatCode('"$"#,##0.00');
                }

                $this->paintActive($sheet, $lastRow);
                $this->addValidations($sheet, $lastRow);
                $this->addHeaderComments($sheet);

                $sheet->getSheetView()->setZoomScale(90);
            },
        ];
    }

    /**
     * Собрать строки витрины: товары плюс разовые фишки без тарифа.
     *
     * Возможности с привязкой к тарифу живут на листе «Что входит».
     * А разовые фишки без тарифа (есть цена, нет привязки — как суперлайк
     * за кредиты) — это товары: показываем здесь с их видом, модулем,
     * ценой и остатками payload, иначе круговое восстановление их потеряет.
     *
     * @return array{0: list<array<int, mixed>>, 1: array<int, bool>}
     */
    private function buildRows(): array
    {
        $moduleMap = TariffsExcelLabels::moduleMap();
        $kindMap = TariffsExcelLabels::kindMap();
        $periodMap = TariffsExcelLabels::periodMap();

        $items = PaymentItem::whereNotIn('kind', ['plan_price', 'plan_meta'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $rows = [];
        $rowActive = [];
        $index = 0;

        foreach ($items as $item) {
            if ($this->isLinkedFeature($item)) {
                continue;
            }

            $payload = is_array($item->payload) ? $item->payload : [];
            $rawPrices = $payload['prices_by_plan'] ?? [];
            $ownPrices = is_array($rawPrices) ? $rawPrices : [];

            $rows[] = [
                (string) $item->key,
                (string) $item->name,
                (string) ($item->description ?? ''),
                $moduleMap[(string) $item->module] ?? 'Везде',
                $kindMap[(string) $item->kind] ?? 'Пакет кредитов',
                $this->exportPrice($item->price === null ? null : (float) $item->price, 'Бесплатно'),
                $periodMap[$item->period] ?? 'Один раз',
                $this->exportPrice($this->cleanOwnPrice($ownPrices['free'] ?? null), 'Как всем'),
                $this->exportPrice($this->cleanOwnPrice($ownPrices['pro'] ?? null), 'Как всем'),
                $this->exportPrice($this->cleanOwnPrice($ownPrices['premium'] ?? null), 'Как всем'),
                $this->exportPrice($this->cleanOwnPrice($ownPrices['business'] ?? null), 'Как всем'),
                $item->is_active ? 'да' : 'нет',
                (int) ($item->sort_order ?? 0),
                $this->exportExtras($payload),
            ];

            $rowActive[$index] = (bool) $item->is_active;
            $index++;
        }

        return [$rows, $rowActive];
    }

    /**
     * Возможность с привязкой к тарифу (живёт на листе «Что входит»).
     *
     * @param \App\Models\PaymentItem $item строка витрины
     */
    private function isLinkedFeature(\App\Models\PaymentItem $item): bool
    {
        if ((string) $item->kind !== 'feature') {
            return false;
        }

        $payload = is_array($item->payload) ? $item->payload : [];

        if (isset($payload['plan']) && is_string($payload['plan']) && $payload['plan'] !== '') {
            return true;
        }

        $plans = $payload['plans'] ?? null;

        return is_array($plans) && $plans !== [];
    }

    /**
     * Остатки payload в служебную колонку: всё кроме цен по тарифам.
     *
     * Пусто — пустая клетка. Импорт склеит обратно: остатки из колонки,
     * цены по тарифам — из своих колонок.
     *
     * @param array<string, mixed> $payload доп. данные строки
     */
    private function exportExtras(array $payload): string
    {
        $extras = $payload;
        unset($extras['prices_by_plan']);

        if ($extras === []) {
            return '';
        }

        $json = json_encode($extras, JSON_UNESCAPED_UNICODE);

        return is_string($json) ? $json : '';
    }

    /**
     * Цена в клетку: число либо понятное слово.
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
     * Своя цена по тарифу: только число, иначе null.
     *
     * @param mixed $value сырое значение из payload
     */
    private function cleanOwnPrice(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_numeric((string) $value)) {
            return null;
        }

        return (float) $value;
    }

    /**
     * Покрасить «В продаже»: «да» — зелёным, «нет» — красным.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function paintActive(Worksheet $sheet, int $lastRow): void
    {
        foreach (range(2, $lastRow) as $row) {
            $active = $this->rowActive[$row - 2] ?? true;

            $sheet->getStyle("L{$row}")->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => $active ? 'D1FAE5' : 'FEE2E2'],
                ],
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => $active ? '065F46' : '991B1B'],
                ],
                'alignment' => ['horizontal' => 'center'],
            ]);
        }
    }

    /**
     * Выпадающие списки раздела, вида, периода и продажи.
     *
     * @param Worksheet $sheet лист
     * @param int $lastRow последняя строка данных
     */
    private function addValidations(Worksheet $sheet, int $lastRow): void
    {
        $moduleList = '"'.implode(',', array_values(TariffsExcelLabels::moduleMap())).'"';
        $kindList = '"'.implode(',', array_values(TariffsExcelLabels::kindMap())).',Товар"';
        $periodList = '"'.implode(',', array_values(TariffsExcelLabels::periodMap())).'"';

        foreach (range(2, $lastRow) as $row) {
            $module = $sheet->getCell("D{$row}")->getDataValidation();
            $module->setType(DataValidation::TYPE_LIST);
            $module->setErrorStyle(DataValidation::STYLE_STOP);
            $module->setAllowBlank(false);
            $module->setShowDropDown(false);
            $module->setShowErrorMessage(true);
            $module->setErrorTitle('Выберите раздел');
            $module->setError('Раздел из списка: Везде, Знакомства, Карта, Лента, Районы, Компании.');
            $module->setFormula1($moduleList);

            $kind = $sheet->getCell("E{$row}")->getDataValidation();
            $kind->setType(DataValidation::TYPE_LIST);
            $kind->setErrorStyle(DataValidation::STYLE_STOP);
            $kind->setAllowBlank(false);
            $kind->setShowDropDown(false);
            $kind->setShowErrorMessage(true);
            $kind->setErrorTitle('Выберите вид');
            $kind->setError('Вид из списка: Пакет кредитов, Реклама.');
            $kind->setFormula1($kindList);

            $period = $sheet->getCell("G{$row}")->getDataValidation();
            $period->setType(DataValidation::TYPE_LIST);
            $period->setErrorStyle(DataValidation::STYLE_STOP);
            $period->setAllowBlank(false);
            $period->setShowDropDown(false);
            $period->setShowErrorMessage(true);
            $period->setErrorTitle('Выберите период');
            $period->setError('Период из списка: Один раз, Каждую неделю, Каждый месяц, Сразу за год.');
            $period->setFormula1($periodList);

            $active = $sheet->getCell("L{$row}")->getDataValidation();
            $active->setType(DataValidation::TYPE_LIST);
            $active->setErrorStyle(DataValidation::STYLE_STOP);
            $active->setAllowBlank(false);
            $active->setShowDropDown(false);
            $active->setShowErrorMessage(true);
            $active->setErrorTitle('Только да или нет');
            $active->setError('«да» — продаётся, «нет» — скрыто у людей.');
            $active->setFormula1('"да,нет"');
        }
    }

    /**
     * Подсказки к шапке.
     *
     * @param Worksheet $sheet лист
     */
    private function addHeaderComments(Worksheet $sheet): void
    {
        $planName = static fn (string $id): string => (string) (PlanCatalog::plans()[$id]['name'] ?? $id);

        $hints = [
            'A1' => 'Технический ключ товара (латиница). Не меняйте у старых товаров. У нового оставьте пусто — ключ придумается сам.',
            'F1' => 'Обычная цена числом (например 4.99) или «Бесплатно». Пусто = бесплатно.',
            'H1' => "Своя цена для «{$planName('free')}». Пусто или «Как всем» = обычная цена.",
            'L1' => '«да» — товар продаётся, «нет» — скрыт у людей, но не удалён.',
            'M1' => 'Порядок в таблице: меньше — выше. Можно оставить пусто.',
            'N1' => 'Служебные данные (например, сколько кредитов в пакете). Не меняйте — иначе товар восстановится криво.',
        ];

        foreach ($hints as $cell => $text) {
            $comment = $sheet->getComment($cell);
            $comment->getText()->createTextRun($text);
            $comment->setWidth(240);
            $comment->setHeight(80);
        }
    }
}
