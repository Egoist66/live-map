<script setup lang="ts">
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useChatPresets } from '@/composables/useChatPresets'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'select', text: string): void
  (e: 'send', text: string): void
}>()

const presets = useChatPresets()

function close(): void {
  presets.reset()
  emit('update:open', false)
}

function choose(text: string): void {
  emit('select', text)
  close()
}

function sendNow(text: string): void {
  emit('send', text)
  close()
}
</script>

<template>
  <Dialog
    :visible="props.open"
    @update:visible="(v: boolean) => emit('update:open', v)"
    modal
    dismissable-mask
    header="Пресеты сообщений"
    class="w-[min(560px,94vw)]"
    :pt="{ root: { class: '!rounded-3xl' } }"
    @hide="presets.reset()"
  >
    <div class="flex flex-col gap-3 min-w-0">
      <span class="relative block">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none"></i>
        <InputText
          :model-value="presets.query.value"
          @update:model-value="(v: string | undefined) => presets.setQuery(v ?? '')"
          placeholder="Найти фразу… например «кофе»"
          fluid
          class="w-full !rounded-2xl !pl-9"
        />
      </span>

      <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        <button
          @click="presets.setCategory('all')"
          :class="presets.activeCategoryId.value === 'all' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'"
          class="shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold active:scale-95 transition"
        >
          Все · {{ presets.totalCount.value }}
        </button>
        <button
          v-for="category in presets.categories.value"
          :key="category.id"
          @click="presets.setCategory(category.id)"
          :class="presets.activeCategoryId.value === category.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'"
          class="shrink-0 px-3 py-1.5 rounded-full border text-xs font-bold active:scale-95 transition"
        >
          {{ category.label }}
        </button>
      </div>

      <div class="max-h-[50dvh] overflow-auto flex flex-col gap-3 pr-0.5">
        <div v-if="!presets.filtered.value.length" class="text-center text-sm text-stone-400 py-8">
          <div class="text-3xl mb-2">🔍</div>
          Ничего не нашлось — попробуй другой запрос
        </div>
        <div v-for="category in presets.filtered.value" :key="category.id" class="min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-zinc-500 mb-1.5">
            <i :class="category.icon + ' text-[11px]'"></i>
            {{ category.label }}
          </div>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="(item, idx) in category.items"
              :key="category.id + '-' + idx"
              class="flex items-center gap-1.5 bg-stone-50 dark:bg-zinc-800/70 border border-stone-100 dark:border-zinc-700/60 rounded-2xl pl-3 pr-1.5 py-1.5 min-w-0"
            >
              <button @click="choose(item)" class="flex-1 min-w-0 text-left text-[13px] leading-snug dark:text-zinc-100 hover:text-violet-700 dark:hover:text-violet-300 transition" :title="item">
                <span class="block truncate">{{ item }}</span>
              </button>
              <Button
                icon="pi pi-send"
                rounded
                text
                severity="secondary"
                @click="sendNow(item)"
                aria-label="Отправить сразу"
                title="Отправить сразу"
                class="!w-8 !h-8 !p-0 shrink-0 grid place-items-center [&_.p-button-icon]:!m-0 [&_.p-button-label]:hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <p class="text-[11px] text-stone-400 dark:text-zinc-500 leading-snug">
        Нажми на фразу — она подставится в поле ввода, отправку подтвердишь сам(а). Кнопка <i class="pi pi-send text-[10px]"></i> — отправить сразу.
      </p>
    </div>
  </Dialog>
</template>
