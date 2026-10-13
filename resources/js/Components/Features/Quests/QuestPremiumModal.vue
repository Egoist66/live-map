<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

defineProps<{ granted: { track: string; premium_until: string; cooldown_until: string } | null; premiumDays: number }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'billing'): void }>()
</script>
<template>
  <Dialog :visible="!!granted" modal :closable="false" :draggable="false" class="!rounded-3xl" :style="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }" :pt="{ root: { class: '!rounded-3xl max-sm:!rounded-b-none !border-0' }, content: { class: '!p-0' }, header: { class: '!hidden' } }">
    <div v-if="granted" class="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white text-center">
      <div class="w-16 h-16 mx-auto rounded-3xl bg-white/20 grid place-items-center text-3xl">🎉</div>
      <div class="mt-3 text-xl font-black">PRO на неделю — твой!</div>
      <div class="mt-1 text-sm text-white/85">Ты закрыл трек «{{ granted.track === 'pins' ? 'Пины' : 'Свайпы' }}». Наслаждайся PRO {{ premiumDays }} дней.</div>
      <div class="mt-4 rounded-2xl bg-white/15 p-3 text-xs text-white/90">Следующие задания — через месяц. Хочешь PRO снова раньше? Можно просто купить в тарифе.</div>
      <div class="mt-4 flex gap-2 justify-center">
        <Button label="Круто, понял!" rounded size="small" class="!bg-white !text-orange-600 !border-0 !font-bold" @click="emit('close')" />
        <Button label="Купить PRO" rounded outlined size="small" class="!border-white !text-white" @click="emit('billing')" />
      </div>
    </div>
  </Dialog>
</template>
