import { computed, ref } from 'vue'
import { useForm } from 'vee-validate'
import { adminReferenceApi, type ReferencePage } from '@/services/reference.api'
import { referenceSchemas, type ReferenceSlug } from '@/validation/schemas/reference.schema'

const SLUG_LABELS: Record<string, string> = {
  contacts: 'Контакты',
  privacy: 'Политика конфиденциальности',
  offer: 'Публичная оферта',
}

interface ReferenceFormValues {
  title: string
  body: string | null
  company_name: string | null
  inn: string | null
  ogrn: string | null
  address: string | null
  email: string | null
  phone: string | null
  version: string | null
  effective_date: string | null
  is_published: boolean
}

/**
 * Хук управления справочными страницами в админ-панели.
 * У каждого раздела своя zod-схема валидации.
 * @returns Состояние списка, vee-validate форма и методы CRUD.
 * @example const refs = useAdminReference(); await refs.load()
 */
export function useAdminReference() {
  const items = ref<ReferencePage[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)

  const editingId = ref<number | null>(null)
  const showDialog = ref(false)
  const formSlug = ref<ReferenceSlug>('contacts')

  const activeSchema = computed(() => referenceSchemas[formSlug.value])

  const form = useForm<ReferenceFormValues>({
    validationSchema: activeSchema,
    initialValues: {
      title: '',
      body: '',
      company_name: '',
      inn: '',
      ogrn: '',
      address: '',
      email: '',
      phone: '',
      version: '',
      effective_date: '',
      is_published: false,
    },
  })

  const [title, titleAttrs] = form.defineField('title')
  const [body, bodyAttrs] = form.defineField('body')
  const [companyName, companyNameAttrs] = form.defineField('company_name')
  const [inn, innAttrs] = form.defineField('inn')
  const [ogrn, ogrnAttrs] = form.defineField('ogrn')
  const [address, addressAttrs] = form.defineField('address')
  const [email, emailAttrs] = form.defineField('email')
  const [phone, phoneAttrs] = form.defineField('phone')
  const [version, versionAttrs] = form.defineField('version')
  const [effectiveDate, effectiveDateAttrs] = form.defineField('effective_date')
  const [isPublished, isPublishedAttrs] = form.defineField('is_published')

  function slugLabel(slug: string) {
    return SLUG_LABELS[slug] ?? slug
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const pageData = await adminReferenceApi.list(1)
      items.value = pageData?.data ?? []
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } } }
      error.value = axiosError?.response?.data?.message || 'Не удалось загрузить справочники'
    } finally {
      loading.value = false
    }
  }

  function fillForm(item: Partial<ReferencePage>) {
    form.setValues({
      title: item.title ?? '',
      body: item.body ?? '',
      company_name: item.meta?.company_name ?? '',
      inn: item.meta?.inn ?? '',
      ogrn: item.meta?.ogrn ?? '',
      address: item.meta?.address ?? '',
      email: item.meta?.email ?? '',
      phone: item.meta?.phone ?? '',
      version: item.meta?.version ?? '',
      effective_date: item.meta?.effective_date ?? '',
      is_published: !!item.is_published,
    })
  }

  function openCreate(slug: ReferenceSlug = 'contacts') {
    editingId.value = null
    formSlug.value = slug
    form.resetForm()
    fillForm({})
    showDialog.value = true
  }

  function openEdit(item: ReferencePage) {
    editingId.value = item.id
    formSlug.value = item.slug as ReferenceSlug
    form.resetForm()
    fillForm(item)
    showDialog.value = true
  }

  function buildPayload(values: ReferenceFormValues) {
    const textOrNull = (value: unknown) => {
      const text = String(value ?? '').trim()
      return text ? text : null
    }

    return {
      slug: formSlug.value,
      title: String(values.title ?? '').trim(),
      body: textOrNull(values.body),
      is_published: !!values.is_published,
      meta: {
        company_name: textOrNull(values.company_name) ?? undefined,
        inn: textOrNull(values.inn) ?? undefined,
        ogrn: textOrNull(values.ogrn) ?? undefined,
        address: textOrNull(values.address) ?? undefined,
        email: textOrNull(values.email) ?? undefined,
        phone: textOrNull(values.phone) ?? undefined,
        version: textOrNull(values.version) ?? undefined,
        effective_date: textOrNull(values.effective_date) ?? undefined,
      },
    }
  }

  const save = form.handleSubmit(async (values) => {
    saving.value = true
    error.value = null
    try {
      const payload = buildPayload(values)
      if (editingId.value) {
        const updated = await adminReferenceApi.update(editingId.value, payload)
        const index = items.value.findIndex((item) => item.id === editingId.value)
        if (index >= 0) {
          items.value[index] = { ...items.value[index], ...updated }
        }
      } else {
        await adminReferenceApi.create(payload)
        await load()
      }
      showDialog.value = false
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } } }
      error.value = axiosError?.response?.data?.message || 'Не удалось сохранить'
    } finally {
      saving.value = false
    }
  })

  async function togglePublish(item: ReferencePage, value: boolean) {
    try {
      const updated = await adminReferenceApi.update(item.id, { is_published: value })
      item.is_published = updated.is_published
      item.published_at = updated.published_at
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } } }
      error.value = axiosError?.response?.data?.message || 'Не удалось обновить'
    }
  }

  async function uploadFile(item: ReferencePage, file: File) {
    uploading.value = true
    error.value = null
    try {
      const updated = await adminReferenceApi.uploadAttachment(item.id, file)
      const index = items.value.findIndex((entry) => entry.id === item.id)
      if (index >= 0) {
        items.value[index] = { ...items.value[index], ...updated }
      }
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } } }
      error.value = axiosError?.response?.data?.message || 'Не удалось загрузить файл'
    } finally {
      uploading.value = false
    }
  }

  async function removeFile(item: ReferencePage, fileIndex: number) {
    try {
      const updated = await adminReferenceApi.removeAttachment(item.id, fileIndex)
      const index = items.value.findIndex((entry) => entry.id === item.id)
      if (index >= 0) {
        items.value[index] = { ...items.value[index], ...updated }
      }
    } catch (requestError: unknown) {
      const axiosError = requestError as { response?: { data?: { message?: string } } }
      error.value = axiosError?.response?.data?.message || 'Не удалось удалить файл'
    }
  }

  return {
    items,
    loading,
    saving,
    uploading,
    error,
    editingId,
    showDialog,
    formSlug,
    errors: form.errors,
    meta: form.meta,
    title,
    titleAttrs,
    body,
    bodyAttrs,
    companyName,
    companyNameAttrs,
    inn,
    innAttrs,
    ogrn,
    ogrnAttrs,
    address,
    addressAttrs,
    email,
    emailAttrs,
    phone,
    phoneAttrs,
    version,
    versionAttrs,
    effectiveDate,
    effectiveDateAttrs,
    isPublished,
    isPublishedAttrs,
    slugLabel,
    load,
    openCreate,
    openEdit,
    save,
    togglePublish,
    uploadFile,
    removeFile,
  }
}
