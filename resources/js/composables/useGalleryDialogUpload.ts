import { ref } from 'vue'

interface GalleryLike {
  upload: (file: File, caption: string | null) => Promise<unknown>
}

export function useGalleryDialogUpload(gallery: GalleryLike) {
  const fileInput = ref<HTMLInputElement | null>(null)

  function setFileInput(el: unknown) {
    fileInput.value = (el instanceof HTMLInputElement) ? el : null
  }

  function pickFile() {
    fileInput.value?.click()
  }

  function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    void gallery.upload(f, null)
    ;(e.target as HTMLInputElement).value = ''
  }

  return { fileInput, setFileInput, pickFile, onFile }
}
