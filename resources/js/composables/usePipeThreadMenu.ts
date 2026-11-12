import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useLongPress } from '@/composables/useLongPress'

/** Актуальные флаги карточки pipe, влияющие на состав меню. */
export type PipeThreadMenuFlags = {
  isGuest: boolean
  saved: boolean
  canEdit: boolean
  canDelete: boolean
}

/** Действия над тредом, доступные из меню «⋯» и по клику на карточку. */
export type PipeThreadMenuActions = {
  openThread: () => void
  share: () => void
  save: () => void
  report: () => void
  edit: () => void
  delete: () => void
}

/** Пункт меню, совместимый с model PrimeVue Menu. */
export type PipeThreadMenuItem = {
  label?: string
  icon?: string
  class?: string
  danger?: boolean
  separator?: boolean
  command?: () => void
}

/**
 * Меню действий карточки pipe.
 *
 * На десктопе «⋯» открывает попап PrimeVue, на мобилке — аккуратный
 * bottom-sheet. Долгое нажатие по карточке открывает тот же sheet,
 * поэтому на телефоне не нужно целиться в кнопку.
 *
 * @param getFlags актуальные флаги карточки (гость, избранное, права)
 * @param actions действия над тредом
 * @returns состояние меню и обработчики открытия/долгого нажатия
 *
 * @example
 * const menu = usePipeThreadMenu(
 *   () => ({ isGuest, saved: thread.saved, canEdit, canDelete }),
 *   { share, save, report, edit, delete: askDelete },
 * )
 * menu.open(event)
 */
export function usePipeThreadMenu(
  getFlags: () => PipeThreadMenuFlags,
  actions: PipeThreadMenuActions,
) {
  const menu = ref<{ toggle: (event: Event) => void } | null>(null)
  const sheetOpen = ref(false)
  const isMobile = useMediaQuery('(max-width: 639px)')

  /** Клик после долгого нажатия не должен срабатывать как обычный тап. */
  const suppressClick = ref(false)
  let suppressTimer: ReturnType<typeof setTimeout> | null = null

  function close(): void {
    sheetOpen.value = false
  }

  function run(action: () => void): void {
    close()
    action()
  }

  /**
   * Открывает меню от кнопки «⋯».
   * @param event клик по кнопке
   */
  function open(event: Event): void {
    if (isMobile.value) {
      sheetOpen.value = true
      return
    }

    try {
      menu.value?.toggle(event)
    } catch {
      sheetOpen.value = true
    }
  }

  /** Открывает bottom-sheet по долгому нажатию. */
  function openSheet(): void {
    sheetOpen.value = true
  }

  const longPress = useLongPress(() => {
    suppressClick.value = true
    openSheet()
  }, 520)

  function isInteractiveTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null
    return Boolean(
      element?.closest(
        'a, button, input, textarea, select, .mention-link, [data-mention], [data-no-long-press], [data-no-card-open]',
      ),
    )
  }

  /**
   * Клик по самой карточке открывает тред, если не попал по кнопке/ссылке
   * и пользователь не выделяет текст.
   * @param event клик по карточке
   */
  function onCardClick(event: MouseEvent): void {
    if (isInteractiveTarget(event.target)) return

    const selection = window.getSelection?.()?.toString().trim()
    if (selection) return

    actions.openThread()
  }

  /**
   * Старт долгого нажатия: интерактивные элементы и открытый sheet не трогаем.
   * @param event touch-событие карточки
   */
  function onTouchStart(event: TouchEvent): void {
    if (sheetOpen.value || isInteractiveTarget(event.target)) return
    longPress.start(event)
  }

  function onTouchMove(event: TouchEvent): void {
    longPress.move(event)
  }

  function onTouchEnd(event: TouchEvent): void {
    longPress.end(event)
    if (suppressTimer) clearTimeout(suppressTimer)
    suppressTimer = setTimeout(() => {
      suppressClick.value = false
    }, 350)
  }

  function onTouchCancel(): void {
    longPress.cancel()
    suppressClick.value = false
  }

  /**
   * Правый клик на десктопе открывает то же меню, что и «⋯».
   * @param event контекстное меню карточки
   */
  function onContextMenu(event: MouseEvent): void {
    if (isInteractiveTarget(event.target)) return
    event.preventDefault()
    open(event)
  }

  /**
   * Гасит клик, который браузер шлёт после долгого нажатия.
   * @param event клик по карточке
   */
  function onClickCapture(event: MouseEvent): void {
    if (!suppressClick.value) return
    suppressClick.value = false
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  const items = computed<PipeThreadMenuItem[]>(() => {
    const flags = getFlags()
    const list: PipeThreadMenuItem[] = [
      { label: 'Поделиться', icon: 'pi pi-share-alt', command: () => run(actions.share) },
    ]

    if (!flags.isGuest) {
      list.push({
        label: flags.saved ? 'Убрать из избранного' : 'В избранное',
        icon: flags.saved ? 'pi pi-bookmark-fill' : 'pi pi-bookmark',
        command: () => run(actions.save),
      })
    }

    if (flags.canEdit) {
      list.push({
        label: 'Редактировать',
        icon: 'pi pi-pencil',
        command: () => run(actions.edit),
      })
    }

    if (!flags.isGuest) {
      list.push({ separator: true })
      list.push({
        label: 'Пожаловаться',
        icon: 'pi pi-flag',
        class: 'danger-item !text-red-600',
        danger: true,
        command: () => run(actions.report),
      })
    }

    if (flags.canDelete) {
      list.push({
        label: 'Удалить',
        icon: 'pi pi-trash',
        class: 'danger-item !text-red-600',
        danger: true,
        command: () => run(actions.delete),
      })
    }

    return list
  })

  return {
    menu,
    sheetOpen,
    items,
    open,
    openSheet,
    close,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onContextMenu,
    onClickCapture,
    onCardClick,
  }
}
