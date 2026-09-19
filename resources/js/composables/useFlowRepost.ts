import { ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { useFlowStore } from '@/stores/flow'
import { useRewardToast } from '@/composables/useRewardToast'
import { flowApi } from '@/services/flow.api'
import type { FlowPost, FlowRepostOrigin } from '@/types/flow'

/**
 * Репосты UFlow: тихие, с цитатой и отмена.
 *
 * Репост — лёгкая ссылка на оригинал (медиа не дублируется):
 * карточка показывает оригинал как есть, цитата — сверху.
 * Состояние «уже репостнул» едет в post.my_repost_id с бэка.
 *
 * @example
 * const reposter = useFlowRepost()
 * await reposter.repost(post.id, 'Согласен!')
 * await reposter.unrepost(post)
 */
export function useFlowRepost() {
  const store = useFlowStore()
  const rewards = useRewardToast()
  const busy = ref<Record<number, boolean>>({})
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Проверка занятости кнопки репоста.
   * @param postId пост
   * @returns true пока летит запрос
   */
  function isBusy(postId: number): boolean {
    return !!busy.value[postId]
  }

  /**
   * Контент для карточки: тихий репост показывает оригинал как есть
   * (текст и картинка не дублируются), обычный пост — своё.
   * Цитата (repost_comment) рисуется отдельно поверх оригинала.
   * @param post пост ленты
   * @returns заголовок, текст и картинка для отображения
   */
  function displayOf(post: FlowPost): { title: string | null; body: string; imageUrl: string | null } {
    const origin = post.repost
    if (post.repost_of_id && origin && !post.repost_comment) {
      return { title: origin.title, body: origin.body, imageUrl: origin.image_url }
    }
    return { title: post.title, body: post.body, imageUrl: post.image_url }
  }

  /**
   * Короткий текст оригинала для встройки под цитатой.
   * @param origin оригинал из поста
   * @param limit максимум символов
   */
  function originExcerpt(origin: FlowRepostOrigin | null, limit = 200): string {
    const clean = (origin?.body ?? '').replace(/\s+/g, ' ').trim()
    if (clean.length <= limit) return clean
    return `${clean.slice(0, limit)}…`
  }

  /**
   * Перейти к посту (оригинал из цитаты).
   * @param postId пост
   */
  function goPost(postId: number): void {
    router.visit(`/flow/post/${postId}`)
  }

  /**
   * Репостнуть пост себе на страницу.
   * @param postId оригинал или чужой репост
   * @param comment цитата до 500 символов
   * @returns true при успехе
   */
  async function repost(postId: number, comment?: string | null): Promise<boolean> {
    if (busy.value[postId]) {
      return false
    }
    busy.value = { ...busy.value, [postId]: true }
    try {
      const created = await flowApi.repost(postId, comment?.trim() ? comment.trim() : null)
      store.applyRepost(created)
      rewards.applyReward(created)
      toast?.add({ severity: 'success', summary: 'Репост опубликован', detail: 'Пост появился на вашей странице', life: 3000 })
      return true
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const detail = status === 422
        ? 'Это уже ваш пост'
        : ((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Не вышло сделать репост')
      toast?.add({ severity: status === 422 ? 'info' : 'error', summary: 'Репост', detail, life: 3000 })
      return false
    } finally {
      const next = { ...busy.value }
      delete next[postId]
      busy.value = next
    }
  }

  /**
   * Убрать свой репост (удаляет пост-ссылку).
   * @param post пост или репост из ленты
   * @returns true при успехе
   */
  async function unrepost(post: FlowPost): Promise<boolean> {
    const repostId = post.my_repost_id ?? (post.repost_of_id ? post.id : null)
    if (!repostId || busy.value[repostId]) {
      return false
    }
    const rootId = post.repost_of_id ?? post.id
    busy.value = { ...busy.value, [repostId]: true }
    try {
      await flowApi.remove(repostId)
      store.revertRepost(repostId, rootId)
      toast?.add({ severity: 'success', summary: 'Репост убран', life: 2000 })
      return true
    } catch {
      toast?.add({ severity: 'error', summary: 'Не вышло убрать репост', life: 2500 })
      return false
    } finally {
      const next = { ...busy.value }
      delete next[repostId]
      busy.value = next
    }
  }

  return { busy, isBusy, repost, unrepost, displayOf, originExcerpt, goPost }
}
