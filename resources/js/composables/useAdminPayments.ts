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
 * Цена плана по периодам (итоговая: действует везде сразу).
 */
export interface PlanPriceRow {
  id: string
  name: string
  tagline: string
  audience: string
  prices: Record<'monthly' | 'yearly' | 'weekly', number | null>
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
  /** К какому тарифу относится возможность (для вида «Фишка»). */
  plan: string
  /** Своя цена под каждый тариф (пусто = общая цена). */
  pricesByPlan: Record<'free' | 'pro' | 'premium' | 'business', number | null>
  /** Показать ли блок «разные цены по тарифам» (только вид диалога). */
  showPricesByPlan: boolean
  /** Прочие данные позиции (кредиты и т.д.) — храним непрозрачно. */
  payload: Record<string, unknown>
}

/** Пустой черновик для кнопки «Добавить». */
export const EMPTY_ITEM_DRAFT: PaymentItemDraft = {
  key: '',
  module: 'general',
  kind: 'credit_pack',
  name: '',
  description: '',
  price: null,
  period: 'once',
  is_active: true,
  plan: 'pro',
  pricesByPlan: { free: null, pro: null, premium: null, business: null },
  showPricesByPlan: false,
  payload: {},
}

/**
 * Превратить название в технический ключ (латиница).
 * Кириллица переводится в латиницу, всё остальное выкидывается.
 * @param name название товара или возможности
 * @example slugifyKey('Буст анкеты · 1 час') // 'bust_ankety_1_chas'
 */
export function slugifyKey(name: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  }

  const slug = name
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)

  return slug === '' ? 'item' : slug
}

/** Подписи видов позиций. */
export const PAYMENT_KIND_LABELS: Record<string, string> = {
  plan_price: 'Цена тарифа',
  credit_pack: 'Пакет кредитов',
  feature: 'Возможность тарифа',
  ad: 'Реклама',
}

/** Пояснения видов позиций человеческим языком. */
export const PAYMENT_KIND_HINTS: Record<string, string> = {
  credit_pack: 'Пакет внутренней валюты: люди тратят кредиты на мелочи.',
  feature: 'Строка внутри карточки тарифа — уже включена в тариф, отдельно не продаётся.',
  ad: 'Платное продвижение для компаний: пин, рассылка, купон.',
}

/** Пояснения разделов человеческим языком. */
export const PAYMENT_MODULE_HINTS: Record<string, string> = {
  general: 'Видят все, без привязки к разделу.',
  ulove: 'Показывается в знакомствах.',
  upin: 'Показывается на карте.',
  uflow: 'Показывается в ленте.',
  districts: 'Показывается в районах.',
  business: 'Показывается у компаний.',
}

/** Подписи периодов оплаты человеческим языком. */
export const PAYMENT_PERIOD_HINTS: Record<string, string> = {
  once: 'Купил один раз — и всё.',
  week: 'Оплата каждую неделю.',
  month: 'Оплата каждый месяц.',
  year: 'Оплата сразу за год.',
}

/**
 * Итог загрузки Excel с бэкенда (зеркало TariffsImport::importFromArrays).
 */
export interface TariffsImportResult {
  plans_updated: number
  features_saved: number
  items_saved: number
  deleted: number
  errors: string[]
  warnings: string[]
}

/** Подписи аудитории тарифа (человеческим языком). */
export const PLAN_AUDIENCE_LABELS: Record<string, string> = {
  users: 'Для всех',
  organizations: 'Для компаний',
}

/**
 * Короткая подпись месячной цены тарифа для шапки карточки.
 * @param plan тариф с ценами
 */
export function planMonthlyLabel(plan: PlanPriceRow): string {
  const value = plan.prices.monthly
  if (value === null || value === undefined) return 'Бесплатно'
  return `$${Number(value)} / мес`
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
 * Раздел «Тарифы, цены и оплаты»: цены тарифов, их возможности и витрина.
 *
 * Цены меняются здесь и сразу видны везде: в приложении, в боте, на витрине.
 * Возможности тарифа — это список «что входит»: раскрывается по клику
 * на карточку тарифа, каждую строку можно поправить или удалить.
 *
 * @returns состояние, списки и действия
 * @example const pay = useAdminPayments(); await pay.load()
 */
export function useAdminPayments() {
  const state = reactive({
    loading: false,
    savingPrices: false,
    acting: false,
    importing: false,
    error: null as string | null,
    notice: null as string | null,
    plans: [] as PlanPriceRow[],
    gateways: [] as PaymentGatewayStatus[],
    gatewayNote: '',
    dialogOpen: false,
    helpOpen: false,
    importOpen: false,
    replaceOnImport: false,
    importResult: null as TariffsImportResult | null,
    importFileName: '' as string,
    editingId: null as number | null,
    draft: { ...EMPTY_ITEM_DRAFT, pricesByPlan: { ...EMPTY_ITEM_DRAFT.pricesByPlan } } as PaymentItemDraft,
  })

  const items = reactive({ list: [] as PaymentItemRow[] })

  const moduleFilter = reactive({ value: 'all' })

  /** Какие карточки тарифов раскрыты (видны возможности внутри). */
  const expanded = reactive({ plans: [] as string[] })

  /** Витрина без служебных строк и без возможностей тарифов. */
  const showcaseItems = computed(() => items.list.filter((row) => row.kind !== 'feature'))

  const visibleItems = computed(() => {
    const base = showcaseItems.value
    if (moduleFilter.value === 'all') return base
    return base.filter((row) => row.module === moduleFilter.value)
  })

  /**
   * К какому тарифу привязана строка (возможность тарифа).
   * @param row строка витрины
   */
  function planOf(row: PaymentItemRow): string | null {
    const payload = (row.payload ?? {}) as Record<string, unknown>
    const single = payload.plan
    if (typeof single === 'string' && single !== '') return single
    const many = payload.plans
    if (Array.isArray(many) && typeof many[0] === 'string') return many[0] as string
    return null
  }

  /** Возможности, сгруппированные по тарифу. */
  const featuresByPlan = computed(() => {
    const grouped: Record<string, PaymentItemRow[]> = { free: [], pro: [], premium: [], business: [] }
    for (const row of items.list) {
      if (row.kind !== 'feature') continue
      const plan = planOf(row)
      if (plan && grouped[plan]) grouped[plan].push(row)
    }
    return grouped
  })

  /**
   * Сколько возможностей у тарифа.
   * @param planId идентификатор тарифа
   */
  function featureCount(planId: string): number {
    return featuresByPlan.value[planId]?.length ?? 0
  }

  /**
   * Раскрыта ли карточка тарифа.
   * @param planId идентификатор тарифа
   */
  function isExpanded(planId: string): boolean {
    return expanded.plans.includes(planId)
  }

  /** Показать или скрыть возможности внутри карточки тарифа. */
  function togglePlan(planId: string): void {
    const at = expanded.plans.indexOf(planId)
    if (at >= 0) expanded.plans.splice(at, 1)
    else expanded.plans.push(planId)
  }

  function readError(err: unknown, fallback: string): string {
    const e = err as { response?: { data?: { message?: string } } }
    return e.response?.data?.message ?? fallback
  }

  /**
   * Загрузить цены, возможности и витрину.
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

      const rawPlans = overview.data?.plans ?? []
      state.plans = rawPlans.map(
        (plan: Record<string, unknown>): PlanPriceRow => ({
          id: String(plan.id ?? ''),
          name: String(plan.name ?? plan.id ?? ''),
          tagline: String(plan.tagline ?? ''),
          audience: String(plan.audience ?? 'users'),
          prices: (plan.prices ?? { monthly: null, yearly: null, weekly: null }) as PlanPriceRow['prices'],
        }),
      )
      state.gateways = overview.data?.gateways ?? []
      state.gatewayNote = overview.data?.gateway_note ?? ''
      const rows = (list.data?.items ?? []) as PaymentItemRow[]
      items.list = rows.filter((row) => row.kind !== 'plan_price')
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось загрузить тарифы')
    } finally {
      state.loading = false
    }
  }

  /**
   * Отправить названия и описания тарифов на сервер (без перезагрузки).
   */
  async function persistPlanMeta(): Promise<void> {
    const meta = state.plans.map((plan) => ({ plan: plan.id, name: plan.name, tagline: plan.tagline }))
    await axios.put('/api/admin/payments/plan-meta', { meta })
  }

  /**
   * Отправить цены тарифов на сервер (без перезагрузки).
   */
  async function persistPrices(): Promise<void> {
    const prices = state.plans.flatMap((plan) =>
      Object.entries(plan.prices).map(([period, price]) => ({ plan: plan.id, period, price })),
    )

    await axios.put('/api/admin/payments/plan-prices', { prices })
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
      await persistPrices()
      state.notice = 'Цены сохранены — приложение и бот уже показывают новые.'
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить цены')
    } finally {
      state.savingPrices = false
    }
  }

  /**
   * Сохранить названия и описания тарифов (видны везде сразу).
   */
  async function savePlanMeta(): Promise<void> {
    if (state.savingPrices) return
    state.savingPrices = true
    state.error = null
    state.notice = null

    try {
      await persistPlanMeta()
      state.notice = 'Названия и описания сохранены — везде уже новые.'
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить описания')
    } finally {
      state.savingPrices = false
    }
  }

  /**
   * Сохранить всё по тарифам одним проходом: названия, описания и цены.
   *
   * Раньше кнопка «Сохранить всё» звала savePlanMeta + savePrices по
   * очереди, а savePlanMeta в середине делал load() — свежие цены из
   * инпутов затирались серверными, и второй запрос сохранял старье:
   * запросы уходили, а цены не менялись. Теперь оба PUT идут подряд
   * и только потом одна перезагрузка с сервера.
   */
  async function saveAll(): Promise<void> {
    if (state.savingPrices) return
    state.savingPrices = true
    state.error = null
    state.notice = null

    try {
      await persistPlanMeta()
      await persistPrices()
      state.notice = 'Всё сохранено — приложение и бот уже показывают новые цены и описания.'
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить тарифы')
    } finally {
      state.savingPrices = false
    }
  }

  /**
   * Открыть диалог добавления позиции.
   */
  function openCreate(): void {
    state.editingId = null
    state.draft = { ...EMPTY_ITEM_DRAFT, pricesByPlan: { ...EMPTY_ITEM_DRAFT.pricesByPlan }, payload: {} }
    state.dialogOpen = true
  }

  /**
   * Открыть диалог добавления возможности внутрь тарифа.
   * @param planId идентификатор тарифа
   */
  function openCreateForPlan(planId: string): void {
    state.editingId = null
    state.draft = {
      ...EMPTY_ITEM_DRAFT,
      pricesByPlan: { ...EMPTY_ITEM_DRAFT.pricesByPlan },
      payload: {},
      key: `feat_${planId}_${Date.now().toString(36)}`,
      kind: 'feature',
      is_active: true,
      plan: planId,
    }
    state.dialogOpen = true
    if (!expanded.plans.includes(planId)) expanded.plans.push(planId)
  }

  /**
   * Подобрать свободный технический ключ по названию.
   * @param name название товара или возможности
   */
  function uniqueKey(name: string): string {
    const taken = new Set(items.list.map((row) => row.key))
    const base = slugifyKey(name)
    if (!taken.has(base)) return base

    let counter = 2
    while (taken.has(`${base}_${counter}`)) counter += 1
    return `${base}_${counter}`
  }

  /**
   * Открыть диалог правки позиции.
   * @param row строка витрины
   */
  function openEdit(row: PaymentItemRow): void {
    const byPlan = (row.payload?.prices_by_plan ?? {}) as Record<string, number | null>
    const hasOwnPrices = (['free', 'pro', 'premium', 'business'] as const).some((id) => byPlan[id] != null)

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
      plan: planOf(row) ?? 'pro',
      pricesByPlan: {
        free: byPlan.free ?? null,
        pro: byPlan.pro ?? null,
        premium: byPlan.premium ?? null,
        business: byPlan.business ?? null,
      },
      showPricesByPlan: hasOwnPrices,
      payload: { ...(row.payload ?? {}) },
    }
    state.dialogOpen = true
  }

  /**
   * Сохранить черновик (создание или правка).
   *
   * Технический ключ при создании подбирается сам по названию —
   * в диалоге его нет и спрашивать его не нужно.
   */
  async function saveDraft(): Promise<void> {
    if (state.acting) return
    state.acting = true
    state.error = null
    state.notice = null

    try {
      const isFeature = state.draft.kind === 'feature'
      const nextPayload: Record<string, unknown> = { ...state.draft.payload }
      nextPayload.prices_by_plan = isFeature ? {} : { ...state.draft.pricesByPlan }
      if (isFeature) {
        nextPayload.plan = state.draft.plan
        delete nextPayload.plans
      }

      const key = state.editingId === null ? uniqueKey(state.draft.name) : state.draft.key

      const payload = {
        key,
        module: state.draft.module,
        kind: state.draft.kind,
        name: state.draft.name,
        description: state.draft.description || null,
        price: isFeature ? null : state.draft.price,
        period: state.draft.period,
        is_active: state.draft.is_active,
        payload: nextPayload,
        currency: 'USD',
      }

      if (state.editingId === null) {
        await axios.post('/api/admin/payments/items', payload)
        state.notice = isFeature ? 'Возможность добавлена в тариф.' : 'Товар добавлен в витрину.'
      } else {
        await axios.patch(`/api/admin/payments/items/${state.editingId}`, payload)
        state.notice = 'Сохранено — везде уже новое.'
      }

      state.dialogOpen = false
      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось сохранить. Проверьте название и цену.')
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
      link.download = `tarify-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.xlsx`
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

  /**
   * Открыть диалог загрузки Excel (сброс прошлого результата).
   */
  function openImport(): void {
    state.importOpen = true
    state.importResult = null
    state.importFileName = ''
    state.error = null
  }

  /**
   * Принять файл из PrimeVue FileUpload (@select) и сразу загрузить.
   *
   * @param event событие выбора файлов ({ files: File[] })
   */
  async function handleImportPicked(event: { files?: File[] }): Promise<void> {
    const picked = event.files?.[0]
    if (!picked) return
    await importFile(picked)
  }

  /**
   * Загрузить Excel на бэкенд и обновить раздел.
   *
   * Без галочки «очистить» строки обновляются по ключам, новое добавляется.
   * С галочкой — всё удаляется и загружается только из файла, поэтому
   * после полной очистки всё восстанавливается один в один.
   *
   * @param file выбранный .xlsx/.xls/.csv
   */
  async function importFile(file: File): Promise<void> {
    if (state.importing) return
    state.importing = true
    state.error = null
    state.notice = null
    state.importResult = null
    state.importFileName = file.name

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('replace', state.replaceOnImport ? '1' : '0')

      const { data } = await axios.post('/api/admin/payments/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      state.importResult = (data?.imported ?? null) as TariffsImportResult | null
      state.notice = String(data?.message ?? 'Excel загружен.')

      const hasIssues =
        (state.importResult?.errors?.length ?? 0) > 0 || (state.importResult?.warnings?.length ?? 0) > 0

      if (!hasIssues) state.importOpen = false

      await load()
    } catch (err: unknown) {
      state.error = readError(err, 'Не удалось загрузить Excel. Проверьте, что это файл из кнопки «Скачать».')
    } finally {
      state.importing = false
    }
  }

  return {
    state,
    items,
    moduleFilter,
    expanded,
    visibleItems,
    showcaseItems,
    featuresByPlan,
    featureCount,
    isExpanded,
    togglePlan,
    planOf,
    load,
    savePrices,
    savePlanMeta,
    saveAll,
    openCreate,
    openCreateForPlan,
    openEdit,
    saveDraft,
    toggleActive,
    removeItem,
    exportFile,
    openImport,
    handleImportPicked,
    importFile,
  }
}
