import type { Message } from '@/types/entities/Chat'

const PREVIEW_LIMIT = 120

/**
 * Текст превью последнего сообщения для сайдбара чатов.
 *
 * Показывает тело сообщения, а для сообщений без текста (только вложение)
 * — подпись вида «📷 Фото · name.jpg». Свои сообщения помечаются
 * префиксом «Вы: ». Пустой диалог даёт emptyLabel.
 *
 * @param lastMessage последнее сообщение диалога или null
 * @param emptyLabel текст для пустого диалога
 * @param isOwn true если последнее сообщение отправлено мной
 * @returns однострочный текст превью
 */
export function chatPreviewText(lastMessage: Message | null | undefined, emptyLabel = 'Нет сообщений', isOwn = false): string {
  const body = String(lastMessage?.body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  const prefix = isOwn ? 'Вы: ' : ''
  if (body) {
    const text = body.length > PREVIEW_LIMIT ? `${body.slice(0, PREVIEW_LIMIT)}…` : body
    return `${prefix}${text}`
  }
  const attachment = (lastMessage as any)?.attachment ?? null
  const shared = (lastMessage as any)?.shared_post ?? null
  if (shared && (shared.type === 'flow' || shared.type === 'district')) {
    const label = shared.type === 'district' ? '📰 Новость района' : '📝 Пост'
    const title = String(shared.title ?? shared.excerpt ?? '').replace(/\s+/g, ' ').trim()
    const short = title.length > 80 ? `${title.slice(0, 80)}…` : title
    return short ? `${prefix}${label} · ${short}` : `${prefix}${label}`
  }
  const kind = String(attachment?.kind ?? (lastMessage as any)?.type ?? '')
  if (kind === 'voice' || kind === 'audio') {
    const secs = Number((attachment as any)?.duration ?? 0)
    const label = secs > 0 ? `🎤 Голосовое · ${secs} c` : '🎤 Голосовое'
    return `${prefix}${label}`
  }
  if (attachment?.url || kind === 'image' || kind === 'file') {
    const name = String(attachment?.name ?? '').trim()
    const label = kind === 'image' ? '📷 Фото' : '📎 Файл'
    return name ? `${prefix}${label} · ${name}` : `${prefix}${label}`
  }
  return emptyLabel
}

/**
 * Хук превью диалогов для сайдбара: последний текст свой/чужой + вложения.
 *
 * @param currentUserId id текущего пользователя для префикса «Вы: »
 * @returns метод previewText для строк списка чатов
 */
export function useChatPreview(currentUserId?: number) {
  const uid = Number(currentUserId ?? 0) || 0
  /**
   * Превью диалога с автопрефиксом своих сообщений.
   * @param lastMessage последнее сообщение диалога
   * @param emptyLabel текст для пустого диалога
   * @returns однострочный текст превью
   */
  function previewText(lastMessage: Message | null | undefined, emptyLabel = 'Нет сообщений'): string {
    const isOwn = uid > 0 && Number((lastMessage as any)?.sender_id ?? 0) === uid
    return chatPreviewText(lastMessage, emptyLabel, isOwn)
  }
  return { previewText }
}
