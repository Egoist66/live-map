/**
 * Чистый каталог категорий пинов (без стора и API).
 *
 * Выделен из `usePins`, чтобы константу могли тянуть лёгкие места
 * (кастомные категории, формы, фильтры) без втягивания `stores/pins`
 * (чанк `mod-upin`) в общий бандл. Этот файл обязан оставаться
 * без импортов сторов/composables — только типы и данные.
 *
 * @example
 * ```ts
 * import { PIN_CATEGORIES, pinCategoryMeta } from '@/composables/pinCategories'
 * ```
 */

/** Категория пина: значение, подпись, иконка, цвет. */
export interface PinCategoryDef {
  /** значение */
  v: string
  /** подпись */
  l: string
  /** иконка */
  i: string
  /** цвет */
  c: string
}

export const PIN_CATEGORIES = [
  { v: 'sos', l: 'SOS', i: '🆘', c: '#B91C1C' },
  { v: 'question', l: 'Вопрос', i: '💬', c: '#2563EB' },
  { v: 'announcement', l: 'Объявление', i: '📍', c: '#DC2626' },
  { v: 'warning', l: 'Предупреждение', i: '⚠️', c: '#EA580C' },
  { v: 'event', l: 'Событие', i: '🎉', c: '#7C3AED' },
  { v: 'offer', l: 'Отдам', i: '📦', c: '#0891B2' },
  { v: 'help', l: 'Помощь', i: '🤝', c: '#DB2777' },
  { v: 'sport', l: 'Спорт', i: '🏃', c: '#16A34A' },
  { v: 'food', l: 'Еда', i: '🍔', c: '#F59E0B' },
  { v: 'music', l: 'Музыка', i: '🎵', c: '#8B5CF6' },
  { v: 'pets', l: 'Животные', i: '🐾', c: '#0D9488' },
  { v: 'sale', l: 'Купля-продажа', i: '💰', c: '#A16207' },
  { v: 'job', l: 'Работа', i: '💼', c: '#475569' },
  { v: 'study', l: 'Учёба', i: '📚', c: '#0284C7' },
  { v: 'travel', l: 'Путешествия', i: '🧭', c: '#65A30D' },
  { v: 'tech', l: 'Технологии', i: '💻', c: '#4F46E5' },
  { v: 'health', l: 'Здоровье', i: '🏥', c: '#E11D48' },
  { v: 'art', l: 'Творчество', i: '🎨', c: '#D946EF' },
  { v: 'humor', l: 'Юмор', i: '😂', c: '#EAB308' },
  { v: 'rest', l: 'Отдых', i: '🏖️', c: '#38BDF8' },
] as const

export type PinCategoryValue = (typeof PIN_CATEGORIES)[number]['v']

/**
 * Найти мету категории по значению.
 *
 * @param v значение категории
 * @returns мета или null
 */
export function pinCategoryMeta(v: string | null | undefined): PinCategoryDef | null {
  const found = (PIN_CATEGORIES as readonly PinCategoryDef[]).find((c) => c.v === v)

  return found ?? null
}
