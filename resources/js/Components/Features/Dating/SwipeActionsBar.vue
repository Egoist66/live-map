<script setup lang="ts">
/**
 * Нижняя панель действий свайпов в стиле Tinder: четыре ровные круглые
 * кнопки строго по центру под колодой.
 *
 * Пропустить (красный крест), суперлайк (синее сердце + остаток),
 * лайк (большое градиентное сердце по центру), написать (фиолетовый
 * самолётик). Откат и «кто лайкнул» живут в боковом меню.
 * Сырые кнопки вместо PrimeVue Button: фиксированная коробка
 * `grid place-items-center` держит иконку строго по центру, бейдж
 * и спиннер — абсолютные и на центровку не влияют.
 */
withDefaults(
  defineProps<{
    /** Идёт действие — все кнопки disabled, крутится только своя */
    acting?: boolean
    /** Какая кнопка крутит лоадер: у каждой своё состояние */
    busy?: '' | 'pass' | 'like' | 'superlike'
    /** Создаётся чат без мэтча */
    writing?: boolean
    /** Остаток суперлайков текстом */
    superLeft?: string
  }>(),
  { acting: false, busy: '', writing: false, superLeft: '' },
)

defineEmits<{
  (e: 'pass'): void
  (e: 'like'): void
  (e: 'superlike'): void
  (e: 'write'): void
}>()

const sideBtn =
  'w-14 h-14 grid place-items-center rounded-full bg-white dark:bg-zinc-800 shadow-[0_2px_10px_rgba(0,0,0,0.18)] dark:shadow-black/60 transition active:scale-90 disabled:opacity-40 shrink-0'
</script>

<template>
  <div class="mt-2 flex shrink-0 items-center justify-center gap-3 px-4 pt-1 pb-[max(12px,var(--sab))]">
    <button
      type="button"
      :disabled="acting"
      aria-label="Пропустить"
      title="Пропустить"
      :class="sideBtn"
      @click="$emit('pass')"
    >
      <i v-if="busy !== 'pass'" class="pi pi-times text-xl leading-none text-[#FF4458]" />
      <i v-else class="pi pi-spin pi-spinner text-lg leading-none text-[#FF4458]" />
    </button>

    <button
      type="button"
      :disabled="acting"
      aria-label="Суперлайк"
      :title="`Суперлайк · осталось: ${superLeft}`"
      :class="sideBtn"
      class="relative"
      @click="$emit('superlike')"
    >
      <i v-if="busy !== 'superlike'" class="pi pi-heart-fill text-xl leading-none text-[#1786FF]" />
      <i v-else class="pi pi-spin pi-spinner text-lg leading-none text-[#1786FF]" />
      <span
        v-if="superLeft"
        class="absolute -top-1 -right-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-[#1786FF] px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-zinc-900"
      >{{ superLeft }}</span>
    </button>

    <button
      type="button"
      :disabled="acting"
      aria-label="Лайк"
      title="Лайк"
      class="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white shadow-lg shadow-rose-500/40 transition active:scale-90 disabled:opacity-40"
      @click="$emit('like')"
    >
      <i v-if="busy !== 'like'" class="pi pi-heart-fill heartbeat text-3xl leading-none" />
      <i v-else class="pi pi-spin pi-spinner text-2xl leading-none" />
    </button>

    <button
      type="button"
      :disabled="writing"
      aria-label="Написать"
      title="Написать без мэтча"
      :class="sideBtn"
      @click="$emit('write')"
    >
      <i v-if="!writing" class="pi pi-send text-xl leading-none text-[#9B49DF]" />
      <i v-else class="pi pi-spin pi-spinner text-lg leading-none text-[#9B49DF]" />
    </button>
  </div>
</template>

<style scoped>
.heartbeat {
  animation: ulove-beat 1.6s ease-in-out infinite;
  transform-origin: center;
}
@keyframes ulove-beat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.18); }
  30% { transform: scale(1); }
  45% { transform: scale(1.12); }
}
</style>
