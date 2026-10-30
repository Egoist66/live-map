<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import { useRingtone } from '@/composables/useRingtone'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

/**
 * Диалог входящего голосового звонка (мэтч, друг или рулетка).
 * Логики нет: показывает стор и дергает useVideoSession.
 */

const v = useVideoSession()
const ring = useRingtone()

const visible = ref(false)

const dialogPt = {
  root: { class: '!rounded-3xl max-sm:!rounded-b-none !border-0 !bg-white dark:!bg-[#0F121F] overflow-hidden' },
  header: { class: '!hidden' },
  content: { class: '!p-0 !bg-white dark:!bg-[#0F121F]' },
}

const isRoulette = computed(() => v.store.incoming?.mode === 'roulette')
const peerName = computed(() => v.store.incoming?.peer.name ?? 'Собеседник')
const peerAvatar = computed(() => v.store.incoming?.peer.avatar_url ?? null)
/** Рулетка в авто-режиме принимает пару сама — диалог не показываем. */
const autoRoulette = computed(() => v.rouletteAuto.value && isRoulette.value)

watch(
  () => v.store.status,
  (next) => {
    visible.value = next === 'ringing-in' && !autoRoulette.value
    if (visible.value) ring.startRing()
    else ring.stopRing()
  },
  { immediate: true },
)

watch(autoRoulette, (auto) => {
  if (auto) {
    visible.value = false
    ring.stopRing()
  }
})

onBeforeUnmount(() => ring.stopRing())
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
        {{ isRoulette ? 'Голосовая рулетка' : 'Входящий звонок' }}
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
        {{ isRoulette ? 'случайный собеседник на связи' : 'хочет поговорить голосом' }}
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
      <div class="mt-3 text-[11px] leading-snug text-stone-400 dark:text-zinc-500">Собеседник может записать разговор</div>
    </div>
  </Dialog>
</template>
