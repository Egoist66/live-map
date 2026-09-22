<script setup lang="ts">
import { onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useAccountTypeChoice } from '@/composables/useAccountTypeChoice'

const props = withDefaults(defineProps<{ mode?: 'guest' | 'auth' }>(), { mode: 'guest' })

const gate = useAccountTypeChoice()

onMounted(() => {
  window.setTimeout(() => {
    if (props.mode === 'guest') {
      gate.maybeShowGuest()
    } else {
      gate.maybeShowAuth()
    }
  }, 600)
})

async function pick(next: 'person' | 'business'): Promise<void> {
  if (props.mode === 'guest') {
    gate.chooseGuest(next)
    return
  }
  await gate.chooseAuth(next)
}
</script>

<template>
  <Dialog
    v-model:visible="gate.visible.value"
    modal
    :draggable="false"
    :closable="false"
    :show-header="false"
    position="center"
    :style="{ width: '620px', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!border-0 overflow-hidden !bg-white dark:!bg-zinc-900 shadow-2xl !rounded-[28px]' },
      content: { class: '!p-0 !bg-white dark:!bg-zinc-900' },
      mask: { class: '!backdrop-blur-md !bg-black/45' },
    }"
  >
    <div class="max-h-[92dvh] overflow-y-auto overscroll-contain">
      <div class="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 sm:px-7 pt-5 sm:pt-6 pb-12 text-white">
        <div class="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-white/10 pointer-events-none"></div>
        <div class="text-[11px] font-black tracking-[0.16em] uppercase bg-white/20 rounded-full px-3 py-1 w-fit">Кто вы?</div>
        <div class="text-xl sm:text-2xl font-black tracking-tight mt-2">Заходите как персона или компания?</div>
        <p class="text-[13px] text-white/80 mt-1 leading-relaxed">Персонам — свайпы, карта и чат. Компаниям — свой кабинет, карта для заработка и проверка по УНП.</p>
      </div>

      <div class="px-4 sm:px-6 pb-4 -mt-7 relative grid sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          :disabled="gate.saving.value"
          class="text-left rounded-3xl border-2 border-rose-200 dark:border-rose-900 bg-white dark:bg-zinc-900 p-4 shadow-lg hover:border-rose-400 transition active:scale-[0.99] disabled:opacity-60"
          @click="pick('person')"
        >
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 grid place-items-center text-xl">💘</div>
          <div class="font-black text-[16px] mt-3 dark:text-white">Я — персона</div>
          <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1 leading-snug">Знакомства рядом, пины района, чат и свайпы</div>
          <div class="mt-2 text-[13px] font-bold text-rose-600 dark:text-rose-400">Продолжить →</div>
        </button>

        <button
          type="button"
          :disabled="gate.saving.value"
          class="text-left rounded-3xl border-2 border-indigo-200 dark:border-indigo-900 bg-white dark:bg-zinc-900 p-4 shadow-lg hover:border-indigo-400 transition active:scale-[0.99] disabled:opacity-60"
          @click="pick('business')"
        >
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-xl">🏢</div>
          <div class="font-black text-[16px] mt-3 dark:text-white">Я — компания</div>
          <div class="text-[13px] text-stone-500 dark:text-zinc-400 mt-1 leading-snug">Кабинет, карта для клиентов, проверка по УНП РБ</div>
          <div class="mt-2 text-[13px] font-bold text-indigo-600 dark:text-indigo-400">Открыть кабинет →</div>
        </button>
      </div>

      <div class="px-4 sm:px-6 pb-5">
        <p v-if="gate.error.value" class="text-[13px] text-red-500 text-center mb-2">{{ gate.error.value }}</p>
        <p class="text-[11px] text-center text-stone-400 dark:text-zinc-500">{{ gate.saving.value ? 'Сохраняем выбор…' : 'Выбор можно сменить позже в настройках.' }}</p>
        <div v-if="props.mode === 'auth'" class="mt-2 flex justify-center">
          <Button label="Решу позже" text rounded size="small" :disabled="gate.saving.value" @click="gate.hide()" />
        </div>
      </div>
    </div>
  </Dialog>
</template>
