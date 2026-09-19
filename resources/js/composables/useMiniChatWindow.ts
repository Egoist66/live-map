import { nextTick, ref, toValue, watch } from 'vue'
import type { Ref } from 'vue'
import { useMiniChat, type MiniWindow } from '@/composables/useMiniChat'
import { resolveMessageStatus } from '@/composables/useChatMessageStatus'
import type { Message } from '@/types/entities/Chat'

/**
 * Логика одного мини-окна диалога: чьи сообщения, статус доставки,
 * время и прилипание скролла к низу.
 *
 * Компонент `MiniChatWindow` только отображает, вся механика — здесь.
 * Статус (`sent/delivered/read`) резолвится тем же резолвером, что и в
 * большом чате, живые обновления едут из подписок `useMiniChat`
 * (сокет Echo + polling несут одни события realtime-шины).
 *
 * @param win реактивное мини-окно из `useMiniChat`
 * @param myId id текущего пользователя (ref или число)
 *
 * @example
 * const { scrollBox, isOwn, statusOf, timeOf, sendCurrent } = useMiniChatWindow(props.win, toRef(props, 'myId'))
 */
export function useMiniChatWindow(win: MiniWindow, myId: Ref<number> | number) {
  const mini = useMiniChat()
  const scrollBox = ref<HTMLElement | null>(null)

  /**
   * Своё ли сообщение (по нему рисуются галочки доставки).
   * @param senderId автор сообщения
   * @returns true для своих сообщений
   */
  function isOwn(senderId: number): boolean {
    const mine = Number(toValue(myId) || 0)
    return Number(senderId) === mine
  }

  /**
   * Статус сообщения для галочек: sending/failed/sent/delivered/read.
   * @param message сообщение из окна
   * @returns ключ статуса для `MessageTicks`
   */
  function statusOf(message: Message): string {
    return resolveMessageStatus(message, isOwn(Number(message?.sender_id)))
  }

  /**
   * Короткое время сообщения.
   * @param iso дата создания
   * @returns часы и минуты
   */
  function timeOf(iso: string | null): string {
    if (!iso) {
      return ''
    }
    try {
      const date = new Date(iso)
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  /**
   * Скролл вниз при новых сообщениях, если юзер уже внизу
   * (читает историю выше — не дёргаем).
   * @param force мотать в любом случае
   */
  function stickToBottom(force = false): void {
    const box = scrollBox.value
    if (!box) {
      return
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120
    if (!force && !nearBottom) {
      return
    }
    void nextTick(() => {
      try {
        box.scrollTop = box.scrollHeight
      } catch { /* скролл недоступен */ }
    })
  }

  watch(
    () => win.messages.length,
    (next, prev) => {
      if (next === 0) {
        return
      }
      const last = win.messages[next - 1]
      const opened = prev === 0
      stickToBottom(opened || isOwn(Number(last?.sender_id)))
    },
  )

  watch(
    () => win.loading,
    (loading) => {
      if (!loading) {
        stickToBottom(true)
      }
    },
  )

  /**
   * Отправить черновик окна.
   */
  function sendCurrent(): void {
    void mini.send(win.convId)
  }

  return { scrollBox, isOwn, statusOf, timeOf, sendCurrent }
}
