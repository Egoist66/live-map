import { ref } from 'vue'
import { api } from '@/services/api'

const downloadingUrl = ref<string | null>(null)

/**
 * Скачивание файла по URL сразу на диск, без открытия во вкладке.
 *
 * Прямая ссылка на .txt открывается браузером во вкладке, где кириллица
 * может показаться абракадаброй. Здесь файл тянем blob-ом и отдаём через
 * временную ссылку с download — браузер сразу сохраняет файл с нужным именем.
 *
 * @example
 * const { download, downloadingUrl } = useFileDownload()
 * await download('/api/chat/attachments/12/download', 'SOS-чат.txt')
 */
export function useFileDownload() {
  /**
   * Скачивает файл по URL с заданным именем.
   *
   * @param url ссылка на файл (API download-роут или /storage)
   * @param fileName имя сохраняемого файла
   * @returns true если скачивание запущено
   */
  async function download(url: string | null | undefined, fileName?: string | null): Promise<boolean> {
    if (!url) {
      return false
    }

    const name = (fileName || 'файл').slice(0, 120)

    downloadingUrl.value = url

    try {
      const res = await api.get(url, { responseType: 'blob' })
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data])
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)

      return true
    } catch {
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = name
        document.body.appendChild(link)
        link.click()
        link.remove()

        return true
      } catch {
        return false
      }
    } finally {
      downloadingUrl.value = null
    }
  }

  return { downloadingUrl, download }
}
