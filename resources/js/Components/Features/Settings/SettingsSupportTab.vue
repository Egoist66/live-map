<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'

defineProps<{ subject: string; body: string; donateSel: number; rate: number | null; rateLoading: boolean }>()
const emit = defineEmits<{ (e: 'update:subject', v: string): void; (e: 'update:body', v: string): void; (e: 'update:donate', v: number): void; (e: 'send'): void; (e: 'donate'): void; (e: 'reload'): void }>()
function fmt(usd: number, rate: number | null) { return rate ? (usd * rate).toFixed(2) + ' BYN' : '—' }
</script>
<template>
  <div class="space-y-4">
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight text-lg dark:text-white">Обратиться в поддержку</h3>
        <p class="text-sm text-stone-500 mt-1">Опиши проблему — ответим в течение часа.</p>
        <div class="mt-5 max-w-xl space-y-3">
          <div><label class="text-sm font-medium">Тема</label><InputText :model-value="subject" @update:model-value="(v:any)=>emit('update:subject', v)" placeholder="Напр. Не грузится карта в Минске" class="w-full mt-1 !rounded-2xl" /></div>
          <div><label class="text-sm font-medium">Сообщение</label><Textarea :model-value="body" @update:model-value="(v:any)=>emit('update:body', v)" rows="6" placeholder="Опиши проблему подробно..." class="w-full mt-1 !rounded-3xl" autoResize /></div>
          <Button @click="emit('send')" label="✉️ Отправить обращение" rounded class="w-full !bg-stone-900 !border-stone-900 !text-white" />
        </div>
      </template>
    </Card>
    <Card class="!bg-gradient-to-br !from-amber-50 !to-orange-50 !border-amber-200 !rounded-3xl" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <h3 class="font-black tracking-tight">Задонатить разработчику ❤️</h3>
        <p class="text-sm text-stone-600 mt-1">Поддержи UPin — выбери сумму в долларах, покажем по курсу НБРБ (BYN).</p>
        <div class="mt-4 flex items-center gap-2 text-xs"><Tag :value="`Курс: ${rate ? rate.toFixed(4) + ' BYN / $' : rateLoading ? 'загрузка…' : '—'}`" class="!bg-white !border !text-stone-600 !rounded-full" /><Button @click="emit('reload')" label="обновить" link size="small" /></div>
        <div class="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
          <Card v-for="usd in [2, 5, 10]" :key="usd" @click="emit('update:donate', usd)" :class="['!rounded-3xl !cursor-pointer !text-center !transition', donateSel === usd ? '!bg-stone-900 !text-white !border-stone-900' : '!bg-white !border-stone-200']" :pt="{ body: { class: '!p-4' }, content: { class: '!p-0' } }"><template #content><div class="text-lg font-black">${{ usd }}</div><div class="text-xs opacity-70">{{ fmt(usd, rate) }}</div></template></Card>
        </div>
        <Button @click="emit('donate')" :label="`💛 Задонатить $${donateSel} → ${fmt(donateSel, rate)}`" rounded class="mt-4 w-full !bg-gradient-to-br !from-amber-400 !to-orange-500 !border-0 !text-stone-900 !font-black" />
      </template>
    </Card>
  </div>
</template>
