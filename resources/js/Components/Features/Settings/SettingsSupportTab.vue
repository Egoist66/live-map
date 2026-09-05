<script setup lang="ts">
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useDonate } from '@/composables/useDonate'
import NbrbCalculator from '@/Components/Features/Settings/NbrbCalculator.vue'

defineProps<{ subject: string; body: string; donateSel: number; rate: number | null; rateLoading: boolean }>()
const emit = defineEmits<{ (e: 'update:subject', v: string): void; (e: 'update:body', v: string): void; (e: 'update:donate', v: number): void; (e: 'send'): void; (e: 'donate'): void; (e: 'reload'): void }>()
const { options, formatByn } = useDonate()
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
    <Card class="!bg-white dark:!bg-zinc-900 !border-stone-200 dark:!border-zinc-800 !rounded-3xl !shadow-soft" :pt="{ body: { class: '!p-4 sm:!p-6' }, content: { class: '!p-0' } }">
      <template #content>
        <div class="flex items-center gap-3">
          <span class="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-500/10 grid place-items-center shrink-0">
            <i class="pi pi-heart text-sm text-rose-500"></i>
          </span>
          <div class="min-w-0">
            <h3 class="font-bold tracking-tight dark:text-white">Поддержать проект</h3>
            <p class="text-xs text-stone-500 truncate">Сумма в долларах, рядом — эквивалент в BYN по курсу НБРБ.</p>
          </div>
        </div>
        <div class="mt-4 flex p-1 gap-1 rounded-2xl bg-stone-100 dark:bg-zinc-800" role="group" aria-label="Сумма доната">
          <button
            v-for="usd in options"
            :key="usd"
            type="button"
            :aria-pressed="donateSel === usd"
            @click="emit('update:donate', usd)"
            :class="['flex-1 min-w-0 rounded-xl px-2 py-2 transition text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60', donateSel === usd ? 'bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-stone-200 dark:ring-zinc-700 text-stone-900 dark:text-white' : 'text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200']"
          >
            <span class="block text-sm font-bold leading-tight">${{ usd }}</span>
            <span class="block text-[11px] font-medium leading-tight opacity-70 truncate">{{ formatByn(usd, rate) }}</span>
          </button>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button @click="emit('donate')" icon="pi pi-heart" :label="`Поддержать · $${donateSel}`" rounded class="!bg-ink-900 !border-ink-900 dark:!bg-white dark:!border-white dark:!text-ink-900 !font-semibold !px-5" />
          <span class="text-xs text-stone-500">≈ {{ formatByn(donateSel, rate) }}</span>
          <span class="ml-auto text-xs text-stone-400">Курс: {{ rate ? rate.toFixed(4) : rateLoading ? '…' : '—' }}<button type="button" @click="emit('reload')" class="ml-1 underline underline-offset-2 hover:text-stone-600 dark:hover:text-zinc-300">обновить</button></span>
        </div>
        <NbrbCalculator :model-amount="donateSel" @use-amount="(v:number)=>emit('update:donate', v)" />
      </template>
    </Card>
  </div>
</template>
