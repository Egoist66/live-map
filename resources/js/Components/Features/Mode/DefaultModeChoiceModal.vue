<script setup lang="ts">
import { onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useDefaultMode } from '@/composables/useDefaultMode'

const mode = useDefaultMode()

onMounted(() => {
  window.setTimeout(() => mode.maybeShow(), 800)
})

async function pick(next: 'ulove' | 'upin'): Promise<void> {
  try {
    await mode.choose(next)
    mode.goLanding()
  } catch {
  }
}
</script>

<template>
  <Dialog
    v-model:visible="mode.visible.value"
    modal
    :draggable="false"
    :closable="false"
    :show-header="false"
    :position="mode.dialogPosition.value"
    :style="mode.isNarrow.value ? { width: '100vw', maxWidth: '100vw', margin: '0' } : { width: '560px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!border-0 overflow-hidden !bg-white dark:!bg-zinc-900 shadow-2xl !rounded-t-[28px] sm:!rounded-[28px] !mt-0 sm:!mt-0' },
      content: { class: '!p-0 !bg-white dark:!bg-zinc-900' },
    }"
  >
    <div class="max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
      <div class="sm:hidden pt-2.5 pb-1 grid place-items-center shrink-0">
        <span class="block w-10 h-1 rounded-full bg-white/40"></span>
      </div>

      <div class="relative overflow-hidden bg-gradient-to-br from-rose-500 via-fuchsia-500 to-indigo-600 px-5 sm:px-7 pt-4 sm:pt-6 pb-12 sm:pb-14 text-white">
        <div class="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 pointer-events-none"></div>
        <div class="absolute top-8 right-24 w-14 h-14 rounded-full bg-white/10 pointer-events-none hidden sm:block"></div>
        <div class="text-[10px] sm:text-[11px] font-black tracking-[0.16em] uppercase bg-white/20 rounded-full px-3 py-1 w-fit">Выбери свою сторону</div>
        <div class="text-xl sm:text-2xl font-black tracking-tight leading-tight mt-2 sm:mt-3">Как открывать приложение?</div>
        <p class="text-[13px] sm:text-sm text-white/80 mt-1 leading-relaxed">Это только стартовый экран. Обе стороны всегда открыты — переключиться можно в любой момент.</p>
      </div>

      <div class="px-4 sm:px-6 pb-4 sm:pb-5 -mt-7 sm:-mt-8 relative grid sm:grid-cols-2 gap-2.5 sm:gap-3">
        <button
          type="button"
          :disabled="mode.saving.value"
          class="text-left rounded-3xl border-2 border-rose-200 dark:border-rose-900 bg-white dark:bg-zinc-900 p-4 shadow-lg hover:border-rose-400 sm:hover:-translate-y-0.5 transition active:scale-[0.99] disabled:opacity-60"
          @click="pick('ulove')"
        >
          <div class="flex sm:block items-center gap-3">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 grid place-items-center text-lg sm:text-xl shrink-0">💘</div>
            <div class="font-black text-[15px] sm:text-[16px] sm:mt-3 dark:text-white">ULove</div>
          </div>
          <div class="text-[12px] sm:text-[13px] text-stone-500 dark:text-zinc-400 leading-snug mt-1.5 sm:mt-1">Знакомства рядом: свайпы, мэтч открывает чат</div>
          <div class="mt-2 sm:mt-3 text-[12px] sm:text-[13px] font-bold text-rose-600 dark:text-rose-400">Начать с ULove →</div>
        </button>

        <button
          type="button"
          :disabled="mode.saving.value"
        class="text-left rounded-3xl border-2 border-sky-200 dark:border-sky-900 bg-white dark:bg-zinc-900 p-4 shadow-lg hover:border-sky-400 sm:hover:-translate-y-0.5 transition active:scale-[0.99] disabled:opacity-60"
        @click="pick('upin')"
      >
        <div class="flex sm:block items-center gap-3">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-lg sm:text-xl shrink-0">📍</div>
          <div class="font-black text-[15px] sm:text-[16px] sm:mt-3 dark:text-white">UPin</div>
        </div>
        <div class="text-[12px] sm:text-[13px] text-stone-500 dark:text-zinc-400 leading-snug mt-1.5 sm:mt-1">Соседи и карта: пины, события и помощь рядом</div>
        <div class="mt-2 sm:mt-3 text-[12px] sm:text-[13px] font-bold text-sky-600 dark:text-sky-400">Начать с карты →</div>
        </button>
      </div>

      <div class="px-4 sm:px-6 pb-[calc(1.25rem+var(--sab))] sm:pb-5">
        <p v-if="mode.error.value" class="text-[13px] text-red-500 text-center mb-2">{{ mode.error.value }}</p>
        <p class="text-[11px] text-center text-stone-400 dark:text-zinc-500 leading-relaxed">
          {{ mode.saving.value ? 'Сохраняем выбор…' : 'Ничего не скрываем: свайпы, карта, чат и лента остаются доступны.' }}
        </p>
        <div class="mt-2 sm:mt-3 flex justify-center">
          <Button label="Решу позже" text rounded size="small" :disabled="mode.saving.value" @click="mode.hide()" />
        </div>
      </div>
    </div>
  </Dialog>
</template>
