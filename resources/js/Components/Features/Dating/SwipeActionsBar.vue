<script setup lang="ts">
/**
 * Флоат-панель действий свайпов в стиле Tinder: пас, суперлайк,
 * лайк и написать висят поверх низа карточки — абсолютный оверлей строго
 * по центру, карточка под ними выше. Обёртка клики пропускает
 * (pointer-events-none), сами кнопки кликабельны.
 *
 * Пропустить (красный крест), суперлайк (синее сердце + остаток),
 * лайк (большое градиентное сердце по центру), написать (фиолетовый
 * самолётик). Откат и «кто лайкнул» живут в боковом меню.
 * Сырые кнопки вместо PrimeVue Button: фиксированная коробка
 * `grid place-items-center` держит иконку строго по центру, бейдж
 * и спиннер — абсолютные и на центровку не влияют.
 * `compact` — тесный TG-режим: панель выше и меньше, карточке больше места.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Идёт действие — все кнопки disabled, крутится только своя */
    acting?: boolean
    /** Какая кнопка крутит лоадер: у каждой своё состояние */
    busy?: '' | 'pass' | 'like' | 'superlike'
    /** Создаётся чат без мэтча */
    writing?: boolean
    /** Остаток суперлайков текстом */
    superLeft?: string
    /** Компактный TG-режим: панель выше, кнопки меньше */
    compact?: boolean
  }>(),
  { acting: false, busy: '', writing: false, superLeft: '', compact: false },
)

defineEmits<{
  (e: 'pass'): void
  (e: 'like'): void
  (e: 'superlike'): void
  (e: 'write'): void
}>()

const sideBtn =
  'swipe-side-btn pointer-events-auto grid place-items-center rounded-full bg-white dark:bg-zinc-800 shadow-[0_2px_10px_rgba(0,0,0,0.18)] dark:shadow-black/60 transition active:scale-90 disabled:opacity-40 shrink-0 touch-manipulation'

const superBtn =
  'swipe-super-btn pointer-events-auto grid place-items-center rounded-full text-white shadow-[0_4px_18px_rgba(23,134,255,0.5)] dark:shadow-[0_4px_18px_rgba(23,134,255,0.45)] transition active:scale-90 disabled:opacity-40 shrink-0 bg-gradient-to-br from-[#1786FF] via-[#1f9dff] to-[#00C6FF] ring-2 ring-[#1786FF]/30 dark:ring-[#7cc4ff]/30 touch-manipulation'

const likeBtn =
  'swipe-like-btn pointer-events-auto grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FD267D] to-[#FF7854] text-white shadow-lg shadow-rose-500/40 transition active:scale-90 disabled:opacity-40 touch-manipulation'

/** Размер боковых кнопок: обычные 56px, в TG — 52px. */
const sideSize = computed(() => (props.compact ? 'w-[52px] h-[52px]' : 'w-14 h-14'))
/** Размер центрального лайка: обычный 72px, в TG — 64px. */
const likeSize = computed(() => (props.compact ? 'w-16 h-16' : 'w-[72px] h-[72px]'))
/** Позиция панели: в TG выше (20px) и теснее, иначе 12px. */
const barPos = computed(() => (props.compact ? 'bottom-5 gap-2.5 px-3' : 'bottom-3 gap-3 px-4'))
</script>

<template>
  <div class="swipe-actions pointer-events-none absolute inset-x-0 z-20 flex items-center justify-center select-none sm:bottom-4" :class="barPos">
    <button
      type="button"
      :disabled="acting"
      aria-label="Пропустить"
      title="Пропустить"
      :class="[sideBtn, sideSize]"
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
      :class="[superBtn, sideSize]"
      class="superlike-btn relative overflow-visible"
      @click="$emit('superlike')"
    >
      <span class="superlike-pulse" aria-hidden="true" />
      <i v-if="busy !== 'superlike'" class="pi pi-star-fill relative text-xl leading-none text-white drop-shadow-[0_1px_4px_rgba(0,40,90,0.5)]" />
      <i v-else class="pi pi-spin pi-spinner relative text-lg leading-none text-white" />
      <span
        v-if="superLeft"
        class="absolute -top-1.5 -right-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-white px-1 text-[10px] font-black text-[#1786FF] ring-2 ring-[#1786FF] dark:ring-[#7cc4ff] shadow"
      >{{ superLeft }}</span>
    </button>

    <button
      type="button"
      :disabled="acting"
      aria-label="Лайк"
      title="Лайк"
      :class="[likeBtn, likeSize]"
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
      :class="[sideBtn, sideSize]"
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
/* Суперлайк — главный акцент панели: синий градиент + дышащее кольцо.
   Пульс чисто декоративный, клики и центровка не страдают. */
.superlike-btn {
  position: relative;
  isolation: isolate;
}
.superlike-pulse {
  position: absolute;
  inset: -3px;
  border-radius: 9999px;
  border: 2px solid rgba(23, 134, 255, 0.55);
  animation: superlike-pulse 2.2s ease-out infinite;
  pointer-events: none;
}
.superlike-btn:active .superlike-pulse {
  animation: none;
  opacity: 0;
}
@keyframes superlike-pulse {
  0% { transform: scale(0.92); opacity: 0.9; }
  70% { transform: scale(1.12); opacity: 0; }
  100% { transform: scale(1.12); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .superlike-pulse { animation: none; opacity: 0; }
  .heartbeat { animation: none; }
}

</style>
