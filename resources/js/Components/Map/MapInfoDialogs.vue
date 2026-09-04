<script setup lang="ts">
import Dialog from 'primevue/dialog'

defineProps<{ liveOpen: boolean; myOpen: boolean; myPins: any[]; formatTime: (s: string) => string }>()
const emit = defineEmits<{ (e: 'update:live', v: boolean): void; (e: 'update:my', v: boolean): void; (e: 'fly', p: any): void }>()
</script>
<template>
  <Dialog :visible="liveOpen" @update:visible="(v:boolean)=>emit('update:live', v)" modal header="Что это?" :style="{ width: '420px', maxWidth: '92vw' }">
    <div class="space-y-3 text-sm leading-relaxed">
      <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4"><span class="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span><span class="font-semibold">Зелёный датчик — живой статус карты</span></div>
      <p class="text-stone-600">Мигает, когда карта на связи. Каждые 30 секунд подтягивает новые пины рядом.</p>
    </div>
  </Dialog>
  <Dialog :visible="myOpen" @update:visible="(v:boolean)=>emit('update:my', v)" modal header="Мои пины" :style="{ width: '520px', maxWidth: '96vw' }">
    <div v-if="myPins.length" class="grid gap-2 max-h-[60vh] overflow-auto pr-1">
      <button v-for="p in myPins" :key="p.id" @click="emit('fly', p)" class="text-left bg-white border rounded-2xl p-4 hover:border-stone-900 transition">
        <div class="text-sm font-bold truncate">{{ p.title }}</div>
        <div class="text-xs text-stone-500 line-clamp-2 mt-1">{{ p.body }}</div>
        <div class="flex items-center gap-1.5 mt-2 text-[11px]"><span class="bg-stone-900 text-white rounded-full px-2 py-0.5">{{ p.category }}</span><span class="bg-stone-100 rounded-full px-2 py-0.5">до {{ formatTime(p.expires_at) }}</span><span class="ml-auto font-semibold">На карте →</span></div>
      </button>
    </div>
    <div v-else class="text-center py-10"><div class="text-sm font-semibold mt-3">Пока нет пинов</div><div class="text-xs text-stone-500">Создай первый — он появится здесь</div></div>
  </Dialog>
</template>
