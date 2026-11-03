/**
 * Клиентская проверка контактов в свободном тексте анкеты и профиля.
 *
 * Зеркало бэкенд-правила App\Rules\NoContactInfo: ссылки и домены,
 * e-mail, @никнеймы, телефоны и связки «тг: nick» / «инста — nick»
 * блокируются до отправки. Так пользователь видит понятную ошибку
 * сразу, без запроса на сервер.
 */

/** Единое сообщение об ошибке для всех полей анкеты. */
export const CONTACT_INFO_ERROR = 'Никнеймы и ссылки на соцсети в анкете запрещены — общайтесь внутри сервиса.'

const SOCIAL_KEYWORDS = [
  'телеграм', 'телеграмм', 'телега', 'тг', 'tg', 'telegram',
  'инстаграм', 'инстаграмм', 'инста', 'инст', 'insta', 'instagram', 'ig',
  'вконтакте', 'вк', 'vk', 'vkontakte',
  'ватсап', 'вотсап', 'whatsapp', 'вайбер', 'viber',
  'дискорд', 'discord', 'скайп', 'skype',
  'снапчат', 'snapchat', 'тикток', 'tiktok',
  'твиттер', 'twitter', 'фейсбук', 'facebook',
  'тредс', 'threads', 'линкедин', 'linkedin', 'твич', 'twitch',
  'ютуб', 'youtube', 'onlyfans', 'boosty', 'patreon',
]

const NICKNAME_KEYWORDS = [
  'ник', 'никнейм', 'nick', 'nickname', 'username', 'юзернейм', 'логин', 'login',
]

const TLD_PATTERN = 'com|ru|net|org|me|io|tv|cc|link|site|app|xyz|info|biz|pro|online|store|club|live|gg|ly|to|by|kz|ua|de|uk|fr|es|it|us|co'

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const KEYWORD_PATTERN = `(?<![\\p{L}])(${[...SOCIAL_KEYWORDS, ...NICKNAME_KEYWORDS]
  .map(escapeRegExp)
  .join('|')})(?![\\p{L}])`

const HANDLE_PATTERN = '@?[\\p{L}0-9_][\\p{L}0-9_.]{1,}'

const KEYWORD_WITH_HANDLE = new RegExp(`${KEYWORD_PATTERN}\\s*(?:[:\\-–—]\\s*|@\\s*)${HANDLE_PATTERN}`, 'iu')
const KEYWORD_WITH_AT = new RegExp(`${KEYWORD_PATTERN}\\s+@${HANDLE_PATTERN}`, 'iu')
const KEYWORD_WITH_LATIN_HANDLE = new RegExp(`${KEYWORD_PATTERN}\\s+(?=[\\p{L}0-9_.]*[a-z0-9_])${HANDLE_PATTERN}`, 'iu')

const URL_PATTERN = /https?:\/\/|www\./iu
const EMAIL_PATTERN = /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.[\p{L}]{2,}/iu
const MENTION_PATTERN = /(?:^|[\s(])@[\p{L}0-9_][\p{L}0-9_.]{2,}/iu
const DOMAIN_PATTERN = new RegExp(`\\b(?:[a-z0-9-]+\\.)+(?:${TLD_PATTERN})\\b`, 'iu')
const PHONE_PATTERN = /(?<!\d)(?:\+\d[\d\s()\-]{7,}\d|8[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})(?!\d)/u

/**
 * Привести обфускацию ссылок к простому виду.
 *
 * «t[.]me», «t (dot) me», «t . me» и «t / me» становятся «t.me» /
 * «t/me», чтобы доменный шаблон их увидел.
 *
 * @param text lower-текст
 * @returns нормализованная копия для проверки
 */
function normalizeObfuscation(text: string): string {
  let probe = text.replace(/\s*[[({]\s*(?:dot|точка)\s*[\])}]\s*/giu, '.')
  probe = probe.replace(/\s*\.\s*/gu, '.')
  probe = probe.replace(/\s*\/\s*/gu, '/')
  return probe
}

/**
 * Найти телефонный номер из 10–15 цифр.
 *
 * @param text нормализованный lower-текст
 * @returns true если найден номер
 */
function hasPhone(text: string): boolean {
  const matches = text.match(new RegExp(PHONE_PATTERN.source, 'gu')) ?? []

  for (const candidate of matches) {
    const digits = candidate.replace(/\D+/g, '')
    const length = digits.length

    if (length >= 10 && length <= 15) {
      return true
    }
  }

  return false
}

/**
 * Проверить текст на никнеймы, соцсети и другие контакты.
 *
 * @param text проверяемый текст
 * @returns true если найден контакт
 * @example
 * containsContactInfo('Пиши в тг: @nick') // true
 */
export function containsContactInfo(text: string): boolean {
  const normalized = String(text ?? '').toLowerCase().trim()

  if (normalized === '') {
    return false
  }

  const probe = normalizeObfuscation(normalized)

  if (URL_PATTERN.test(probe) || EMAIL_PATTERN.test(probe) || MENTION_PATTERN.test(probe) || DOMAIN_PATTERN.test(probe)) {
    return true
  }

  if (KEYWORD_WITH_HANDLE.test(probe) || KEYWORD_WITH_AT.test(probe) || KEYWORD_WITH_LATIN_HANDLE.test(probe)) {
    return true
  }

  return hasPhone(probe)
}
