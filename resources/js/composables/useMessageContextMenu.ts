import { ref, computed } from 'vue'
import { useToast } from 'primevue/usetoast'

type MsgCallback = (m: any) => void
type DeleteCallback = (id: number) => void

/**
 * Контекстное меню сообщения: копирование (long-press / правый клик), пин, edit/delete.
 * @param opts колбэки владельца и действий
 * @returns привязки для пузырька и модель меню PrimeVue
 */
export function useMessageContextMenu(opts: { isOwn: (m: any) => boolean; onEdit: MsgCallback; onDelete: DeleteCallback; onPin?: MsgCallback; onCopy?: MsgCallback; onReply?: MsgCallback; onSelect?: MsgCallback; isPinned?: (m: any) => boolean }) {
  const cm = ref<any>(null)
  const current = ref<any>(null)
  const toast = (() => { try { return useToast() } catch { return null as any } })()

  /**
   * Копирует текст сообщения в буфер обмена с fallback.
   * @param m сообщение с полем body
   */
  async function copyMessage(m: any): Promise<void> {
    const text = String(m?.body ?? '')
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast?.add({ severity: 'success', summary: 'Скопировано', detail: 'Текст сообщения скопирован', life: 2000 })
    } catch {
      toast?.add({ severity: 'info', summary: 'Копирование', detail: text.slice(0, 120), life: 3000 })
    }
    opts.onCopy?.(m)
  }

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0
  let startPageX = 0
  let startPageY = 0

  /**
   * Часы из ISO-строки для подписи «прочитано».
   *
   * @param iso дата из read_at/delivered_at
   * @returns «14:32» или пусто
   */
  function clockOf(iso: unknown): string {
    try {
      const date = new Date(String(iso ?? ''))

      if (Number.isNaN(date.getTime())) {
        return ''
      }

      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  /**
   * Пункт-статус прочтения своего сообщения (внизу меню, некликабельный).
   *
   * Прочитано — по read_at, иначе доставлено — по delivered_at,
   * иначе просто «Отправлено». Чужим сообщениям не показываем.
   *
   * @param m сообщение
   * @returns пункт меню или null
   */
  function readStatusItem(m: any): { label: string; icon: string } | null {
    if (!opts.isOwn(m)) {
      return null
    }

    if ((m as any).pending) {
      return { label: 'Отправляется…', icon: 'pi pi-clock' }
    }

    const readClock = clockOf(m?.read_at)

    if (readClock !== '') {
      return { label: `Прочитано в ${readClock}`, icon: 'pi pi-eye' }
    }

    const deliveredClock = clockOf(m?.delivered_at)

    if (deliveredClock !== '') {
      return { label: `Доставлено в ${deliveredClock}`, icon: 'pi pi-check' }
    }

    if (m?.id == null) {
      return null
    }

    return { label: 'Отправлено', icon: 'pi pi-clock' }
  }

  const menuModel = computed(() => {
    if (!current.value) return []
    const m = current.value
    const text = String(m?.body ?? '').trim()
    const items: any[] = []
    if (opts.onReply) {
      items.push({ label: 'Ответить', icon: 'pi pi-reply', command: () => opts.onReply!(m) })
    }
    if (text) {
      if (items.length) items.push({ separator: true })
      items.push({ label: 'Скопировать', icon: 'pi pi-copy', command: () => copyMessage(m) })
    }
    if (opts.onPin) {
      const pinned = opts.isPinned?.(m) ?? !!(m as any).is_pinned
      if (items.length) items.push({ separator: true })
      items.push({ label: pinned ? 'Открепить' : 'Закрепить', icon: 'pi pi-thumbtack', command: () => opts.onPin!(m) })
    }
    if (opts.onSelect) {
      if (items.length) items.push({ separator: true })
      items.push({ label: 'Выделить', icon: 'pi pi-check-square', command: () => opts.onSelect!(m) })
    }
    if (!opts.isOwn(m)) return items
    if (items.length) items.push({ separator: true })
    items.push(
      { label: 'Редактировать', icon: 'pi pi-pencil', command: () => opts.onEdit(m) },
      { separator: true },
      { label: 'Удалить', icon: 'pi pi-trash', class: 'danger-item !text-red-600', command: () => opts.onDelete(m?.id) },
    )
    const seen = readStatusItem(m)
    if (seen) {
      items.push({ separator: true })
      items.push({ ...seen, disabled: true, class: 'pointer-events-none opacity-70' })
    }
    return items
  })

  function openAt(e: any, m: any) {
    if ((m as any).pending) return
    if (!String(m?.body ?? '').trim() && !opts.isOwn(m) && !opts.onPin) return
    current.value = m
    try { cm.value?.show(e) } catch {}
  }

  function onContextMenu(e: MouseEvent, m: any) {
    e.preventDefault()
    openAt(e, m)
  }

  function onTouchStart(e: TouchEvent, m: any) {
    if (!String(m?.body ?? '').trim() && !opts.isOwn(m) && !opts.onPin) return
    const t = e.touches[0]
    if (!t) return
    startX = t.clientX
    startY = t.clientY
    startPageX = t.pageX
    startPageY = t.pageY
    if (pressTimer) clearTimeout(pressTimer)
    const target = m
    pressTimer = setTimeout(() => {
      try { if (navigator.vibrate) navigator.vibrate(40) } catch {}
      openAt({
        pageX: startPageX,
        pageY: startPageY,
        clientX: startX,
        clientY: startY,
        preventDefault: () => {},
        stopPropagation: () => {},
      } as any, target)
    }, 550)
  }

  function onTouchMove(e: TouchEvent) {
    if (!pressTimer) return
    const t = e.touches[0]
    if (!t) return
    if (Math.abs(t.clientX - startX) > 12 || Math.abs(t.clientY - startY) > 12) {
      if (pressTimer) clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function onTouchEnd() {
    if (pressTimer) clearTimeout(pressTimer)
    pressTimer = null
  }

  function bindMessage(m: any) {
    return {
      contextmenu: (e: MouseEvent) => onContextMenu(e, m),
      touchstart: (e: TouchEvent) => onTouchStart(e, m),
      touchmove: onTouchMove,
      touchend: onTouchEnd,
      touchcancel: onTouchEnd,
    }
  }

  return { cm, current, menuModel, show: openAt, onContextMenu, bindMessage, copyMessage }
}
