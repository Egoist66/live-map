import { nextTick, ref, watch, type Ref } from 'vue'

interface GalleryLike {
  photos: Ref<Array<{ id: number }>>
  active: Ref<{ id: number } | null>
  viewerOpen: Ref<boolean>
}

export function usePhotoViewerSwiper(gallery: GalleryLike, opts?: { onEscape?: () => void }) {
  const desktopSwiper = ref<any>(null)
  const mobileSwiper = ref<any>(null)
  const ready = ref(false)
  let syncing = false

  function activeIndex(): number {
    const list = gallery.photos.value || []
    const id = gallery.active.value?.id
    const i = list.findIndex((x) => x.id === id)
    return i >= 0 ? i : 0
  }

  function isVisible(s: any): boolean {
    const el = s?.el as HTMLElement | undefined
    if (!el) return true
    return el.clientWidth > 0 && el.clientHeight > 0
  }

  function liveSwipers(): any[] {
    return [desktopSwiper.value, mobileSwiper.value].filter((s) => s && !s.destroyed && isVisible(s))
  }

  function allSwipers(): any[] {
    return [desktopSwiper.value, mobileSwiper.value].filter((s) => s && !s.destroyed)
  }

  function registerDesktop(s: any) {
    desktopSwiper.value = s
    if (gallery.viewerOpen.value) syncToActive(0)
  }

  function registerMobile(s: any) {
    mobileSwiper.value = s
    if (gallery.viewerOpen.value) syncToActive(0)
  }

  /**
   * Живой инстанс Swiper для зум-фолбэка (даблклик/даблтап вручную).
   */
  function zoomTarget(): any | null {
    const live = liveSwipers()
    if (live.length > 0) {
      return live[0]
    }
    const all = allSwipers()
    return all.length > 0 ? all[0] : null
  }

  /**
   * Гасит зум перед сменой слайда: увеличенный кадр не должен
   * переезжать на соседнее фото в зумированном виде.
   */
  function zoomOutAll(): void {
    for (const s of allSwipers()) {
      try {
        s?.zoom?.out?.()
      } catch { /* noop */ }
    }
  }

  /**
   * Ручной тоггл зума (даблклик / даблтап по фото).
   * Страховка поверх встроенного `doubleTap` Swiper: если жест
   * съел внешний скролл-контейнер, зум всё равно сработает.
   */
  function toggleZoom(): void {
    const target = zoomTarget()
    if (!target) {
      return
    }
    try {
      target?.zoom?.toggle?.()
    } catch { /* noop */ }
  }

  function onSlideChange(s: any) {
    if (syncing || !isVisible(s)) return
    zoomOutAll()
    const list = gallery.photos.value || []
    const realIndex = typeof s?.realIndex === 'number' ? s.realIndex : s?.activeIndex
    const p = list[realIndex]
    if (p && p.id !== gallery.active.value?.id) {
      syncing = true
      ;(gallery.active as Ref<any>).value = p
      syncing = false
    }
  }

  /**
   * Переводит слайдер на активное фото обычным `slideTo`.
   * Loop-режим во вьювере отключён намеренно: он клонирует слайды
   * (визуальные дубли) и вместе с auto-height/observer дёргает
   * высоту при любом изменении рядом (пилюля ответа, textarea).
   * Зацикливание даёт `stepPhoto` галереи через остаток от деления.
   * @param speed скорость анимации в мс (0 — мгновенно, для открытия)
   */
  function syncToActive(speed = 350) {
    const i = activeIndex()
    zoomOutAll()
    for (const s of allSwipers()) {
      try {
        if (typeof s.update === 'function') s.update()
        if (s.activeIndex !== i && typeof s.slideTo === 'function') s.slideTo(i, speed)
      } catch { /* noop */ }
    }
  }

  async function syncAfterOpen() {
    ready.value = false
    desktopSwiper.value = null
    mobileSwiper.value = null
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncToActive(0)
        ready.value = true
      })
    })
  }

  watch(
    () => gallery.active.value?.id,
    () => {
      if (!gallery.viewerOpen.value || syncing) return
      syncing = true
      try {
        syncToActive()
      } finally {
        syncing = false
      }
    },
  )

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') opts?.onEscape?.()
  }

  watch(
    () => gallery.viewerOpen.value,
    (open) => {
      if (open) {
        window.addEventListener('keydown', onKeydown)
        void syncAfterOpen()
      } else {
        window.removeEventListener('keydown', onKeydown)
        ready.value = false
        desktopSwiper.value = null
        mobileSwiper.value = null
      }
    },
  )

  return { desktopSwiper, mobileSwiper, ready, activeIndex, registerDesktop, registerMobile, onSlideChange, syncToActive, toggleZoom, zoomOutAll }
}
