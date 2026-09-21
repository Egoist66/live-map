import { computed, ref } from 'vue'
import { galleryApi } from '@/services/gallery.api'
import { reactionsApi } from '@/services/reactions.api'
import { flowApi } from '@/services/flow.api'

/**
 * Один лайкер в тултипе и модалке (фото, пины, посты UFlow).
 */
export interface LikerItem {
  user_id: number | null
  name: string
  profile_slug?: string | null
  avatar_url: string | null
  is_incognito?: boolean
  type?: string
}

export type LikerKind = 'photo' | 'pin' | 'flow'

/**
 * Сколько имён показывать в тултипе, остальное уходит в «+N» и модалку.
 */
export const LIKERS_PREVIEW_LIMIT = 7

const REACTION_EMOJI: Record<string, string> = {
  like: '❤️',
  fire: '🔥',
  useful: '👍',
  laugh: '😂',
  sad: '😢',
  angry: '😡',
}

/**
 * Эмодзи типа реакции пина для строк модалки.
 *
 * @param type тип реакции с бэкенда
 * @returns эмодзи или пустая строка
 * @example
 * reactionEmoji('fire') // '🔥'
 */
export function reactionEmoji(type?: string | null): string {
  if (!type) {
    return ''
  }
  return REACTION_EMOJI[type] ?? ''
}

/**
 * Ленивое превью «кто лайкнул» для тултипа и модалки.
 *
 * Грузит список только по ховеру/открытию, кэширует по id сущности.
 * Модалка всегда обновляет данные, тултип пользуется кэшем.
 *
 * @param kind фото, пин или пост
 * @param getId текущий id сущности
 * @param getTotal счётчик лайков сущности (для гейта тултипа)
 * @returns состояние, текст тултипа и действия
 * @example
 * const likers = useLikersPreview('pin', () => props.pin?.id, () => props.pin?.reactions_count)
 * // <div v-tooltip="likers.tooltip.value" @mouseenter="likers.ensure()">
 */
export function useLikersPreview(
  kind: LikerKind,
  getId: () => number | null | undefined,
  getTotal: () => number | null | undefined,
) {
  const likers = ref<LikerItem[]>([])
  const serverTotal = ref(0)
  const loading = ref(false)
  const loadedId = ref<number | null>(null)
  const opened = ref(false)

  const total = computed(() => {
    const live = Number(getTotal() ?? 0)
    if (loadedId.value === Number(getId())) {
      return Math.max(serverTotal.value, live)
    }
    return live
  })

  const hasLikes = computed(() => total.value > 0)

  const previewNames = computed(() => {
    if (!hasLikes.value) {
      return []
    }
    if (loadedId.value !== Number(getId())) {
      return []
    }
    return likers.value.slice(0, LIKERS_PREVIEW_LIMIT).map((l) => l.name || 'Пользователь')
  })

  const previewRest = computed(() => Math.max(0, total.value - previewNames.value.length))

  const tooltipText = computed(() => {
    if (!hasLikes.value) {
      return ''
    }
    if (loadedId.value !== Number(getId())) {
      return loading.value ? 'Загружаем…' : ''
    }
    const names = previewNames.value.join(', ')
    if (!names) {
      return ''
    }
    return previewRest.value > 0 ? `${names} +${previewRest.value}` : names
  })

  const tooltip = computed(() => ({
    value: tooltipText.value,
    disabled: !tooltipText.value,
  }))

  /**
   * Загружает лайкеров сущности и нормализует под общий вид.
   *
   * @param id id сущности
   */
  async function load(id: number): Promise<void> {
    loading.value = true
    try {
      if (kind === 'photo') {
        const res = await galleryApi.likers(id)
        likers.value = (res.likers ?? []).map((l) => ({
          user_id: l.user_id,
          name: l.is_incognito ? 'Тайный поклонник' : l.name,
          profile_slug: l.is_incognito ? null : (l.profile_slug ?? null),
          avatar_url: l.avatar_url,
          is_incognito: l.is_incognito,
        }))
        serverTotal.value = Number(res.total ?? 0)
      } else if (kind === 'pin') {
        const res = await reactionsApi.likers(id)
        likers.value = (res.likers ?? []).map((l) => ({
          user_id: l.user_id,
          name: l.name,
          profile_slug: l.profile_slug ?? null,
          avatar_url: l.avatar_url,
          type: l.type,
        }))
        serverTotal.value = Number(res.total ?? 0)
      } else {
        const res = await flowApi.likers(id)
        likers.value = (res.likers ?? []).map((l) => ({
          user_id: l.user_id,
          name: l.name,
          profile_slug: l.profile_slug ?? null,
          avatar_url: l.avatar_url,
        }))
        serverTotal.value = Number(res.total ?? 0)
      }
      loadedId.value = id
    } catch {
      likers.value = []
      serverTotal.value = 0
    } finally {
      loading.value = false
    }
  }

  /**
   * Догружает список для тултипа, если его ещё нет (ховер).
   *
   * @returns void
   */
  async function ensure(): Promise<void> {
    const id = Number(getId() ?? 0)
    if (!id || loading.value || loadedId.value === id) {
      return
    }
    await load(id)
  }

  /**
   * Открывает модалку со свежим списком.
   *
   * @returns void
   */
  async function open(): Promise<void> {
    const id = Number(getId() ?? 0)
    if (!id) {
      return
    }
    opened.value = true
    await load(id)
  }

  /**
   * Закрывает модалку.
   */
  function close(): void {
    opened.value = false
  }

  return { likers, total, loading, opened, hasLikes, tooltip, ensure, open, close }
}
