<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useVideoSession } from '@/composables/useVideoSession'
import { videoApi } from '@/services/video.api'
import IncomingCallDialog from '@/Components/Features/Video/IncomingCallDialog.vue'
import VideoOverlay from '@/Components/Features/Video/VideoOverlay.vue'

/**
 * Глобальный хост видео: входящие звонки доходят на любой странице
 * (чат, карта, свайпы), а не только там, где смонтированы диалоги.
 * Подписка на шину идемпотентна — двойной mount безопасен.
 *
 * Добивка при мёртвом сокете (оба транспорта realtime молчат):
 * - idle/searching: подбираем висящие входящие раз в 5 секунд;
 * - ringing-out: опрашиваем статус своего звонка раз в 3 секунды —
 *   accepted подхватываем локально, конец гасим без ожидания сигнала.
 * При живом сокете поллы не ходят.
 */

const v = useVideoSession()

let pendingTimer: ReturnType<typeof setInterval> | null = null
let statusTimer: ReturnType<typeof setInterval> | null = null

/** Жив ли сокет: тогда входящие едут сами, полл не нужен. */
function socketAlive(): boolean {
  try {
    const echo = (window as any).Echo
    const state = echo?.connector?.pusher?.connection?.state
    return state === 'connected'
  } catch {
    return false
  }
}

/** Подобрать висящие входящие, если realtime молчит. */
async function pollPending(): Promise<void> {
  if (document.hidden || socketAlive()) return
  const status = v.store.status
  if (status !== 'idle' && status !== 'searching') return
  try {
    const res = await videoApi.pending()
    const first = res.incoming?.[0]
    if (first) v.store.handleIncoming(first)
  } catch {}
}

/**
 * Опросить свой исходящий звонок, если accepted-сигнал потерялся.
 * Callee принял, а мы не узнали: show() вернёт active — подхватываем
 * и пинаем offer (эмулируем оба bus-хендлера: стор + peer).
 */
async function pollOwnCall(): Promise<void> {
  if (document.hidden || socketAlive()) return
  if (v.store.status !== 'ringing-out') return
  const callId = v.store.call?.id
  if (!callId) return
  try {
    const res = await videoApi.show(callId)
    const next = String(res.call?.status ?? '')
    if (next === 'active') {
      v.store.markAccepted()
      if (v.store.call?.is_caller) {
        void v.peer.startOffer()
      }
    } else if (next === 'declined' || next === 'ended' || next === 'timeout') {
      v.store.resetSession()
    }
  } catch {}
}

onMounted(() => {
  v.bindRealtime()
  pendingTimer = setInterval(() => void pollPending(), 5000)
  statusTimer = setInterval(() => void pollOwnCall(), 3000)
})

onBeforeUnmount(() => {
  if (pendingTimer) clearInterval(pendingTimer)
  if (statusTimer) clearInterval(statusTimer)
  pendingTimer = null
  statusTimer = null
})
</script>

<template>
  <IncomingCallDialog />
  <VideoOverlay />
</template>
