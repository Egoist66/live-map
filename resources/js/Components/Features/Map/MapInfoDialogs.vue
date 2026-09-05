<script setup lang="ts">
import Dialog from 'primevue/dialog'

defineProps<{ liveOpen: boolean; myOpen: boolean; myPins: any[]; formatTime: (s: string) => string }>()
const emit = defineEmits<{ (e: 'update:live', v: boolean): void; (e: 'update:my', v: boolean): void; (e: 'fly', p: any): void }>()
</script>
<template>
  <Dialog :visible="liveOpen" @update:visible="(v:boolean)=>emit('update:live', v)" modal header="Что это?" :style="{ width: '420px', maxWidth: '92vw', maxHeight: '92dvh' }">
    <div class="space-y-3 text-sm leading-relaxed">
      <div class="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-400/30 rounded-2xl p-4"><span class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.8)]"></span><span class="font-semibold text-emerald-900 dark:text-emerald-200">Зелёный датчик — живой статус карты</span></div>
      <p class="text-stone-600 dark:text-zinc-300">Мигает, когда карта на связи. Каждые 30 секунд подтягивает новые пины рядом.</p>
    </div>
  </Dialog>
  <Dialog :visible="myOpen" @update:visible="(v:boolean)=>emit('update:my', v)" modal header="Мои пины" :style="{ width: '520px', maxWidth: '96vw', maxHeight: '92dvh' }" :pt="{ content: { class: '!max-h-[80dvh] !overflow-y-auto' } }">
    <div v-if="myPins.length" class="grid gap-2 max-h-[70dvh] sm:max-h-[60vh] overflow-auto pr-1">
      <button v-for="p in myPins" :key="p.id" @click="emit('fly', p)" class="text-left bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl p-4 hover:border-stone-900 dark:hover:border-white/30 transition">
        <div class="text-sm font-bold truncate dark:text-zinc-100">{{ p.title }}</div>
        <div class="text-xs text-stone-500 dark:text-zinc-400 line-clamp-2 mt-1">{{ p.body }}</div>
        <div class="flex items-center gap-1.5 mt-2 text-[11px]"><span class="bg-stone-900 dark:bg-white text-white dark:text-ink-900 rounded-full px-2 py-0.5">{{ p.category }}</span><span class="bg-stone-100 dark:bg-zinc-700 dark:text-zinc-200 rounded-full px-2 py-0.5">{{ p.expires_at ? `до ${formatTime(p.expires_at)}` : '∞' }}</span><span class="ml-auto font-semibold dark:text-zinc-200">На карте →</span></div>
      </button>
    </div>
    <div v-else class="text-center py-10"><div class="text-sm font-semibold mt-3 dark:text-zinc-100">Пока нет пинов</div><div class="text-xs text-stone-500 dark:text-zinc-400">Создай первый — он появится здесь</div></div>
  </Dialog>
</template>
