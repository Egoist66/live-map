import { ref, computed } from 'vue'

type MsgCallback = (m: any) => void
type DeleteCallback = (id: number) => void

export function useMessageContextMenu(opts: { isOwn: (m: any) => boolean; onEdit: MsgCallback; onDelete: DeleteCallback; onPin?: MsgCallback; isPinned?: (m: any) => boolean }) {
  const cm = ref<any>(null)
  const current = ref<any>(null)

  let pressTimer: ReturnType<typeof setTimeout> | null = null
  let startX = 0
  let startY = 0

  const menuModel = computed(() => {
    if (!current.value) return []
    const m = current.value
    const items: any[] = []
    if (opts.onPin) {
      const pinned = opts.isPinned?.(m) ?? !!(m as any).is_pinned
      items.push({ label: pinned ? 'Открепить' : 'Закрепить', icon: 'pi pi-thumbtack', command: () => opts.onPin!(m) })
      items.push({ separator: true })
    }
    if (!opts.isOwn(m)) return items
    items.push(
      { label: 'Редактировать', icon: 'pi pi-pencil', command: () => opts.onEdit(m) },
      { separator: true },
      { label: 'Удалить', icon: 'pi pi-trash', command: () => opts.onDelete(m.id) },
    )
    return items
  })

  function openAt(e: any, m: any) {
    if ((m as any).pending) return
    current.value = m
    if (!opts.isOwn(m) && !opts.onPin) return
    try { cm.value?.show(e) } catch {}
  }

  function onContextMenu(e: MouseEvent, m: any) {
    e.preventDefault()
    openAt(e, m)
  }

  function onTouchStart(e: TouchEvent, m: any) {
    if (!opts.isOwn(m) && !opts.onPin) return
    const t = e.touches[0]
    if (!t) return
    startX = t.clientX
    startY = t.clientY
    if (pressTimer) clearTimeout(pressTimer)
    const target = m
    pressTimer = setTimeout(() => {
      try { if (navigator.vibrate) navigator.vibrate(40) } catch {}
      openAt({ clientX: startX, clientY: startY, preventDefault: () => {} } as any, target)
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
      onContextmenu: (e: MouseEvent) => onContextMenu(e, m),
      onTouchstart: (e: TouchEvent) => onTouchStart(e, m),
      onTouchmove: onTouchMove,
      onTouchend: onTouchEnd,
    }
  }

  return { cm, current, menuModel, show: openAt, onContextMenu, bindMessage }
}
