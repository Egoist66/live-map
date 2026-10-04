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
 * нигде — возвращается `null`, а `avatarSrcFor` даёт заглушку с инициалами.
 *
 * @param user объект пользователя (ChatUserBrief, SwipeCard, peer и т.п.)
 * @returns готовый URL аватара или null, когда фото нет
 *
 * @example
 * ```ts
 * import { avatarSrcFor } from '@/composables/useAvatar'
 * <Avatar :image="avatarSrcFor(message.sender)" shape="circle" />
 * ```
 */
export function getAvatarUrl(user: any): string | null {
  if (!user) return null

  const avatarUrl = pickUrl(user.avatar_url)
  if (avatarUrl) return avatarUrl

  const telegramUrl = pickUrl(user.telegram_photo_url) ?? pickUrl(user.photo_url)
  if (telegramUrl) return telegramUrl

  const avatarPath = typeof user.avatar_path === 'string' ? user.avatar_path.trim() : ''
  if (avatarPath !== '') return `/storage/${avatarPath.replace(/^\/+/, '')}`

  return null
}

/**
 * Готовый src для `<Avatar :image>`: фото пользователя или заглушка
 * с инициалами (ui-avatars), когда фото нет.
 *
 * @param user объект пользователя
 * @returns URL картинки — всегда строка, никогда пусто
 */
export function avatarSrcFor(user: any): string {
  return getAvatarUrl(user) ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=0F172A&color=fff&bold=true`
}

/**
 * Взять только непустую https/http строку, иначе null.
 *
 * @param value сырое значение поля
 * @returns обрезанный URL или null
 */
function pickUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const url = value.trim()
  if (url === '') return null
  return url
}
