import type { Message } from '@/types/entities/Chat'

const PINNED_LIMIT = 60

/**
 * Однострочное превью закреплённого сообщения для пилюли «📌 Закрепы».
 *
 * Пилюля раньше показывала только `body`: у голосовых/фото/файлов/постов
 * без текста она оставалась пустой (нулевая ширина кнопки — по ней нельзя
 * было кликнуть и перейти к сообщению). Теперь безтекстовые типы получают
 * подпись как в списке диалогов (`chatPreviewText`): «🎤 Голосовое · 12 c»,
 * «📷 Фото · name.jpg» и т.д.
 *
 * @param message закреплённое сообщение (пейлоад toArrayPayload)
 * @returns однострочный текст пилюли, никогда не пустой
 */
export function pinnedPreviewText(message: Message | any | null | undefined): string {
  const body = String(message?.body ?? '')
    .replace(/\s+/g, ' ')
    .trim()

  if (body !== '') {
    return body.length > PINNED_LIMIT ? `${body.slice(0, PINNED_LIMIT)}…` : body
  }

  const attachment = message?.attachment ?? null
  const shared = message?.shared_post ?? null

  if (shared && (shared.type === 'flow' || shared.type === 'district')) {
    const label = shared.type === 'district' ? '📰 Новость района' : '📝 Пост'
    const title = String(shared.title ?? shared.excerpt ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    const short = title.length > 40 ? `${title.slice(0, 40)}…` : title
    return short !== '' ? `${label} · ${short}` : label
  }

  const kind = String(attachment?.kind ?? message?.type ?? '')

  if (kind === 'voice' || kind === 'audio') {
    const secs = Number(attachment?.duration ?? 0)
    return secs > 0 ? `🎤 Голосовое · ${secs} c` : '🎤 Голосовое'
  }

  if (attachment?.url || kind === 'image' || kind === 'file') {
    const name = String(attachment?.name ?? '').trim()
    const label = kind === 'image' ? '📷 Фото' : '📎 Файл'
    return name !== '' ? `${label} · ${name}` : label
  }

  return '📌 Закреплено'
}

/**
 * Хук превью закрепов для шапки чата.
 *
 * @returns метод pinnedPreview для пилюль «📌 Закрепы»
 */
export function usePinnedPreview() {
  /**
   * Превью одной пилюли закрепа.
   *
   * @param message закреплённое сообщение
   * @returns однострочный текст пилюли
   */
  function pinnedPreview(message: Message | any | null | undefined): string {
    return pinnedPreviewText(message)
  }

  return { pinnedPreview }
}
