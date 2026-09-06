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

  function onSlideChange(s: any) {
    if (syncing || !isVisible(s)) return
    const list = gallery.photos.value || []
    const p = list[s?.activeIndex]
    if (p && p.id !== gallery.active.value?.id) {
      syncing = true
      ;(gallery.active as Ref<any>).value = p
      syncing = false
    }
  }

  function syncToActive(speed = 0) {
    const i = activeIndex()
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
        syncToActive(0)
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

  return { desktopSwiper, mobileSwiper, ready, activeIndex, registerDesktop, registerMobile, onSlideChange, syncToActive }
}
