<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useAppUpdateModal } from '@/composables/useAppUpdateModal'

defineProps<{ update: any | null; position: number; total: number }>()
const emit = defineEmits<{ (e: 'read'): void; (e: 'later'): void; (e: 'all'): void }>()

const news = useAppUpdateModal()

async function openModules(): Promise<void> {
  emit('read')
  await news.goModules()
}
</script>
<template>
  <Dialog :visible="!!update" modal :closable="false" header="Что нового" :style="{ width: '480px', maxWidth: '94vw' }" :pt="{ root: { class: '!rounded-[24px] overflow-hidden' } }">
    <div v-if="update" class="space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white grid place-items-center shrink-0"><i class="pi pi-sparkles text-sm" /></span>
        <div class="min-w-0 flex-1">
          <div class="font-black text-[17px] tracking-tight leading-tight dark:text-white">{{ update.title }}</div>
          <div class="text-xs text-stone-500 dark:text-zinc-400 mt-0.5">{{ news.fmtDate(update.published_at) }}<span v-if="update.version && !news.isModulesGuide(update)"> · v{{ update.version }}</span></div>
        </div>
        <Tag v-if="total > 1" :value="`${position + 1} / ${total}`" severity="info" class="!text-[10px]" />
      </div>
      <p class="text-sm text-stone-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap max-h-[45vh] overflow-y-auto rounded-2xl bg-stone-50 dark:bg-zinc-800/60 p-4">{{ update.body }}</p>
      <Button
        v-if="news.isModulesGuide(update)"
        label="Открыть разделы приложения"
        icon="pi pi-th-large"
        size="small"
        rounded
        class="w-full"
        @click="openModules()"
      />
    </div>
    <template #footer>
      <div class="flex gap-2 justify-end flex-wrap">
        <Button label="Позже" text size="small" @click="emit('later')" />
        <Button v-if="total > 1" label="Прочитать все" outlined size="small" rounded @click="emit('all')" />
        <Button label="Понятно" size="small" rounded class="!px-6" autofocus @click="emit('read')" />
      </div>
    </template>
  </Dialog>
</template>
