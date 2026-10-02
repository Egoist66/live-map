<script setup lang="ts">
import Card from 'primevue/card'
import SelectButton from 'primevue/selectbutton'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useToast } from 'primevue/usetoast'
import { useSavedNotes } from '@/composables/useSavedNotes'
import { onMounted } from 'vue'

const { state, actions } = useSavedNotes()
const toast = (() => {
  try {
    return useToast()
  } catch {
    return null as any
  }
})()

const storageOptions = [
  { label: '☁️ На сервере', value: 'server' },
  { label: '📱 Локально', value: 'local' },
]

onMounted(() => {
  if (state.storageLoading.value && state.notes.value.length === 0) {
    void actions.init()
  }
})

/**
 * Переключить режим хранения с тостом-подтверждением.
 *
 * @param mode server|local
 */
async function onStorage(mode: 'server' | 'local'): Promise<void> {
  const ok = await actions.setStorage(mode)
  if (!ok) {
    toast?.add({ severity: 'error', summary: 'Не сохранено', detail: 'Не получилось переключить хранилище', life: 3500 })
    return
  }
  const detail =
    mode === 'local'
      ? 'Заметки хранятся только на этом устройстве и не синхронизируются.'
      : 'Заметки синхронизируются между устройствами (сжато и зашифровано).'
  toast?.add({ severity: 'success', summary: 'Хранилище избранного', detail, life: 4000 })
}
</script>

<template>
  <Card
    class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft"
    :pt="{ body: { class: '!p-6' }, content: { class: '!p-0' } }"
  >
    <template #content>
      <h3 class="font-black tracking-tight text-lg dark:text-white">⭐ Избранное</h3>
      <p class="text-sm text-stone-500 mt-1">Личные заметки — чат только для себя. В базе хранятся сжатыми и зашифрованными.</p>
      <div class="mt-4 space-y-3 max-w-xl">
        <div class="flex items-center gap-3 flex-wrap">
          <SelectButton
            :model-value="state.storage.value"
            :options="storageOptions"
            option-label="label"
            option-value="value"
            aria-label="Где хранить избранное"
            @update:model-value="(v: 'server' | 'local') => onStorage(v)"
          />
          <ProgressSpinner v-if="state.storageLoading.value" style="width: 24px; height: 24px" :stroke-width="6" />
        </div>
        <Message v-if="state.storage.value === 'local'" severity="warn" :closable="false" class="w-full">
          📱 Локальный режим: заметки живут только на этом устройстве и на разных устройствах не синхронизируются. Потеряете браузер — потеряете заметки.
        </Message>
        <Message v-else severity="success" :closable="false" class="w-full">
          ☁️ Серверный режим: заметки сжаты и зашифрованы, доступны с любого устройства и в Telegram-боте (/notes).
        </Message>
      </div>
    </template>
  </Card>
</template>
