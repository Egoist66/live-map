/**
 * Единый резолвер аватара пользователя для всего чата и списков людей.
 *
 * Приоритет источников (первый непустой побеждает):
 * 1. `avatar_url` — уже готовый URL с бэка (включает fallback на Telegram-фото);
 * 2. `telegram_photo_url` / `photo_url` — прямое фото из Telegram, если бэк
 *    отдал его отдельным полем (например, обрезанный select без аксессора);
 * 3. `avatar_path` — локальный/S3 путь загруженного аватара (`/storage/...`).
 *
 * Покрывает оба сценария регистрации: обычная (загрузил аватарку) и вход
 * через Telegram (фото подтянулось в `telegram_photo_url`). Если фото нет
 * нигде — возвращается `null`, а `avatarSrcFor` даёт SVG-заглушку с человеком.
 *
 * @example
 * ```ts
 * import { avatarSrcFor } from '@/composables/useAvatar'
 * <Avatar :image="avatarSrcFor(message.sender)" shape="circle" />
 * ```
 */

/**
 * SVG-заглушка аватара (силуэт человека), data-URI.
 *
 * Нейтрально-серая, одинаково читается на светлой и тёмной теме.
 * Строится через `encodeURIComponent`, чтобы разметку можно было
 * держать читаемой, а не процентить вручную.
 *
 * Используется как фолбэк везде, где нет фото: `avatarSrcFor`
 * возвращает её вместо внешнего `ui-avatars`, а `UserAvatar`
 * по пустому `src` рисует тот же силуэт инлайном (чётче + `currentColor`
 * под тему).
 */
export const AVATAR_PLACEHOLDER_SVG: string =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#D6D3D1"/><circle cx="32" cy="23" r="11" fill="#A8A29E"/><path d="M13 52c3-10 10-15 19-15s16 5 19 15v1H13z" fill="#A8A29E"/></svg>',
  )

/**
 * Резолвер аватара: готовый URL фото или null, когда фото нет.
 *
 * @param user объект пользователя (ChatUserBrief, SwipeCard, peer и т.п.)
 * @returns готовый URL аватара или null, когда фото нет
 */
export function getAvatarUrl(user: any): string | null {
  if (!user) {
    return null
  }

  const avatarUrl = pickUrl(user.avatar_url)

  if (avatarUrl) {
    return avatarUrl
  }

  const telegramUrl = pickUrl(user.telegram_photo_url) ?? pickUrl(user.photo_url)

  if (telegramUrl) {
    return telegramUrl
  }

  const avatarPath = typeof user.avatar_path === 'string' ? user.avatar_path.trim() : ''

  if (avatarPath !== '') {
    return `/storage/${avatarPath.replace(/^\/+/, '')}`
  }

  return null
}

/**
 * Есть ли у пользователя реальное фото (любой из источников).
 *
 * @param user объект пользователя (ChatUserBrief, SwipeCard, peer и т.п.)
 * @returns true, когда `getAvatarUrl` нашёл фото
 */
export function hasAvatar(user: any): boolean {
  return getAvatarUrl(user) !== null
}

/**
 * Готовый src для `<Avatar :image>`: фото пользователя или SVG-заглушка
 * с силуэтом человека, когда фото нет.
 *
 * @param user объект пользователя
 * @returns URL картинки — всегда строка, никогда пусто
 */
export function avatarSrcFor(user: any): string {
  return getAvatarUrl(user) ?? AVATAR_PLACEHOLDER_SVG
}

/**
 * Взять только непустую https/http строку, иначе null.
 *
 * @param value сырое значение поля
 * @returns обрезанный URL или null
 */
function pickUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const url = value.trim()

  if (url === '') {
    return null
  }

  return url
}
