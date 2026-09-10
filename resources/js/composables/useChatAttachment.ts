import { ref } from 'vue'
import { compressImageFile } from '@/utils/image'

/** Макс вес вложения в чате: 10 МБ. */
export const CHAT_MAX_BYTES = 10 * 1024 * 1024

/** Цель сжатия фото в чате: 4 МБ — диск экономим, качество держим. */
export const CHAT_COMPRESSED_TARGET = 4 * 1024 * 1024

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip']

const FORBIDDEN_EXTS = [
  'php', 'phtml', 'phar', 'exe', 'msi', 'bat', 'cmd', 'com', 'scr',
  'sh', 'bash', 'zsh', 'js', 'mjs', 'html', 'htm', 'svg', 'jar',
  'ps1', 'vbs', 'dll', 'so', 'dylib', 'apk', 'deb', 'rpm',
]

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

/**
 * Проверяет расширение файла по имени.
 * @param name имя файла
 * @returns расширение в нижнем регистре без точки
 */
export function chatFileExt(name: string): string {
  const parts = String(name || '').split('.')
  const ext = parts.length > 1 ? parts.pop() : ''
  return String(ext || '').toLowerCase()
}

/**
 * Проверяет, что файл картинка по расширению.
 * @param name имя файла
 * @returns true для jpg/png/webp/gif
 */
export function isChatImage(name: string): boolean {
  return IMAGE_EXTS.includes(chatFileExt(name))
}

/**
 * Форматирует размер файла для превью.
 * @param size размер в байтах
 * @returns строка вида "1.2 МБ"
 * @example
 * formatChatSize(1536) // "1.5 КБ"
 */
export function formatChatSize(size: number | null | undefined): string {
  const bytes = Number(size) || 0
  if (bytes < 1024) {
    return `${bytes} Б`
  }
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${kb.toFixed(1)} КБ`
  }
  const mb = kb / 1024
  return `${mb.toFixed(1)} МБ`
}

/**
 * Вложение чата: валидация, сжатие картинок, превью.
 * @returns состояние файла и helpers
 */
export function useChatAttachment() {
  const file = ref<File | null>(null)
  const previewUrl = ref<string | null>(null)
  const error = ref<string | null>(null)
  const processing = ref(false)

  /**
   * Проверяет файл до отправки: тип и вес.
   * @param target исходный файл из input
   * @returns текст ошибки или null если ок
   */
  function validateChatFile(target: File): string | null {
    const ext = chatFileExt(target.name)
    const dotParts = String(target.name || '').toLowerCase().split('.')
    const hasForbidden = dotParts.some((p) => FORBIDDEN_EXTS.includes(p))
    if (hasForbidden) {
      return 'Такой тип файла запрещён'
    }
    if (!ALLOWED_EXTS.includes(ext)) {
      return 'Можно фото (jpg, png, webp, gif) и документы (pdf, doc, docx, xls, xlsx, txt, zip)'
    }
    if (target.size > CHAT_MAX_BYTES) {
      return 'Файл слишком большой (макс 10 МБ)'
    }
    return null
  }

  /**
   * Принимает файл из input: валидирует, жмёт картинки.
   * @param target исходный файл
   * @returns true если файл принят
   */
  async function pick(target: File | null): Promise<boolean> {
    error.value = null
    if (!target) {
      return false
    }
    const bad = validateChatFile(target)
    if (bad) {
      error.value = bad
      return false
    }
    processing.value = true
    try {
      const next = isChatImage(target.name) ? await compressImageFile(target, 1920, 0.84, CHAT_COMPRESSED_TARGET) : target
      if (next.size > CHAT_MAX_BYTES) {
        error.value = 'Файл больше 10 МБ'
        return false
      }
      clearPreview()
      file.value = next
      const kind = isChatImage(next.name) ? 'image' : 'file'
      if (kind === 'image') {
        previewUrl.value = URL.createObjectURL(next)
      }
      return true
    } finally {
      processing.value = false
    }
  }

  /**
   * Убирает выбранный файл и чистит objectURL.
   */
  function clear(): void {
    clearPreview()
    file.value = null
    error.value = null
  }

  /**
   * Чистит превью-URL без сброса ошибки.
   */
  function clearPreview(): void {
    const url = previewUrl.value
    previewUrl.value = null
    if (url) {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    }
  }

  return { file, previewUrl, error, processing, pick, clear, validateChatFile }
}
