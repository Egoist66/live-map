import axios from 'axios'
import { computed, reactive } from 'vue'
import { useAppConfirm } from '@/composables/useAppConfirm'

/**
 * Строка витрины Payments (зеркало App\Models\PaymentItem).
 */
export interface PaymentItemRow {
  id: number
  key: string
  module: string
  kind: string
  name: string
  description: string | null
  price: number | null
  currency: string
  period: string | null
  payload: Record<string, unknown>
  is_active: boolean
  sort_order: number
}

/**
 * Цена плана по периодам (эффективная: конфиг + оверрайды).
 */
export interface PlanPriceRow {
  id: string
  name: string
  prices: Record<'monthly' | 'regional_monthly' | 'yearly' | 'weekly', number | null>
}

/**
 * Статус платёжного шлюза (пока заглушки до интеграции).
 */
export interface PaymentGatewayStatus {
  id: string
  label: string
  status: 'connected' | 'not_connected'
}

/**
 * Черновик новой/правленной позиции витрины (форма диалога).
 */
export interface PaymentItemDraft {
  key: string
  module: string
  kind: string
  name: string
  description: string
  price: number | null
  period: string
  is_active: boolean
  /** Цены под тарифы (пусто = базовая цена). */
  pricesByPlan: Record<'free' | 'pro' | 'premium', number | null>
  /** Прочие данные позиции (кредиты и т.д.) — храним непрозрачно. */
  payload: Record<string, unknown>
}

/** Пустой черновик для кнопки «Добавить». */
export const EMPTY_ITEM_DRAFT: PaymentItemDraft = {
  key: '',
  module: 'ulove',
  kind: 'feature',
  name: '',
  description: '',
  price: null,
  period: 'once',
  is_active: false,
  pricesByPlan: { free: null, pro: null, premium: null },
  payload: {},
}

/** Подписи видов позиций. */
export const PAYMENT_KIND_LABELS: Record<string, string> = {
  plan_price: 'Цена тарифа',
  credit_pack: 'Пакет кредитов',
  feature: 'Фишка',
  ad: 'Реклама',
}

/** Подписи модулей. */
export const PAYMENT_MODULE_LABELS: Record<string, string> = {
  general: 'Общее',
  ulove: 'ULove',
  upin: 'Карта',
  uflow: 'Лента',
  districts: 'Районы',
  business: 'Бизнес',
}

/** Подписи периодов. */
export const PAYMENT_PERIOD_LABELS: Record<string, string> = {
  once: 'разово',
  week: '/ нед',
  month: '/ мес',
  year: '/ год',
}

/**
 * Подпись цены строки витрины.
 * @param row строка с ценой и периодом
 */
export function priceLabelOf(row: { price: number | null; period: string | null }): string {
  if (row.price === null || row.price === undefined) return 'Бесплатно'

  const formatted = String(Number(row.price)).includes('.')
    ? Number(row.price).toFixed(2).replace(/0$/, '')
    : String(row.price)

  const suffix = row.period && PAYMENT_PERIOD_LABELS[row.period] ? ` ${PAYMENT_PERIOD_LABELS[row.period]}` : ''

  return `$${formatted}${suffix}`
}

/**
 * Админка «Payments»: цены тарифов и витрина позиций.
 *
 * Цены планов правятся блоком и сразу влияют на всё приложение
 * (PlanCatalog → каталог фронта и бот, без редеплоя). Позиции —
 * CRUD будущей витрины кредитов/фишек/рекламы по модулям.
 *
 * @returns состояние, списки и действия
 * @example const pay = useAdminPayments(); await pay.load()
 */
export function useAdminPayments() {
  const state = reactive({
    loading: false,
    savingPrices: false,
    acting: false,
    error: null as string | null,
    notice: null as string | null,
    plans: [] as PlanPriceRow[],
    gateways: [] as PaymentGatewayStatus[],
    gatewayNote: '',
    dialogOpen: false,
    editingId: null as number | null,
    draft: { ...EMPTY_ITEM_DRAFT } as PaymentItemDraft,
  })

  const items = reactive({ list: [] as PaymentItemRow[] })

  const moduleFilter = reactive({ value: 'all' })

  const visibleItems = computed(() => {
    if (moduleFilter.value === 'all') return items.list
    return items.list.filter((row) => row.module === moduleFilter.value)
  })

  function readError(err: unknown, fallback: string): string {
    const e = err as { response?: { data?: { message?: string } } }
    return e.response?.data?.message ?? fallback
  }

  /**
   * Загрузить сводку цен и всю витрину.
   */
  async function load(): Promise<void> {
    if (state.loading) return
    state.loading = true
    state.error = null

    try {
      const [overview, list] = await Promise.all([
        axios.get('/api/admin/payments/overview'),
        axios.get('/api/admin/payments/items'),
      ])

      state.plans = overview.data?.plans ?? []
      state.gateways = overview.data?.gateways ?? []
      state.gatewayNote = overview.data?.gateway_note ?? ''
      items.list = list.data?.items ?? []
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось загрузить Payments')
    } finally {
      state.loading = false
    }
  }

  /**
   * Сохранить цены тарифов (оверрайды конфига).
   */
  async function savePrices(): Promise<void> {
    if (state.savingPrices) return
    state.savingPrices = true
    state.error = null
    state.notice = null

    try {
      const prices = state.plans.flatMap((plan) =>
        Object.entries(plan.prices).map(([period, price]) => ({ plan: plan.id, period, price })),
      )

      await axios.put('/api/admin/payments/plan-prices', { prices })
      state.notice = 'Цены сохранены — приложение и бот уже показывают новые.'
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить цены')
    } finally {
      state.savingPrices = false
    }
  }

  /**
   * Открыть диалог добавления позиции.
   */
  function openCreate(): void {
    state.editingId = null
    state.draft = { ...EMPTY_ITEM_DRAFT }
    state.dialogOpen = true
  }

  /**
   * Открыть диалог правки позиции.
   * @param row строка витрины
   */
  function openEdit(row: PaymentItemRow): void {
    const byPlan = (row.payload?.prices_by_plan ?? {}) as Record<string, number | null>

    state.editingId = row.id
    state.draft = {
      key: row.key,
      module: row.module,
      kind: row.kind,
      name: row.name,
      description: row.description ?? '',
      price: row.price,
      period: row.period ?? 'once',
      is_active: row.is_active,
      pricesByPlan: {
        free: byPlan.free ?? null,
        pro: byPlan.pro ?? null,
        premium: byPlan.premium ?? null,
      },
      payload: { ...(row.payload ?? {}) },
    }
    state.dialogOpen = true
  }

  /**
   * Сохранить черновик (создание или правка).
   */
  async function saveDraft(): Promise<void> {
    if (state.acting) return
    state.acting = true
    state.error = null
    state.notice = null

    try {
      const nextPayload: Record<string, unknown> = { ...state.draft.payload }
      nextPayload.prices_by_plan = { ...state.draft.pricesByPlan }

      const payload = {
        key: state.draft.key,
        module: state.draft.module,
        kind: state.draft.kind,
        name: state.draft.name,
        description: state.draft.description || null,
        price: state.draft.price,
        period: state.draft.period,
        is_active: state.draft.is_active,
        payload: nextPayload,
        currency: 'USD',
      }

      if (state.editingId === null) {
        await axios.post('/api/admin/payments/items', payload)
        state.notice = 'Позиция добавлена в витрину.'
      } else {
        await axios.patch(`/api/admin/payments/items/${state.editingId}`, payload)
        state.notice = 'Позиция обновлена.'
      }

      state.dialogOpen = false
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить позицию')
    } finally {
      state.acting = false
    }
  }

  /**
   * Быстро включить/выключить позицию в витрине.
   * @param row строка витрины
   */
  async function toggleActive(row: PaymentItemRow): Promise<void> {
    if (state.acting) return
    state.acting = true
    state.error = null

    try {
      await axios.patch(`/api/admin/payments/items/${row.id}`, { ...row, is_active: !row.is_active })
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось переключить позицию')
    } finally {
      state.acting = false
    }
  }

  /**
   * Удалить позицию из витрины (с подтверждением).
   * @param row строка витрины
   */
  async function removeItem(row: PaymentItemRow): Promise<void> {
    if (state.acting) return

    const { confirmDelete } = useAppConfirm()
    const confirmed = await confirmDelete(`«${row.name}» пропадёт из витрины. Продолжить?`, 'Удалить позицию?')

    if (!confirmed) return

    state.acting = true
    state.error = null
    state.notice = null

    try {
      await axios.delete(`/api/admin/payments/items/${row.id}`)
      state.notice = 'Позиция удалена.'
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось удалить позицию')
    } finally {
      state.acting = false
    }
  }

  /**
   * Скачать Excel-выгрузку ценообразования (тарифы + витрина).
   */
  async function exportFile(): Promise<void> {
    if (state.acting) return
    state.acting = true
    state.error = null

    try {
      const response = await axios.get('/api/admin/payments/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `payments-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      state.error = 'Не удалось выгрузить Excel'
    } finally {
      state.acting = false
    }
  }

  return {
    state,
    items,
    moduleFilter,
    visibleItems,
    load,
    savePrices,
    openCreate,
    openEdit,
    saveDraft,
    toggleActive,
    removeItem,
    exportFile,
  }
}
