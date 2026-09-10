import type { Message } from '@/types/entities/Chat'

const PREVIEW_LIMIT = 120

/**
 * Текст превью последнего сообщения для сайдбара чатов.
 *
 * Показывает тело сообщения, а для сообщений без текста (только вложение)
 * — подпись вида «📷 Фото · name.jpg». Пустой диалог даёт «Нет сообщений».
 *
 * @param lastMessage последнее сообщение диалога или null
 * @param emptyLabel текст для пустого диалога
 * @returns однострочный текст превью
 */
export function chatPreviewText(lastMessage: Message | null | undefined, emptyLabel = 'Нет сообщений'): string {
  const body = String(lastMessage?.body ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (body) {
    return body.length > PREVIEW_LIMIT ? `${body.slice(0, PREVIEW_LIMIT)}…` : body
  }
  const attachment = (lastMessage as any)?.attachment ?? null
  const kind = String(attachment?.kind ?? (lastMessage as any)?.type ?? '')
  if (attachment?.url || kind === 'image' || kind === 'file') {
    const name = String(attachment?.name ?? '').trim()
    const label = kind === 'image' ? '📷 Фото' : '📎 Файл'
    return name ? `${label} · ${name}` : label
  }
  return emptyLabel
}

/**
 * Хук превью диалогов для сайдбара: последний текст свой/чужой + вложения.
 *
 * @returns метод previewText для строк списка чатов
 */
export function useChatPreview() {
  return { previewText: chatPreviewText }
}
