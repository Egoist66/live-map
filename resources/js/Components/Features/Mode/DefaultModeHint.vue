<script setup lang="ts">
import { computed } from 'vue'
import { Link } from '@inertiajs/vue3'
import Button from 'primevue/button'
import { useDefaultMode } from '@/composables/useDefaultMode'
import { useDefaultModeHint } from '@/composables/useDefaultModeHint'

const props = defineProps<{ place: 'map' | 'swipes' }>()

const mode = useDefaultMode()
const hint = useDefaultModeHint()

const showUloveHint = computed(() => {
  return props.place === 'map' && mode.isUpinDefault.value && !hint.dismissed.value
})

const showUpinHint = computed(() => {
  return props.place === 'swipes' && !mode.isUpinDefault.value && !hint.dismissed.value
})

const visible = computed(() => showUloveHint.value || showUpinHint.value)
</script>

<template>
  <div v-if="visible" class="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-white/20 bg-ink-900/90 dark:bg-zinc-900/95 backdrop-blur px-3.5 py-3 shadow text-white w-fit max-w-[min(92vw,380px)]">
    <span class="w-8 h-8 rounded-full grid place-items-center text-sm shrink-0" :class="showUloveHint ? 'bg-gradient-to-br from-rose-500 to-orange-400' : 'bg-gradient-to-br from-sky-500 to-indigo-600'">
      {{ showUloveHint ? '💘' : '📍' }}
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-bold leading-tight">
        {{ showUloveHint ? 'А ещё у нас есть ULove 💘' : 'А ещё у нас есть карта UPin 📍' }}
      </div>
      <div class="text-[11px] text-white/70 leading-snug mt-0.5">
        {{ showUloveHint ? 'Свайпы людей рядом — мэтч открывает чат.' : 'Пины соседей, события и помощь рядом.' }}
      </div>
      <Link :href="showUloveHint ? '/swipes' : '/map'" class="mt-2 inline-flex">
        <Button :label="showUloveHint ? 'Открыть ULove' : 'Открыть карту'" size="small" rounded class="!text-xs !px-4 !py-1.5 !bg-white !text-ink-900 !border-0 hover:!bg-zinc-100" />
      </Link>
    </div>
    <button type="button" class="shrink-0 w-6 h-6 rounded-full hover:bg-white/10 grid place-items-center text-white/60" title="Скрыть подсказку" @click="hint.dismiss()">
      <i class="pi pi-times text-[10px]"></i>
    </button>
  </div>
</template>
