import { computed, ref } from 'vue'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'
import type { ChatWallpaper } from '@/types/entities/Chat'

/**
 * Пресет фона чата.
 */
export type ChatWallpaperPreset = {
  id: string
  label: string
  css: string
}

/**
 * Встроенные градиентные фоны ленты сообщений.
 */
export const CHAT_WALLPAPER_PRESETS: ChatWallpaperPreset[] = [
  { id: 'default', label: 'Без фона', css: '' },
  { id: 'dusk', label: 'Сумерки', css: 'linear-gradient(160deg, #2b1055 0%, #7597de 100%)' },
  { id: 'sunset', label: 'Закат', css: 'linear-gradient(160deg, #ff9966 0%, #ff5e62 100%)' },
  { id: 'ocean', label: 'Океан', css: 'linear-gradient(160deg, #2193b0 0%, #6dd5ed 100%)' },
  { id: 'forest', label: 'Лес', css: 'linear-gradient(160deg, #134e5e 0%, #71b280 100%)' },
  { id: 'berry', label: 'Ягода', css: 'linear-gradient(160deg, #8e2de2 0%, #ff6a9f 100%)' },
  { id: 'graphite', label: 'Графит', css: 'linear-gradient(160deg, #232526 0%, #414345 100%)' },
]

/** Быстрые однотонные цвета для фона. */
export const CHAT_WALLPAPER_COLORS: string[] = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#65a30d',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#64748b',
  '#1e1b4b',
  '#000000',
]

/** Псевдо-id активного режима «своя картинка» (для подсветки в диалоге). */
export const CUSTOM_WALLPAPER_ID = 'custom'

/** Псевдо-id активного режима «свой цвет» (для подсветки в диалоге). */
export const CUSTOM_COLOR_ID = 'color'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

const conversationId = ref<number | null>(null)
const wallpaper = ref<ChatWallpaper | null>(null)
const isReady = ref(false)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

let echoChannel: { stopListening?: (e: string) => unknown } | null = null
let echoConvId: number | null = null
let busOff: (() => void) | null = null

/**
 * Нормализует фон с сервера к виду ChatWallpaper.
 *
 * @param raw сырой пейлоад с бэка
 * @returns фон или null при мусоре
 */
function normalizeWallpaper(raw: unknown): ChatWallpaper | null {
  const src = raw as Partial<ChatWallpaper> | null
  if (!src || typeof src !== 'object') {
    return null
  }
  const type = String((src as { type?: unknown }).type ?? 'none')
  if (type !== 'preset' && type !== 'color' && type !== 'image' && type !== 'none') {
    return null
  }
  if (type === 'none') {
    return { type: 'none', preset: null, color: null, image_url: null }
  }
  if (type === 'preset') {
    const preset = String(src.preset ?? '')
    const known = CHAT_WALLPAPER_PRESETS.some((item) => item.id === preset && preset !== 'default')
    if (!known) {
      return null
    }
    return { type: 'preset', preset, color: null, image_url: null }
  }
  if (type === 'color') {
    const color = String(src.color ?? '')
    if (!HEX_COLOR_RE.test(color)) {
      return null
    }
    return { type: 'color', preset: null, color: color.toLowerCase(), image_url: null }
  }
  const imageUrl = String(src.image_url ?? '')
  if (!imageUrl) {
    return null
  }
  return { type: 'image', preset: null, color: null, image_url: imageUrl }
}

/**
 * Применяет входящий фон, если он относится к открытому диалогу.
 *
 * @param convId id диалога из события
 * @param raw сырой пейлоад фона
 */
function applyIncoming(convId: number, raw: unknown): void {
  if (conversationId.value === null || Number(convId) !== Number(conversationId.value)) {
    return
  }
  const next = normalizeWallpaper(raw)
  if (next) {
    wallpaper.value = next
  }
}

/**
 * Подписывается на сокет открытого диалога (смена фона другом).
 */
function subscribeEcho(): void {
  try {
    if (echoChannel && typeof (echoChannel as { unsubscribe?: () => void }).unsubscribe === 'function') {
      ;(echoChannel as { unsubscribe: () => void }).unsubscribe()
    }
  } catch {}
  echoChannel = null
  echoConvId = null
  const id = conversationId.value
  if (!(id && id > 0)) {
    return
  }
  try {
    const echo = (window as unknown as { Echo?: any }).Echo
    if (!echo) {
      return
    }
    const channel = echo.private(`chat.${id}`)
    channel.listen('.conversation.wallpaper', (event: { conversation_id?: number; wallpaper?: unknown }) => {
      const cid = Number(event?.conversation_id ?? id)
      applyIncoming(cid, event?.wallpaper)
    })
    echoChannel = channel
    echoConvId = id
  } catch {}
}

/**
 * Общий фон беседы: один на всех участников, хранится на сервере.
 *
 * Смена любым собеседником прилетает всем сразу: сокетом
 * `.conversation.wallpaper` и фолбэком `chat:wallpaper` из поллинга.
 * Своя картинка грузится в сторедж — реально сохраняется и видна
 * обоим на всех устройствах (старый IndexedDB-вариант терял её).
 *
 * Состояние общее для всех вызовов хука.
 *
 * @example
 * const wallpaper = useChatWallpaper()
 * wallpaper.bindConversation(conv.id, conv.wallpaper)
 * await wallpaper.applyColor('#7c3aed')
 *
 * @returns состояние фона и действия
 */
export function useChatWallpaper() {
  const presets = CHAT_WALLPAPER_PRESETS
  const colors = CHAT_WALLPAPER_COLORS

  if (!busOff) {
    busOff = busOn('chat:wallpaper', (event) => {
      applyIncoming(Number(event?.conversation_id ?? 0), event?.wallpaper)
    })
  }

  const activePresetId = computed(() => {
    const current = wallpaper.value
    if (!current || current.type === 'none') {
      return CHAT_WALLPAPER_PRESETS[0].id
    }
    if (current.type === 'image') {
      return CUSTOM_WALLPAPER_ID
    }
    if (current.type === 'color') {
      return CUSTOM_COLOR_ID
    }
    return String(current.preset ?? CHAT_WALLPAPER_PRESETS[0].id)
  })

  const customImageUrl = computed(() => {
    const current = wallpaper.value
    return current?.type === 'image' ? (current.image_url ?? null) : null
  })

  const customColor = computed(() => {
    const current = wallpaper.value
    return current?.type === 'color' ? (current.color ?? null) : null
  })

  const hasWallpaper = computed(() => {
    const current = wallpaper.value
    return !!current && current.type !== 'none'
  })

  const isCustomActive = computed(() => wallpaper.value?.type === 'image')

  const isColorActive = computed(() => wallpaper.value?.type === 'color')

  const wallpaperLayerStyle = computed(() => {
    const current = wallpaper.value
    if (!current || current.type === 'none') {
      return {}
    }
    if (current.type === 'image' && current.image_url) {
      return {
        backgroundImage: `url("${current.image_url}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }
    if (current.type === 'color' && current.color) {
      return { background: current.color }
    }
    const preset = presets.find((item) => item.id === current.preset)
    if (!preset || !preset.css) {
      return {}
    }
    return { background: preset.css }
  })

  /**
   * Привязывает хук к открытому диалогу и подписывается на смену фона.
   *
   * @param id id диалога или null при закрытии
   * @param initial начальный фон из detail/list (без запроса)
   */
  function bindConversation(id: number | null, initial?: unknown): void {
    const nextId = id && Number(id) > 0 ? Number(id) : null
    if (nextId !== conversationId.value) {
      conversationId.value = nextId
      subscribeEcho()
    }
    if (initial !== undefined) {
      const next = normalizeWallpaper(initial)
      wallpaper.value = next
      isReady.value = true
    } else if (nextId === null) {
      wallpaper.value = null
    }
  }

  /**
   * Совместимость со старым вызовом без диалога: с диалогом — bind,
   * без — no-op (фон теперь серверный, на всех устройствах один).
   *
   * @param id id диалога
   * @param initial начальный фон
   */
  async function init(id?: number | null, initial?: unknown): Promise<void> {
    if (id !== undefined) {
      bindConversation(id, initial)
      return
    }
    isReady.value = true
  }

  /**
   * Сохраняет фон через API и кладёт ответ в состояние.
   *
   * @param payload пресет/цвет/сброс/картинка
   * @returns true когда сервер принял фон
   */
  async function saveThroughApi(payload: {
    type: 'none' | 'preset' | 'color' | 'image'
    preset?: string | null
    color?: string | null
    image?: File | null
  }): Promise<boolean> {
    const id = conversationId.value
    if (!(id && id > 0)) {
      saveError.value = 'Откройте диалог, чтобы сменить фон'
      return false
    }
    isSaving.value = true
    saveError.value = null
    try {
      const raw = await chatApi.updateWallpaper(id, payload)
      const next = normalizeWallpaper(raw)
      if (!next) {
        saveError.value = 'Сервер вернул странный фон, попробуйте ещё раз'
        return false
      }
      wallpaper.value = next
      return true
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.response?.data?.errors?.image?.[0] ||
        'Не вышло сохранить фон, попробуйте ещё раз'
      saveError.value = String(msg)
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Применяет встроенный пресет как общий фон беседы.
   *
   * @param id id пресета
   * @returns true когда фон применён у всех
   */
  async function applyPreset(id: string): Promise<boolean> {
    const known = presets.some((item) => item.id === id && id !== CHAT_WALLPAPER_PRESETS[0].id)
    if (!known) {
      return resetWallpaper()
    }
    return saveThroughApi({ type: 'preset', preset: id })
  }

  /**
   * Применяет однотонный цвет как общий фон беседы.
   *
   * @param color hex-цвет (#rrggbb)
   * @returns true когда фон применён у всех
   */
  async function applyColor(color: string): Promise<boolean> {
    const clean = String(color ?? '').trim()
    if (!HEX_COLOR_RE.test(clean)) {
      saveError.value = 'Выберите цвет'
      return false
    }
    return saveThroughApi({ type: 'color', color: clean.toLowerCase() })
  }

  /**
   * Загружает свою картинку как общий фон беседы.
   *
   * Файл едет в сторедж через API — квота IndexedDB больше не мешает,
   * картинка реально сохраняется и видна обоим собеседникам.
   *
   * @param file выбранный файл
   * @returns true когда фон применён у всех
   */
  async function uploadCustom(file: File | null): Promise<boolean> {
    if (!file || !file.type.startsWith('image/')) {
      saveError.value = 'Выберите картинку'
      return false
    }
    if (file.size > 5 * 1024 * 1024) {
      saveError.value = 'Картинка больше 5 МБ — выберите поменьше'
      return false
    }
    return saveThroughApi({ type: 'image', image: file })
  }

  /**
   * Убирает общий фон беседы у всех участников.
   *
   * @returns true когда фон убран
   */
  async function resetWallpaper(): Promise<boolean> {
    const ok = await saveThroughApi({ type: 'none' })
    return ok
  }

  return {
    presets,
    colors,
    conversationId,
    wallpaper,
    activePresetId,
    customImageUrl,
    customColor,
    hasWallpaper,
    isCustomActive,
    isColorActive,
    wallpaperLayerStyle,
    isReady,
    isSaving,
    saveError,
    init,
    bindConversation,
    applyPreset,
    applyColor,
    uploadCustom,
    resetWallpaper,
  }
}
