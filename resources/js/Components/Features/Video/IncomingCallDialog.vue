<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

/**
 * Диалог входящего видеозвонка (мэтч, друг или рулетка).
 * Логики нет: показывает стор и дергает useVideoSession.
 */

const v = useVideoSession()

const visible = ref(false)

const dialogPt = {
  root: { class: '!rounded-3xl !border-0 !bg-white dark:!bg-zinc-900 overflow-hidden' },
  header: { class: '!hidden' },
  content: { class: '!p-0 !bg-white dark:!bg-zinc-900' },
}

let audioCtx: AudioContext | null = null
let ringTimer: ReturnType<typeof setInterval> | null = null

const isRoulette = computed(() => v.store.incoming?.mode === 'roulette')
const peerName = computed(() => v.store.incoming?.peer.name ?? 'Собеседник')
const peerAvatar = computed(() => v.store.incoming?.peer.avatar_url ?? null)
/** Рулетка в авто-режиме принимает пару сама — диалог не показываем. */
const autoRoulette = computed(() => v.rouletteAuto.value && isRoulette.value)

watch(
  () => v.store.status,
  (next) => {
    visible.value = next === 'ringing-in' && !autoRoulette.value
    if (visible.value) startRing()
    else stopRing()
  },
  { immediate: true },
)

watch(autoRoulette, (auto) => {
  if (auto) {
    visible.value = false
    stopRing()
  }
})

/**
 * Двухтональный рингтон на WebAudio, пока висит диалог.
 * Контекст будим явно: на нетронутой вкладке Chrome держит его
 * suspended и звонок проходит бесшумно. Плюс вибрация на мобиле.
 */
function startRing(): void {
  stopRing()
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = audioCtx
    try {
      if (ctx.state === 'suspended') void ctx.resume()
    } catch {}
    try {
      if ('vibrate' in navigator) (navigator as any).vibrate([300, 150, 300])
    } catch {}
    let high = false
    ringTimer = setInterval(() => {
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = high ? 660 : 520
        high = !high
        osc.type = 'sine'
        gain.gain.value = 0.06
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35)
        osc.stop(ctx.currentTime + 0.36)
      } catch {}
    }, 450)
  } catch {}
}

/**
 * Остановить рингтон.
 */
function stopRing(): void {
  if (ringTimer) clearInterval(ringTimer)
  ringTimer = null
}

onBeforeUnmount(() => stopRing())
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :closable="false"
    :draggable="false"
    :show-header="false"
    appendTo="body"
    class="w-[calc(100vw-2rem)] max-w-[380px]"
    :pt="dialogPt"
  >
    <div class="p-5 sm:p-6 text-center text-stone-900 dark:text-white">
      <div class="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-zinc-500">
        {{ isRoulette ? 'Видео-рулетка' : 'Входящий видеозвонок' }}
      </div>
      <div class="mt-4 flex justify-center">
        <Avatar
          :image="peerAvatar ?? undefined"
          :label="!peerAvatar ? peerName.slice(0, 1) : undefined"
          shape="circle"
          class="!w-20 !h-20 !text-3xl ring-4 ring-rose-200 dark:ring-rose-900 animate-pulse"
        />
      </div>
      <div class="mt-3 text-lg font-black truncate">
        {{ peerName }}
      </div>
      <div class="text-sm text-stone-500 dark:text-zinc-400">
        {{ isRoulette ? 'случайный собеседник на связи' : 'хочет поговорить по видео' }}
      </div>
      <div class="mt-5 flex gap-2 justify-center flex-wrap">
        <Button
          icon="pi pi-phone"
          label="Принять"
          rounded
          :loading="v.busy.value"
          class="!bg-emerald-500 !border-emerald-500"
          @click="v.accept()"
        />
        <Button
          icon="pi pi-times"
          label="Отклонить"
          rounded
          severity="danger"
          outlined
          :disabled="v.busy.value"
          @click="v.decline()"
        />
      </div>
      <div class="mt-3 text-[11px] leading-snug text-stone-400 dark:text-zinc-500">Собеседник может записать разговор — не показывай лишнего</div>
    </div>
  </Dialog>
</template>
