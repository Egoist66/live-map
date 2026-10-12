import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Клиентская модерация публичного контента (посты, комментарии, пины, районы).
 *
 * Полностью локальная, без ИИ и сети: мгновенный regex — зеркало бэкенда
 * (ContentModeration на библиотеке Blasp + config/languages/russian.php).
 * Мат и обфускация ("п-и-з-д-а", "х*й", латиница) блюрятся и блочат
 * отправку сразу, токены не тратятся.
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
 * Хук модерации: серверные флаги + локальный regex, синхронно и без сети.
 * @returns состояние и методы проверки
 */
export function useContentModeration() {
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
   * Проверка перед публикацией: локальный мат блочит сразу.
   * Синхронно: сети нет, токены не тратятся. Персонал публикует без проверок.
   * @param text текст поста/комментария
   * @returns null если можно публиковать, иначе текст ошибки
   */
  function assertPublishable(text: string): string | null {
    if (isStaffViewer()) return null
    const local = checkLocal(text)
    if (local.blur) return local.label || 'Мат и нецензурная лексика запрещены правилами сервиса.'
    return null
  }

  return { moderationOf, assertPublishable }
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
