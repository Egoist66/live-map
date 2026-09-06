import { ref } from 'vue'
import { adminUpdatesApi } from '@/services/app-updates.api'

export function useAdminAppUpdates() {
  const items = ref<any[]>([])
  const meta = ref<any>({ current_page: 1, last_page: 1, total: 0 })
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const formTitle = ref('')
  const formBody = ref('')
  const formVersion = ref('')
  const formPublish = ref(true)
  const editingId = ref<number | null>(null)
  const showDialog = ref(false)
  const deletingId = ref<number | null>(null)

  async function load(page = 1) {
    loading.value = true
    error.value = null
    try {
      const d: any = await adminUpdatesApi.list(page)
      items.value = d?.data ?? []
      meta.value = { current_page: d?.current_page ?? 1, last_page: d?.last_page ?? 1, total: d?.total ?? items.value.length }
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить новости'
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    editingId.value = null
    formTitle.value = ''
    formBody.value = ''
    formVersion.value = ''
    formPublish.value = true
    showDialog.value = true
  }

  function openEdit(item: any) {
    editingId.value = item.id
    formTitle.value = item.title ?? ''
    formBody.value = item.body ?? ''
    formVersion.value = item.version ?? ''
    formPublish.value = !!item.is_published
    showDialog.value = true
  }

  const canSave = () => formTitle.value.trim().length >= 3 && formBody.value.trim().length >= 5

  async function save() {
    if (!canSave()) return
    saving.value = true
    error.value = null
    try {
      const payload = { title: formTitle.value.trim(), body: formBody.value.trim(), version: formVersion.value.trim() || undefined, is_published: formPublish.value }
      if (editingId.value) {
        const updated: any = await adminUpdatesApi.update(editingId.value, payload)
        const i = items.value.findIndex((x) => x.id === editingId.value)
        if (i >= 0) items.value[i] = { ...items.value[i], ...updated }
      } else {
        await adminUpdatesApi.create(payload)
        await load(1)
      }
      showDialog.value = false
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.response?.data?.errors?.title?.[0] || 'Не удалось сохранить'
    } finally {
      saving.value = false
    }
  }

  async function togglePublish(item: any, value: boolean) {
    try {
      const updated: any = await adminUpdatesApi.update(item.id, { is_published: value })
      item.is_published = updated.is_published
      item.published_at = updated.published_at
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось обновить'
    }
  }

  async function remove(id: number) {
    deletingId.value = id
    try {
      await adminUpdatesApi.remove(id)
      items.value = items.value.filter((x) => x.id !== id)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось удалить'
    } finally {
      deletingId.value = null
    }
  }

  return { items, meta, loading, saving, error, formTitle, formBody, formVersion, formPublish, editingId, showDialog, deletingId, load, openCreate, openEdit, canSave, save, togglePublish, remove }
}
