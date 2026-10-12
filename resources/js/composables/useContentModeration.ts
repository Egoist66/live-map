import { computed, ref, shallowRef } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { aiApi, type AiSafetyVerdict } from '@/services/ai.api'

/**
 * Клиентская модерация публичного контента (посты, комментарии, пины, районы).
 *
 * Слой 1 — мгновенный локальный regex (зеркало бэкенда ContentModeration):
 * мат и обфускация ("п-и-з-д-а", "х*й", латиница) блюрятся без запросов.
 * Слой 2 — AI-вердикт через POST /api/ai/moderate для завуалированной
 * токсичности (оскорбления без мата, угрозы, спам).
 *
 * Чаты намеренно исключены: личная переписка не проверяется и не блюрится.
 *
 * @example
 * const mod = useContentModeration()
 * const state = mod.moderationOf(post.title, post.body, post.moderation)
 * if (state.blur) showBlur = true
 */

export interface ModerationFlags {
  is_toxic: boolean
  category: string | null
  label: string | null
  blur: boolean
}

const STEMS = [
  'пизд', 'бляд', 'блят', 'ебал', 'ебет', 'ебут', 'ебен', 'долбоеб', 'мудак',
  'мудил', 'гандон', 'залуп', 'дроч', 'трах', 'сучк', 'пидор', 'пидар',
  'изнасилов', 'ебуч', 'охуе', 'охуи', 'наху', 'поху', 'хуес', 'хуев', 'хуйн', 'хуяр',
  'порно', 'порн', 'эскорт', 'интим', 'проститут', 'наркотик', 'закладк',
  'экстремист', 'террорист', 'нацист', 'фашист',
]

const EXACT = [
  'хуй', 'хуя', 'хуе', 'хую', 'хуем', 'бля', 'блядь', 'сука', 'мудак', 'гандон',
  'залупа', 'fuck', 'shit', 'bitch', 'whore', 'секс', 'порно', 'эскорт',
  'героин', 'кокаин', 'мефедрон', 'оружие', 'пистолет', 'граната', 'казино', 'взятка',
]

const LABELS: Record<string, string> = {
  profanity: 'Нецензурная лексика',
  insult: 'Оскорбления',
  hate: 'Ненависть и экстремизм',
  spam: 'Спам',
  sexual: 'Контент 18+',
  threat: 'Угрозы',
  politics: 'Политика',
  adult: 'Контент 18+',
  drugs: 'Наркотики',
  weapons: 'Оружие',
  crime: 'Мошенничество',
  none: 'Без нарушений',
}

/** Кэш AI-вердиктов по хэшу текста, чтобы не жечь квоту OpenRouter. */
const aiCache = new Map<string, AiSafetyVerdict>()
const aiInflight = new Map<string, Promise<AiSafetyVerdict>>()

/**
 * Нормализовать текст как на бэкенде: ё→е, латиница→кириллица, leet-символы.
 * @param text исходный текст
 * @returns нормализованный текст
 */
export function normalizeForCheck(text: string): string {
  let out = (text || '').toLowerCase().trim()
  if (!out) return ''
  out = out.replace(/ё/g, 'е')
  const latin: Record<string, string> = {
    a: 'а', b: 'в', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и',
    j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р',
    s: 'с', t: 'т', u: 'и', v: 'в', w: 'ш', x: 'х', y: 'у', z: 'з',
  }
  out = out.replace(/[a-z]/g, (ch) => latin[ch] || ch)
  const leet: Record<string, string> = {
    '@': 'а', 0: 'о', 3: 'з', 6: 'б', 4: 'ч', 7: 'т', 9: 'д', $: 'с', 1: 'и', '!': 'и',
  }
  out = out.replace(/[@036479$1!*#]/g, (ch) => leet[ch] ?? '')
  out = out.replace(/[.\-_~^|:\\/]+/g, ' ')
  out = out.replace(/(.)\1{2,}/g, '$1$1')
  return out.trim()
}

/**
 * Быстрая локальная проверка без сети.
 * @param texts проверяемые фрагменты
 * @returns флаги модерации
 */
export function checkLocal(...texts: Array<string | null | undefined>): ModerationFlags {
  const raw = texts.filter((t) => typeof t === 'string' && t !== '').join(' ').toLowerCase()
  if (!raw.trim()) return { is_toxic: false, category: null, label: null, blur: false }
  // Обфускация: между буквами корня 0-2 любых не-букв (х*й, п-и-з-д-а).
  const roots = ['хуй', 'пизд', 'бляд', 'блят', 'ебал', 'ебет', 'ебут', 'сука', 'пидор', 'пидар', 'мудак', 'гандон', 'залуп', 'охуе', 'охуи', 'наху', 'поху', 'долбоеб', 'изнасилов']
  for (const root of roots) {
    try {
      const pattern = root.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^\\p{L}]{0,2}')
      if (new RegExp(pattern, 'iu').test(raw)) {
        return { is_toxic: true, category: 'profanity', label: LABELS.profanity, blur: true }
      }
    } catch { /* noop */ }
  }
  // Токен с замаскированной буквой: х*й, п*зда, б*дь (зеркало бэкенда).
  const tokens = raw.split(/\s+/).filter(Boolean)
  for (const token of tokens) {
    if (!/[*#@._\-:|/\\]/.test(token)) continue
    const stripped = token.replace(/[^\p{L}]/gu, '')
    if (stripped.length < 2 || stripped.length > 7) continue
    const first = stripped[0]
    if (!['х', 'п', 'б', 'е', 'с', 'м', 'г', 'з', 'о', 'д'].includes(first)) continue
    try {
      if (/^[хпбемсгзод][\p{L}]{0,4}[йаьояукдл]$/u.test(stripped)) {
        if (stripped.length <= 2 && !['ху', 'хй', 'пи', 'бл', 'су', 'еб'].includes(stripped)) continue
        return { is_toxic: true, category: 'profanity', label: LABELS.profanity, blur: true }
      }
    } catch { /* noop */ }
  }
  const joined = normalizeForCheck(texts.filter((t) => typeof t === 'string' && t !== '').join(' '))
  if (!joined) return { is_toxic: false, category: null, label: null, blur: false }
  const words = joined.split(/[^a-zа-я0-9]+/u).filter(Boolean)
  const lookup = new Set(words)
  for (const w of EXACT) {
    if (lookup.has(w)) {
      const cat = w === 'секс' || w === 'порно' || w === 'эскорт' ? 'adult' : w === 'героин' || w === 'кокаин' || w === 'мефедрон' ? 'drugs' : w === 'оружие' || w === 'пистолет' || w === 'граната' ? 'weapons' : w === 'казино' || w === 'взятка' ? 'crime' : 'profanity'
      return { is_toxic: true, category: cat, label: LABELS[cat] || cat, blur: true }
    }
  }
  for (const stem of STEMS) {
    if (stem.length < 4) continue
    for (const w of words) {
      if (w.length >= 4 && w.includes(stem)) {
        return { is_toxic: true, category: 'profanity', label: LABELS.profanity, blur: true }
      }
    }
  }
  return { is_toxic: false, category: null, label: null, blur: false }
}

/**
 * Замаскировать мат звёздочками для превью.
 * @param text исходный текст
 * @returns текст с *** вместо мата
 */
export function maskProfanity(text: string): string {
  if (!text) return ''
  let out = text
  for (const stem of STEMS) {
    if (stem.length < 4) continue
    try {
      const re = new RegExp(`\\p{L}*${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*`, 'giu')
      out = out.replace(re, (m) => (m.length <= 2 ? m : m[0] + '*'.repeat(m.length - 1)))
    } catch { /* noop */ }
  }
  return out
}

/**
 * Хук модерации: объединяет серверные флаги, локальный regex и AI.
 * @returns состояние и методы проверки
 */
export function useContentModeration() {
  const aiChecking = ref(false)
  const lastVerdict = shallowRef<AiSafetyVerdict | null>(null)
  const lastError = ref<string | null>(null)

  const isToxic = computed(() => lastVerdict.value?.is_toxic === true)

  /**
   * Итоговые флаги: серверные (если есть) ИЛИ локальные.
   * Персонал видит всё без блюра.
   * @param texts проверяемые фрагменты
   * @param server серверные флаги из API (moderation)
   * @returns объединённые флаги
   */
  function moderationOf(...args: Array<string | null | undefined | ModerationFlags | null>): ModerationFlags {
    const clean: ModerationFlags = { is_toxic: false, category: null, label: null, blur: false }
    if (isStaffViewer()) return clean
    const server = args.find((a): a is ModerationFlags => typeof a === 'object' && a !== null && 'blur' in a) || null
    if (server?.blur) return server
    const texts = args.filter((a): a is string => typeof a === 'string')
    const local = checkLocal(...texts)
    if (local.blur) return local
    if (server) return server
    return local
  }

  /**
   * AI-проверка текста с кэшем (для завуалированной токсичности без мата).
   * Fail-open: при ошибке сети возвращает clean.
   * @param text текст до 2000 символов
   * @returns вердикт AI
   */
  async function checkViaAi(text: string): Promise<AiSafetyVerdict> {
    const clean = (text || '').trim().slice(0, 2000)
    if (!clean) return { is_toxic: false, category: null, confidence: null, reason: null, source: 'empty' }
    const local = checkLocal(clean)
    if (local.blur) {
      const verdict: AiSafetyVerdict = { is_toxic: true, category: local.category, confidence: 'high', reason: local.label, source: 'regex' }
      lastVerdict.value = verdict
      return verdict
    }
    const key = `ai:${clean.length}:${hashText(clean)}`
    const cached = aiCache.get(key)
    if (cached) {
      lastVerdict.value = cached
      return cached
    }
    const inflight = aiInflight.get(key)
    if (inflight) return inflight
    aiChecking.value = true
    lastError.value = null
    const task = (async (): Promise<AiSafetyVerdict> => {
      try {
        const verdict = await aiApi.moderateText(clean)
        aiCache.set(key, verdict)
        lastVerdict.value = verdict
        return verdict
      } catch (e) {
        lastError.value = e instanceof Error ? e.message : 'AI недоступен'
        const fallback: AiSafetyVerdict = { is_toxic: false, category: null, confidence: null, reason: null, source: 'fallback' }
        lastVerdict.value = fallback
        return fallback
      } finally {
        aiInflight.delete(key)
        aiChecking.value = false
      }
    })()
    aiInflight.set(key, task)
    return task
  }

  /**
   * Проверка перед публикацией: локальный мат блочит сразу,
   * иначе спрашиваем AI и блочим при is_toxic.
   * Персонал публикует без проверок.
   * @param text текст поста/комментария
   * @returns null если можно публиковать, иначе текст ошибки
   */
  async function assertPublishable(text: string): Promise<string | null> {
    if (isStaffViewer()) return null
    const local = checkLocal(text)
    if (local.blur) return local.label || 'Мат и нецензурная лексика запрещены правилами сервиса.'
    const verdict = await checkViaAi(text)
    if (verdict.is_toxic) return verdict.reason || 'Текст не прошёл AI-модерацию.'
    return null
  }

  return { aiChecking, lastVerdict, lastError, isToxic, moderationOf, checkViaAi, assertPublishable }
}

/**
 * Текущий зритель — персонал (админ или модератор).
 *
 * Персонал не ограничивается модерацией: видит контент без блюра
 * и публикует без проверок (зеркало бэкенда `User::canModerate`:
 * `is_admin || role admin/moderator`).
 *
 * @returns true для админов и модераторов
 */
export function isStaffViewer(): boolean {
  try {
    const user = (usePage().props.auth as { user?: { is_admin?: boolean; role?: string } | null } | undefined)?.user
    return !!user?.is_admin || user?.role === 'admin' || user?.role === 'moderator'
  } catch {
    return false
  }
}
function hashText(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0
  }
  return String(h)
}
