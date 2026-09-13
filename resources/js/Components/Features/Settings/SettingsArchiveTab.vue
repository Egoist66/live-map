<script setup lang="ts">
import { onMounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { useSettingsArchive, type ArchiveItem } from '@/composables/useSettingsArchive'
import { useFileDownload } from '@/composables/useFileDownload'
import { useAppConfirm } from '@/composables/useAppConfirm'

const archive = useSettingsArchive()
const files = useFileDownload()
const { confirmDelete } = useAppConfirm()

onMounted(() => {
  void archive.fetchAll()
})

/**
 * Скачивает файл сразу на диск, без открытия во вкладке.
 * @param item строка архива
 */
async function onDownload(item: ArchiveItem): Promise<void> {
  const url = item.download_url || item.attachment?.url
  if (!url) {
    return
  }
  await files.download(url, item.attachment?.name || 'файл')
}

/**
 * Проверяет, качается ли файл прямо сейчас (спиннер на кнопке).
 * @param item строка архива
 */
function isDownloading(item: ArchiveItem): boolean {
  const url = item.download_url || item.attachment?.url
  return !!url && files.downloadingUrl.value === url
}

/**
 * Удаляет один файл после подтверждения.
 * @param id id сообщения с вложением
 */
async function onDeleteOne(id: number): Promise<void> {
  const ok = await confirmDelete('Файл будет удалён из базы и с диска без восстановления.', 'Удалить файл?')
  if (!ok) {
    return
  }
  await archive.removeOne(id)
}

/**
 * Очищает весь архив после подтверждения.
 */
async function onClearAll(): Promise<void> {
  const ok = await confirmDelete('Все ваши документы из чатов будут удалены без восстановления.', 'Очистить архив?')
  if (!ok) {
    return
  }
  await archive.clearAll()
}
</script>
<template>
  <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }">
    <template #content>
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 class="font-black tracking-tight text-lg dark:text-white">Архив документов</h3>
          <p class="text-sm text-stone-500 mt-1">Ваши файлы из разных чатов: фото и документы.</p>
        </div>
        <Button v-if="archive.items.value.length" label="Удалить все" icon="pi pi-trash" severity="danger" outlined rounded size="small" :loading="archive.clearing.value" @click="onClearAll" />
      </div>
      <Message severity="warn" :closable="false" class="!rounded-2xl !text-xs mt-4">Файлы хранятся 15 дней, затем удаляются автоматически.</Message>
      <div v-if="archive.loading.value" class="mt-5 flex items-center gap-2 text-sm text-stone-500"><span class="w-4 h-4 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin"></span> Загружаем…</div>
      <div v-else-if="archive.error.value" class="mt-5"><Message severity="error" :closable="false" class="!rounded-2xl !text-xs">{{ archive.error.value }}</Message></div>
      <div v-else-if="archive.items.value.length" class="mt-5 grid sm:grid-cols-2 gap-3">
        <Card v-for="item in archive.items.value" :key="item.id" class="!border-stone-200 !rounded-3xl !shadow-none !bg-white dark:!bg-zinc-800 relative" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }">
          <template #content>
            <Button @click="onDeleteOne(item.id)" :loading="archive.deletingId.value === item.id" rounded text severity="secondary" class="!absolute !top-3 !right-3 !w-7 !h-7 !p-0" icon="pi pi-times" aria-label="Удалить" />
            <div class="flex items-center gap-3">
              <img v-if="item.attachment?.kind === 'image' && item.attachment?.url" :src="item.attachment.url" alt="" loading="lazy" class="w-12 h-12 rounded-2xl object-cover shrink-0" />
              <span v-else class="w-12 h-12 rounded-2xl bg-violet-600/10 grid place-items-center shrink-0"><i class="pi pi-file text-xl text-violet-600 dark:text-violet-300"></i></span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-bold pr-8 truncate dark:text-white">{{ item.attachment?.name || 'Файл' }}</div>
                <div class="text-xs text-stone-500 mt-0.5">{{ archive.formatSize(item.attachment?.size) }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 mt-3 text-[11px] flex-wrap">
              <Tag v-if="item.chat_with" :value="item.chat_with.name" icon="pi pi-user" class="!bg-stone-100 !text-stone-600 !rounded-full !text-[11px] !border-0" />
              <Tag :value="archive.expiresIn(item.expires_at)" icon="pi pi-clock" class="!bg-amber-100 !text-amber-800 !rounded-full !text-[11px] !border-0" />
            </div>
            <div class="mt-3 flex gap-2">
              <Button label="Скачать" icon="pi pi-download" outlined rounded size="small" class="w-full" :loading="isDownloading(item)" @click="onDownload(item)" />
            </div>
          </template>
        </Card>
      </div>
      <Card v-else class="!border-dashed !border-stone-200 !rounded-3xl !shadow-none mt-6 text-center !bg-white dark:!bg-zinc-900" :pt="{ body: { class: '!py-8' }, content: { class: '!p-0' } }">
        <template #content>
          <div class="w-10 h-10 rounded-xl bg-stone-100 dark:bg-zinc-800 border dark:border-zinc-700 mx-auto grid place-items-center"><i class="pi pi-folder text-stone-400"></i></div>
          <div class="text-sm font-medium mt-2 dark:text-white">Архив пуст</div>
          <div class="text-xs text-stone-400">Отправленные файлы из чатов появятся здесь</div>
        </template>
      </Card>
    </template>
  </Card>
</template>
