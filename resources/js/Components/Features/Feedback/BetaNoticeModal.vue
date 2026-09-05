<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { onMounted } from 'vue'
import { useBetaNotice } from '@/composables/useBetaNotice'

const notice = useBetaNotice()
onMounted(() => notice.maybeShow())
</script>
<template>
  <Dialog
    v-model:visible="notice.visible.value"
    modal
    :draggable="false"
    :closable="true"
    position="center"
    :style="{ width: '440px', maxWidth: 'calc(100vw - 2rem)' }"
    @hide="notice.dismiss()"
    :pt="{
      root: { class: '!rounded-[28px] !border-0 overflow-hidden !bg-white dark:!bg-zinc-900 shadow-2xl' },
      header: { class: '!p-0 !border-0 !bg-transparent' },
      content: { class: '!p-0 !bg-transparent' },
    }"
  >
    <template #header>
      <div class="relative w-full overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 px-6 pt-6 pb-14 text-white">
        <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-none"></div>
        <div class="absolute top-6 right-14 w-16 h-16 rounded-full bg-white/10"></div>
        <div class="absolute bottom-2 left-10 w-8 h-8 rounded-full bg-white/10"></div>
        <div class="relative flex items-center gap-3">
          <span class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur grid place-items-center text-2xl shrink-0">🚀</span>
          <div class="min-w-0">
            <div class="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.14em] uppercase bg-white/20 backdrop-blur rounded-full px-2.5 py-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
              Beta · закрытый тест
            </div>
            <div class="text-xl font-black tracking-tight leading-tight mt-1.5">Добро пожаловать в UPin!</div>
          </div>
        </div>
      </div>
    </template>
    <div class="px-6 pb-6 -mt-8 relative">
      <div class="bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 rounded-2xl shadow-lg p-4 space-y-3">
        <p class="text-sm leading-relaxed text-stone-600 dark:text-zinc-300">
          Приложение в активной разработке. Что-то может меняться, глючить или пропадать — это нормально для этого этапа.
        </p>
        <div class="space-y-2">
          <div class="flex items-start gap-2.5 text-[13px] text-stone-600 dark:text-zinc-300">
            <span class="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 grid place-items-center shrink-0 text-xs">🐞</span>
            <span>Нашли баг, всё зависло или что-то непонятно — напишите нам</span>
          </div>
          <div class="flex items-start gap-2.5 text-[13px] text-stone-600 dark:text-zinc-300">
            <span class="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-500/20 grid place-items-center shrink-0 text-xs">✨</span>
            <span>Есть идея для фичи — тоже пишите, лучшие идеи попадут в релиз</span>
          </div>
        </div>
        <div class="w-full flex items-center gap-3 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-500/10 px-3.5 py-3">
          <span class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white grid place-items-center shrink-0"><i class="pi pi-envelope text-sm"></i></span>
          <span class="min-w-0 flex-1 text-[13px] text-stone-600 dark:text-zinc-300">Кнопка ниже сама откроет письмо в поддержку — просто нажмите</span>
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <Button label="Написать в поддержку" icon="pi pi-send" @click="notice.contact()" class="flex-1 !rounded-full !bg-gradient-to-r !from-violet-600 !to-fuchsia-600 !border-0 !py-3" />
        <Button label="Понятно" @click="notice.dismiss()" outlined rounded class="shrink-0 !px-6 !py-3" />
      </div>
      <p class="text-[11px] text-center text-stone-400 dark:text-zinc-500 mt-3">Спасибо, что вы с нами на раннем этапе 💜</p>
    </div>
  </Dialog>
</template>
